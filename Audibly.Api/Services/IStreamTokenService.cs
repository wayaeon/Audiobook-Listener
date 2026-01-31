namespace Audibly.Api.Services;

public interface IStreamTokenService
{
    string CreateToken(string audiobookId, int index);
    (string AudiobookId, int Index)? ValidateToken(string token);
}
