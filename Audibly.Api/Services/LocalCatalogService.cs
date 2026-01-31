using System.Security.Cryptography;
using System.Text;
using Audibly.Api.DTOs;
using Microsoft.Extensions.Options;

namespace Audibly.Api.Services;

public class LocalCatalogService : ICatalogService
{
    private readonly LocalCatalogOptions _options;
    private readonly IStreamTokenService _tokenService;
    private readonly ILogger<LocalCatalogService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private List<AudiobookDto>? _cache;
    private DateTime _cacheExpiry = DateTime.MinValue;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    public LocalCatalogService(
        IOptions<LocalCatalogOptions> options,
        IStreamTokenService tokenService,
        ILogger<LocalCatalogService> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _options = options.Value;
        _tokenService = tokenService;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    public Task<IReadOnlyList<AudiobookDto>> GetCatalogAsync(CancellationToken cancellationToken = default)
    {
        RefreshCacheIfNeeded();
        return Task.FromResult<IReadOnlyList<AudiobookDto>>(_cache ?? []);
    }

    public Task<AudiobookDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        RefreshCacheIfNeeded();
        var book = _cache?.FirstOrDefault(a => a.Id == id);
        return Task.FromResult(book);
    }

    public Task<IReadOnlyList<StreamUrlDto>> GetStreamUrlsAsync(string audiobookId, CancellationToken cancellationToken = default)
    {
        RefreshCacheIfNeeded();
        var book = _cache?.FirstOrDefault(a => a.Id == audiobookId);
        if (book == null || book.SourceFileIds.Count == 0)
            return Task.FromResult<IReadOnlyList<StreamUrlDto>>([]);

        var baseUrl = GetBaseUrl();
        var list = new List<StreamUrlDto>();
        for (var i = 0; i < book.SourceFileIds.Count; i++)
        {
            var token = _tokenService.CreateToken(audiobookId, i);
            list.Add(new StreamUrlDto
            {
                Url = $"{baseUrl}/api/audiobooks/{Uri.EscapeDataString(audiobookId)}/stream/{i}/content?token={token}",
                ExpiresAtUtc = DateTime.UtcNow.Add(TimeSpan.FromMinutes(60)),
                Index = i
            });
        }
        return Task.FromResult<IReadOnlyList<StreamUrlDto>>(list);
    }

    public Task<StreamUrlDto?> GetStreamUrlAsync(string audiobookId, int index, CancellationToken cancellationToken = default)
    {
        RefreshCacheIfNeeded();
        var book = _cache?.FirstOrDefault(a => a.Id == audiobookId);
        if (book == null || index < 0 || index >= book.SourceFileIds.Count)
            return Task.FromResult<StreamUrlDto?>(null);

        var baseUrl = GetBaseUrl();
        var token = _tokenService.CreateToken(audiobookId, index);
        return Task.FromResult<StreamUrlDto?>(new StreamUrlDto
        {
            Url = $"{baseUrl}/api/audiobooks/{Uri.EscapeDataString(audiobookId)}/stream/{index}/content?token={token}",
            ExpiresAtUtc = DateTime.UtcNow.Add(TimeSpan.FromMinutes(60)),
            Index = index
        });
    }

    public string? GetFilePath(string audiobookId, int index)
    {
        RefreshCacheIfNeeded();
        var book = _cache?.FirstOrDefault(a => a.Id == audiobookId);
        if (book == null || index < 0 || index >= book.SourceFileIds.Count)
            return null;
        var relativePath = book.SourceFileIds[index];
        var fullPath = Path.GetFullPath(Path.Combine(_options.RootPath, relativePath));
        var rootFull = Path.GetFullPath(_options.RootPath).TrimEnd(Path.DirectorySeparatorChar);
        if (!fullPath.StartsWith(rootFull + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            return null;
        return File.Exists(fullPath) ? fullPath : null;
    }

    private string GetBaseUrl()
    {
        var ctx = _httpContextAccessor.HttpContext;
        if (ctx != null)
        {
            var scheme = ctx.Request.Scheme;
            var host = ctx.Request.Host.Value;
            return $"{scheme}://{host}";
        }
        return "http://localhost:5000";
    }

    private void RefreshCacheIfNeeded()
    {
        if (_cache != null && DateTime.UtcNow < _cacheExpiry)
            return;

        _cache = ScanRoot();
        _cacheExpiry = DateTime.UtcNow.Add(CacheDuration);
    }

    private List<AudiobookDto> ScanRoot()
    {
        var list = new List<AudiobookDto>();
        var addedFolderIds = new HashSet<string>(StringComparer.Ordinal);
        var root = _options.RootPath;
        if (string.IsNullOrWhiteSpace(root) || !Directory.Exists(root))
        {
            _logger.LogWarning("LocalStorage RootPath is missing or not a directory: {Root}", root);
            return list;
        }

        try
        {
            foreach (var entry in Directory.EnumerateFileSystemEntries(root, "*", new EnumerationOptions { RecurseSubdirectories = true }))
            {
                var name = Path.GetFileName(entry);
                if (string.IsNullOrEmpty(name) || name.StartsWith(".", StringComparison.Ordinal))
                    continue;

                if (Directory.Exists(entry))
                    continue;

                var ext = Path.GetExtension(entry);
                if (!ext.Equals(".m4b", StringComparison.OrdinalIgnoreCase))
                    continue;

                var relativePath = Path.GetRelativePath(root, entry);
                var dir = Path.GetDirectoryName(relativePath);
                var isInSubfolder = !string.IsNullOrEmpty(dir);

                string stableId;
                List<string> sourceFileIds;
                string title;
                List<ChapterDto> chapters;

                if (isInSubfolder)
                {
                    var folderPath = Path.GetDirectoryName(entry)!;
                    var folderRelative = Path.GetRelativePath(root, folderPath);
                    stableId = ToStableId(folderRelative);
                    if (addedFolderIds.Contains(stableId))
                        continue;
                    addedFolderIds.Add(stableId);
                    sourceFileIds = Directory.EnumerateFiles(folderPath, "*.m4b", SearchOption.TopDirectoryOnly)
                        .OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase)
                        .Select(f => Path.GetRelativePath(root, f))
                        .ToList();
                    if (sourceFileIds.Count == 0) continue;
                    title = Path.GetFileName(folderPath) ?? name;
                    chapters = TryParseCueChapters(root, folderPath, sourceFileIds);
                }
                else
                {
                    stableId = ToStableId(relativePath);
                    sourceFileIds = [relativePath];
                    title = Path.GetFileNameWithoutExtension(name);
                    chapters = TryParseCueChapters(root, Path.GetDirectoryName(entry) ?? root, sourceFileIds);
                }

                list.Add(new AudiobookDto
                {
                    Id = stableId,
                    Title = title,
                    Author = "",
                    SourceFileCount = sourceFileIds.Count,
                    SourceFileIds = sourceFileIds,
                    Chapters = chapters,
                    Duration = 0
                });
            }

            _logger.LogInformation("Local catalog scanned: {Count} audiobooks", list.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scanning root path {Root}", root);
        }

        return list;
    }

    private static string ToStableId(string relativePath)
    {
        var normalized = relativePath.Replace('\\', '/').TrimStart('/');
        var bytes = Encoding.UTF8.GetBytes(normalized);
        var hash = SHA256.HashData(bytes);
        return Convert.ToBase64String(hash)[..22].Replace('+', '-').Replace('/', '_');
    }

    private static List<ChapterDto> TryParseCueChapters(string root, string folderPath, List<string> _)
    {
        var chapters = new List<ChapterDto>();
        try
        {
            var cueFiles = Directory.EnumerateFiles(folderPath, "*.cue", SearchOption.TopDirectoryOnly);
            foreach (var cuePath in cueFiles)
            {
                var lines = File.ReadAllLines(cuePath);
                uint index = 0;
                string? currentTitle = null;
                uint currentStart = 0;
                foreach (var line in lines)
                {
                    var t = line.Trim();
                    if (t.StartsWith("TRACK ", StringComparison.OrdinalIgnoreCase))
                    {
                        if (currentTitle != null)
                            chapters.Add(new ChapterDto { Index = (int)index - 1, Title = currentTitle, StartTime = currentStart, EndTime = 0 });
                        index++;
                        currentTitle = null;
                        currentStart = 0;
                    }
                    else if (t.StartsWith("TITLE ", StringComparison.OrdinalIgnoreCase))
                    {
                        currentTitle = t[5..].Trim().Trim('"');
                    }
                    else if (t.StartsWith("INDEX 01 ", StringComparison.OrdinalIgnoreCase))
                    {
                        var timePart = t[9..].Trim();
                        currentStart = CueTimeToMs(timePart);
                    }
                }
                if (currentTitle != null)
                    chapters.Add(new ChapterDto { Index = (int)index - 1, Title = currentTitle, StartTime = currentStart, EndTime = 0 });
                break;
            }
        }
        catch
        {
            // ignore cue parse errors
        }
        return chapters;
    }

    private static uint CueTimeToMs(string mmssff)
    {
        var parts = mmssff.Split(':', '.');
        if (parts.Length < 3) return 0;
        if (!int.TryParse(parts[0], out var m)) return 0;
        if (!int.TryParse(parts[1], out var s)) return 0;
        if (!int.TryParse(parts[2], out var f)) return 0;
        return (uint)((m * 60 + s) * 1000 + (f * 1000 / 75));
    }
}
