namespace Audibly.Api.DTOs;

public class StreamUrlDto
{
    public string Url { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public int Index { get; set; }
}
