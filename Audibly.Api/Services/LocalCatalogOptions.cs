namespace Audibly.Api.Services;

public class LocalCatalogOptions
{
    public const string SectionName = "LocalStorage";
    /// <summary>Root folder containing audiobooks (e.g. your OneDrive-synced folder).</summary>
    public string RootPath { get; set; } = string.Empty;
}
