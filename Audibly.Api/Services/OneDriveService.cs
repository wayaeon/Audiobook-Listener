using Microsoft.Extensions.Options;

namespace Audibly.Api.Services;

public class OneDriveService : IOneDriveService
{
    private readonly OneDriveOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<OneDriveService> _logger;
    private string? _accessToken;
    private DateTime _tokenExpiry = DateTime.MinValue;

    public OneDriveService(IOptions<OneDriveOptions> options, IHttpClientFactory httpClientFactory, ILogger<OneDriveService> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<string?> GetDownloadUrlAsync(string driveItemId, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        await EnsureTokenAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrEmpty(_accessToken))
            return null;

        using var handler = new HttpClientHandler { AllowAutoRedirect = false };
        using var client = new HttpClient(handler);
        var path = string.IsNullOrEmpty(_options.DriveId)
            ? $"https://graph.microsoft.com/v1.0/me/drive/items/{driveItemId}/content"
            : $"https://graph.microsoft.com/v1.0/drives/{_options.DriveId}/items/{driveItemId}/content";
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);
        var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("OneDrive content request failed for {ItemId}: {StatusCode}", driveItemId, response.StatusCode);
            return null;
        }

        return response.Headers.Location?.ToString();
    }

    public async Task<IReadOnlyList<DriveAudiobookItem>> ListAudiobookFilesAsync(string folderPathOrDriveItemId, CancellationToken cancellationToken = default)
    {
        await EnsureTokenAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrEmpty(_accessToken))
            return Array.Empty<DriveAudiobookItem>();

        var client = _httpClientFactory.CreateClient();
        var isPath = folderPathOrDriveItemId.StartsWith("/");
        var drivePrefix = string.IsNullOrEmpty(_options.DriveId) ? "me/drive" : $"drives/{_options.DriveId}";
        var resource = isPath
            ? $"https://graph.microsoft.com/v1.0/me/drive/root:{folderPathOrDriveItemId}:/children"
            : $"https://graph.microsoft.com/v1.0/{drivePrefix}/items/{folderPathOrDriveItemId}/children";

        using var request = new HttpRequestMessage(HttpMethod.Get, resource);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);
        var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("OneDrive list failed for {Resource}: {StatusCode}", resource, response.StatusCode);
            return Array.Empty<DriveAudiobookItem>();
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        return ParseChildrenResponse(json);
    }

    public async Task<IReadOnlyList<DriveChildItem>> ListChildrenAsync(string folderPathOrDriveItemId, CancellationToken cancellationToken = default)
    {
        await EnsureTokenAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrEmpty(_accessToken))
            return Array.Empty<DriveChildItem>();

        var client = _httpClientFactory.CreateClient();
        var isPath = folderPathOrDriveItemId.StartsWith("/");
        var drivePrefix = string.IsNullOrEmpty(_options.DriveId) ? "me/drive" : $"drives/{_options.DriveId}";
        var resource = isPath
            ? $"https://graph.microsoft.com/v1.0/me/drive/root:{folderPathOrDriveItemId}:/children"
            : $"https://graph.microsoft.com/v1.0/{drivePrefix}/items/{folderPathOrDriveItemId}/children";

        using var request = new HttpRequestMessage(HttpMethod.Get, resource);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);
        var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("OneDrive list children failed for {Resource}: {StatusCode}", resource, response.StatusCode);
            return Array.Empty<DriveChildItem>();
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        return ParseChildrenToDriveChildItems(json);
    }

    private static List<DriveChildItem> ParseChildrenToDriveChildItems(string json)
    {
        var list = new List<DriveChildItem>();
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("value", out var value))
                return list;
            foreach (var item in value.EnumerateArray())
            {
                var id = item.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "" : "";
                var name = item.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "";
                var isFolder = item.TryGetProperty("folder", out _);
                var size = item.TryGetProperty("size", out var sizeProp) && sizeProp.TryGetInt64(out var s) ? s : 0L;
                if (!string.IsNullOrEmpty(id))
                    list.Add(new DriveChildItem { Id = id, Name = name, IsFolder = isFolder, Size = size });
            }
        }
        catch
        {
            // return empty on parse error
        }
        return list;
    }

    private static List<DriveAudiobookItem> ParseChildrenResponse(string json)
    {
        var list = new List<DriveAudiobookItem>();
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("value", out var value))
                return list;
            var index = 0;
            foreach (var item in value.EnumerateArray())
            {
                var id = item.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "" : "";
                var name = item.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "";
                var size = item.TryGetProperty("size", out var sizeProp) && sizeProp.TryGetInt64(out var s) ? s : 0L;
                var webUrl = item.TryGetProperty("webUrl", out var urlProp) ? urlProp.GetString() : null;
                if (!string.IsNullOrEmpty(id) && (name.EndsWith(".m4b", StringComparison.OrdinalIgnoreCase) || name.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase)))
                {
                    list.Add(new DriveAudiobookItem { Id = id, Name = name, Size = size, WebUrl = webUrl, Index = index });
                    index++;
                }
            }
        }
        catch
        {
            // return empty on parse error
        }
        return list;
    }

    private async Task EnsureTokenAsync(CancellationToken cancellationToken)
    {
        if (_accessToken != null && _tokenExpiry > DateTime.UtcNow.AddMinutes(5))
            return;

        if (string.IsNullOrEmpty(_options.ClientId) || string.IsNullOrEmpty(_options.ClientSecret) || string.IsNullOrEmpty(_options.TenantId))
        {
            _logger.LogWarning("OneDrive credentials not configured.");
            return;
        }

        var client = _httpClientFactory.CreateClient();
        var tokenUrl = $"https://login.microsoftonline.com/{_options.TenantId}/oauth2/v2.0/token";
        var body = new Dictionary<string, string>
        {
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret,
            ["scope"] = "https://graph.microsoft.com/.default",
            ["grant_type"] = "client_credentials"
        };
        using var content = new FormUrlEncodedContent(body);
        var response = await client.PostAsync(tokenUrl, content, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Failed to get OneDrive token: {StatusCode}", response.StatusCode);
            return;
        }

        var tokenJson = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        using var doc = System.Text.Json.JsonDocument.Parse(tokenJson);
        _accessToken = doc.RootElement.TryGetProperty("access_token", out var at) ? at.GetString() : null;
        var expiresIn = doc.RootElement.TryGetProperty("expires_in", out var exp) && exp.TryGetInt32(out var sec) ? sec : 3600;
        _tokenExpiry = DateTime.UtcNow.AddSeconds(expiresIn);
    }
}

public class OneDriveOptions
{
    public const string SectionName = "OneDrive";
    public string TenantId { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string DriveId { get; set; } = string.Empty;
    public string DriveItemId { get; set; } = string.Empty;
    public string AudiobooksFolderPath { get; set; } = "/Audiobooks";
}
