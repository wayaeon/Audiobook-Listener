const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export type AtGlanceDto = { tone?: string; pace?: string; world?: string; audience?: string };

export type AudiobookDto = {
  id: string;
  title: string;
  author: string;
  description?: string;
  duration: number;
  series?: string;
  genre?: string;
  curatorNote?: string;
  sections?: string[];
  tags?: string[];
  seriesNote?: string;
  coverUrl?: string;
  /** ISO date when added (for "Recent addition" badge) */
  addedAt?: string;
  thumbnailUrl?: string;
  sourceFileCount: number;
  sourceFileIds: string[];
  chapters: { index: number; title: string; startTime: number; endTime: number }[];
  narrator?: string;
  authorBio?: string;
  narratorBio?: string;
  whyListen?: string[];
  atGlance?: AtGlanceDto;
  publisher?: string;
  releaseYear?: string;
  language?: string;
  fileSizeBytes?: number;
  isbn?: string;
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
  series?: string | null;
  genre?: string | null;
  curatorNote?: string | null;
  sections?: string[] | null;
  tags?: string[] | null;
  seriesNote?: string | null;
  /** Data URL for cover (embedded or sidecar). Use as img src. */
  coverDataUrl: string | null;
  chapters: { index: number; title: string; startTime: number; endTime: number }[];
  narrator?: string | null;
  authorBio?: string | null;
  narratorBio?: string | null;
  whyListen?: string[] | null;
  atGlance?: AtGlanceDto | null;
  publisher?: string | null;
  releaseYear?: string | null;
  language?: string | null;
  fileSizeBytes?: number | null;
  isbn?: string | null;
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

const COVER_BATCH_SIZE = 50;

/** Fetch presigned cover URLs for multiple books. Batches into requests of 50 to respect API limit. */
export async function getBatchCoverUrls(
  ids: string[],
  accessToken: string
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const base = typeof window !== 'undefined' ? '' : API_URL;
  const result: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += COVER_BATCH_SIZE) {
    const chunk = ids.slice(i, i + COVER_BATCH_SIZE);
    const res = await fetch(`${base}/api/audiobooks/covers?ids=${chunk.map(encodeURIComponent).join(',')}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) continue;
    const chunkResult = (await res.json()) as Record<string, string>;
    Object.assign(result, chunkResult);
  }
  return result;
}

/** Fetch stream URL (token-in-URL or OneDrive) and return as Blob for offline storage. */
export async function fetchStreamAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.blob();
}

/**
 * Fetch stream and report progress. onProgress(loaded, total) where total may be 0 if unknown.
 * Blobs are stored in IndexedDB and are only playable through the app (object URLs in our player).
 */
export async function fetchStreamAsBlobWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void
): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const total = res.headers.has('content-length') ? parseInt(res.headers.get('content-length')!, 10) : 0;
  if (!res.body) return res.blob();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total || 0);
  }
  const blob = new Blob(chunks);
  onProgress(blob.size, blob.size);
  return blob;
}
