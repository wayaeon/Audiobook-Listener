const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export type AudiobookDto = {
  id: string;
  title: string;
  author: string;
  description?: string;
  duration: number;
  coverUrl?: string;
  thumbnailUrl?: string;
  sourceFileCount: number;
  sourceFileIds: string[];
  chapters: { index: number; title: string; startTime: number; endTime: number }[];
};

export type StreamUrlDto = {
  url: string;
  /** Same-origin URL for playback (avoids R2 CORS). Prefer over url for audio.src. */
  contentUrl?: string;
  expiresAtUtc: string;
  index: number;
};

export async function getCatalog(accessToken: string): Promise<AudiobookDto[]> {
  const res = await fetch(`${API_URL || ''}/api/audiobooks`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    let message = 'Failed to fetch catalog';
    try {
      const body = await res.json();
      if (body.hint) message = `${message}. ${body.hint}`;
    } catch {
      if (res.status === 401) {
        message = `${message}. Check SUPABASE_JWT_SECRET and SUPABASE_JWT_ISSUER in .env.local.`;
      }
    }
    throw new Error(message);
  }
  return res.json();
}

export async function getAudiobook(id: string, accessToken: string): Promise<AudiobookDto> {
  const res = await fetch(`${API_URL || ''}/api/audiobooks/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch audiobook');
  return res.json();
}

export async function getStreamUrls(id: string, accessToken: string): Promise<StreamUrlDto[]> {
  const res = await fetch(`${API_URL || ''}/api/audiobooks/${encodeURIComponent(id)}/stream`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch stream URLs');
  return res.json();
}

export async function getStreamUrl(id: string, index: number, accessToken: string): Promise<StreamUrlDto> {
  const res = await fetch(`${API_URL || ''}/api/audiobooks/${encodeURIComponent(id)}/stream/${index}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch stream URL');
  return res.json();
}

export type MetadataDto = {
  title: string;
  author: string;
  description: string | null;
  duration: number;
  /** Data URL for cover (embedded or sidecar). Use as img src. */
  coverDataUrl: string | null;
  chapters: { index: number; title: string; startTime: number; endTime: number }[];
};

export async function getMetadata(id: string, accessToken: string): Promise<MetadataDto> {
  const base =
    typeof window !== 'undefined' ? '' : API_URL;
  const res = await fetch(`${base}/api/audiobooks/${encodeURIComponent(id)}/metadata`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Metadata failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** Cached metadata fetch - checks memory + localStorage before network. */
export async function getMetadataCached(
  id: string,
  accessToken: string,
  userId: string | undefined
): Promise<MetadataDto> {
  const { getCachedMetadata, setCachedMetadata } = await import('@/lib/metadataCache');
  const cached = getCachedMetadata(id, userId);
  if (cached) return cached;
  const data = await getMetadata(id, accessToken);
  setCachedMetadata(id, userId, data);
  return data;
}

/** Fetch cover image from /api/audiobooks/[id]/cover; returns object URL or null. Caller must revoke the URL. */
export async function getCoverBlobUrl(id: string, accessToken: string): Promise<string | null> {
  const base = typeof window !== 'undefined' ? '' : API_URL;
  const res = await fetch(`${base}/api/audiobooks/${encodeURIComponent(id)}/cover`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Fetch presigned cover URLs for multiple books in one request. Returns map of id -> url. */
export async function getBatchCoverUrls(
  ids: string[],
  accessToken: string
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const base = typeof window !== 'undefined' ? '' : API_URL;
  const res = await fetch(`${base}/api/audiobooks/covers?ids=${ids.map(encodeURIComponent).join(',')}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  return res.json();
}

/** Fetch stream URL (token-in-URL or OneDrive) and return as Blob for offline storage. */
export async function fetchStreamAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.blob();
}
