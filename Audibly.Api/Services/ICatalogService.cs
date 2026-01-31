using Audibly.Api.DTOs;

namespace Audibly.Api.Services;

public interface ICatalogService
{
    Task<IReadOnlyList<AudiobookDto>> GetCatalogAsync(CancellationToken cancellationToken = default);
    Task<AudiobookDto?> GetByIdAsync(string driveItemId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StreamUrlDto>> GetStreamUrlsAsync(string audiobookIdOrDriveItemId, CancellationToken cancellationToken = default);
    Task<StreamUrlDto?> GetStreamUrlAsync(string audiobookId, int index = 0, CancellationToken cancellationToken = default);
    /// <summary>For local storage only: returns full file path to stream. Null if not local or not found.</summary>
    string? GetFilePath(string audiobookId, int index);
}
