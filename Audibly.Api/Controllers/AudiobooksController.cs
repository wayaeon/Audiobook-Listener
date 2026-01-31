using Audibly.Api.DTOs;
using Audibly.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Audibly.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AudiobooksController : ControllerBase
{
    private readonly ICatalogService _catalog;
    private readonly ILogger<AudiobooksController> _logger;

    public AudiobooksController(ICatalogService catalog, ILogger<AudiobooksController> logger)
    {
        _catalog = catalog;
        _logger = logger;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AudiobookDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AudiobookDto>>> GetCatalog(CancellationToken cancellationToken)
    {
        var catalog = await _catalog.GetCatalogAsync(cancellationToken).ConfigureAwait(false);
        return Ok(catalog);
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(AudiobookDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AudiobookDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var audiobook = await _catalog.GetByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (audiobook == null)
            return NotFound();
        return Ok(audiobook);
    }

    [HttpGet("{id}/stream")]
    [ProducesResponseType(typeof(IReadOnlyList<StreamUrlDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<StreamUrlDto>>> GetStreamUrls(string id, CancellationToken cancellationToken)
    {
        var urls = await _catalog.GetStreamUrlsAsync(id, cancellationToken).ConfigureAwait(false);
        if (urls.Count == 0)
            return NotFound();
        return Ok(urls);
    }

    [HttpGet("{id}/stream/{index:int}")]
    [ProducesResponseType(typeof(StreamUrlDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StreamUrlDto>> GetStreamUrl(string id, int index, CancellationToken cancellationToken)
    {
        var audiobook = await _catalog.GetByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (audiobook == null || index < 0 || index >= audiobook.SourceFileIds.Count)
            return NotFound();
        var dto = await _catalog.GetStreamUrlAsync(id, index, cancellationToken).ConfigureAwait(false);
        if (dto == null)
            return NotFound();
        return Ok(dto);
    }

    [HttpGet("{id}/stream/{index:int}/content")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult StreamContent(string id, int index, [FromQuery] string? token)
    {
        if (string.IsNullOrEmpty(token))
            return BadRequest();
        var tokenService = HttpContext.RequestServices.GetRequiredService<Services.IStreamTokenService>();
        var payload = tokenService.ValidateToken(token);
        if (payload == null || payload.Value.AudiobookId != id || payload.Value.Index != index)
            return NotFound();
        var catalog = HttpContext.RequestServices.GetRequiredService<ICatalogService>();
        var filePath = catalog.GetFilePath(id, index);
        if (string.IsNullOrEmpty(filePath))
            return NotFound();
        var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        var contentType = "audio/mp4";
        if (filePath.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase))
            contentType = "audio/mpeg";
        return File(stream, contentType, enableRangeProcessing: true);
    }
}
