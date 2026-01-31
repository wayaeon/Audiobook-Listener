using Audibly.Api.DTOs;
using Microsoft.Extensions.Options;

namespace Audibly.Api.Services;

public class CatalogService : ICatalogService
{
    private readonly IOneDriveService _oneDrive;
    private readonly OneDriveOptions _options;
    private readonly ILogger<CatalogService> _logger;

    public CatalogService(IOneDriveService oneDrive, IOptions<OneDriveOptions> options, ILogger<CatalogService> logger)
    {
        _oneDrive = oneDrive;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<AudiobookDto>> GetCatalogAsync(CancellationToken cancellationToken = default)
    {
        var pathOrId = string.IsNullOrEmpty(_options.DriveItemId)
            ? _options.AudiobooksFolderPath
            : _options.DriveItemId;
        var children = await _oneDrive.ListChildrenAsync(pathOrId, cancellationToken).ConfigureAwait(false);

        var catalog = new List<AudiobookDto>();
        foreach (var item in children)
        {
            if (item.IsFolder)
            {
                var folderFiles = await _oneDrive.ListAudiobookFilesAsync(item.Id, cancellationToken).ConfigureAwait(false);
                var fileIds = folderFiles.OrderBy(c => c.Index).Select(c => c.Id).ToList();
                if (fileIds.Count == 0)
                    continue;
                catalog.Add(new AudiobookDto
                {
                    Id = item.Id,
                    Title = item.Name,
                    Author = "",
                    SourceFileCount = fileIds.Count,
                    SourceFileIds = fileIds,
                    Duration = 0
                });
            }
            else if (item.Name.EndsWith(".m4b", StringComparison.OrdinalIgnoreCase) ||
                     item.Name.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase))
            {
                catalog.Add(new AudiobookDto
                {
                    Id = item.Id,
                    Title = System.IO.Path.GetFileNameWithoutExtension(item.Name),
                    Author = "",
                    SourceFileCount = 1,
                    SourceFileIds = [item.Id],
                    Duration = 0
                });
            }
        }

        return catalog;
    }

    public async Task<AudiobookDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await GetByIdAsync(id.ToString(), cancellationToken).ConfigureAwait(false);
    }

    public async Task<AudiobookDto?> GetByIdAsync(string driveItemId, CancellationToken cancellationToken = default)
    {
        var catalog = await GetCatalogAsync(cancellationToken).ConfigureAwait(false);
        return catalog.FirstOrDefault(a => a.Id == driveItemId);
    }

    public async Task<IReadOnlyList<StreamUrlDto>> GetStreamUrlsAsync(string audiobookIdOrDriveItemId, CancellationToken cancellationToken = default)
    {
        var catalog = await GetCatalogAsync(cancellationToken).ConfigureAwait(false);
        var book = catalog.FirstOrDefault(a => a.Id == audiobookIdOrDriveItemId);
        var ids = book?.SourceFileIds ?? [audiobookIdOrDriveItemId];
        var result = new List<StreamUrlDto>();
        var expiry = TimeSpan.FromMinutes(60);
        for (var i = 0; i < ids.Count; i++)
        {
            var url = await _oneDrive.GetDownloadUrlAsync(ids[i], expiry, cancellationToken).ConfigureAwait(false);
            if (url != null)
                result.Add(new StreamUrlDto { Url = url, ExpiresAtUtc = DateTime.UtcNow.Add(expiry), Index = i });
        }
        return result;
    }

    public async Task<StreamUrlDto?> GetStreamUrlAsync(string audiobookId, int index = 0, CancellationToken cancellationToken = default)
    {
        var book = await GetByIdAsync(audiobookId, cancellationToken).ConfigureAwait(false);
        if (book == null || index < 0 || index >= book.SourceFileIds.Count)
            return null;
        var driveItemId = book.SourceFileIds[index];
        var expiry = TimeSpan.FromMinutes(60);
        var url = await _oneDrive.GetDownloadUrlAsync(driveItemId, expiry, cancellationToken).ConfigureAwait(false);
        return url == null ? null : new StreamUrlDto { Url = url, ExpiresAtUtc = DateTime.UtcNow.Add(expiry), Index = index };
    }

    public string? GetFilePath(string audiobookId, int index) => null;
}
