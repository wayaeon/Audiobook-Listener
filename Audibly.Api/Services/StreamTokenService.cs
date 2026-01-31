using System.Collections.Concurrent;

namespace Audibly.Api.Services;

public class StreamTokenService : IStreamTokenService
{
    private static readonly ConcurrentDictionary<string, (string AudiobookId, int Index, DateTime Expiry)> Store = new();
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(60);

    public string CreateToken(string audiobookId, int index)
    {
        var token = Guid.NewGuid().ToString("N");
        Store[token] = (audiobookId, index, DateTime.UtcNow.Add(TokenLifetime));
        return token;
    }

    public (string AudiobookId, int Index)? ValidateToken(string token)
    {
        if (string.IsNullOrEmpty(token) || !Store.TryGetValue(token, out var entry))
            return null;
        if (DateTime.UtcNow > entry.Expiry)
        {
            Store.TryRemove(token, out _);
            return null;
        }
        return (entry.AudiobookId, entry.Index);
    }
}
