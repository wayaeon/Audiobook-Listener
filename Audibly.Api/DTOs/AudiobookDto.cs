namespace Audibly.Api.DTOs;

public class AudiobookDto
{
    /// <summary>OneDrive drive item id (folder or single file).</summary>
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long Duration { get; set; }
    public string? CoverUrl { get; set; }
    public string? ThumbnailUrl { get; set; }
    public int SourceFileCount { get; set; }
    /// <summary>OneDrive item ids for each source file (order preserved).</summary>
    public List<string> SourceFileIds { get; set; } = [];
    public List<ChapterDto> Chapters { get; set; } = [];
}

public class ChapterDto
{
    public int Index { get; set; }
    public string Title { get; set; } = string.Empty;
    public uint StartTime { get; set; }
    public uint EndTime { get; set; }
}
