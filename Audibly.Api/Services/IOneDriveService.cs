namespace Audibly.Api.Services;

public interface IOneDriveService
{
    Task<string?> GetDownloadUrlAsync(string driveItemId, TimeSpan? expiry = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DriveAudiobookItem>> ListAudiobookFilesAsync(string folderPathOrDriveItemId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DriveChildItem>> ListChildrenAsync(string folderPathOrDriveItemId, CancellationToken cancellationToken = default);
}

public class DriveChildItem
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsFolder { get; set; }
    public long Size { get; set; }
}

public class DriveAudiobookItem
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? WebUrl { get; set; }
    public long Size { get; set; }
    public int Index { get; set; }
}
