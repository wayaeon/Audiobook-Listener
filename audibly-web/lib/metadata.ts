import { parseBuffer } from 'music-metadata';
import { getObjectFirstBytes, getObjectLastBytes, getObjectAsText, getObjectAsBuffer, listKeysWithPrefix, M4B_MOOV_READ_BYTES } from './r2';

export type ChapterInfo = { index: number; title: string; startTime: number; endTime: number };

export type EnrichedMetadata = {
  title: string;
  author: string;
  description: string | null;
  duration: number;
  /** Data URL for embedded cover (e.g. data:image/jpeg;base64,...) */
  coverDataUrl: string | null;
  /** R2 key for cover image if sidecar cover.jpg exists */
  coverKey: string | null;
  chapters: ChapterInfo[];
};

export const COVER_NAMES = ['cover.jpg', 'cover.png', 'cover.jpeg', 'cover.webp'];

/** Get folder prefix from first source file key (e.g. "Author - Title/file.m4b" -> "Author - Title/"). */
function folderPrefixFromKey(key: string): string {
  const i = key.lastIndexOf('/');
  return i >= 0 ? key.slice(0, i + 1) : '';
}

/** Load metadata from keys already known – no listKeysWithPrefix. */
export async function loadSidecarMetadataFromKeys(
  keys: string[],
  signal?: AbortSignal
): Promise<{ title?: string; author?: string; description?: string; chapters?: ChapterInfo[]; coverKey?: string } | null> {
  if (keys.length === 0) return null;
  const metadataKey = keys.find((k) => k.endsWith('metadata.json'));
  const coverKey = keys.find((k) => COVER_NAMES.some((n) => k.endsWith(n)));
  let title: string | undefined;
  let author: string | undefined;
  let chapters: ChapterInfo[] | undefined;
  let description: string | undefined;
  if (metadataKey) {
    const raw = await getObjectAsText(metadataKey, signal);
    if (raw) {
      try {
        const data = JSON.parse(raw) as {
          title?: string;
          author?: string;
          description?: string;
          chapters?: { index?: number; title?: string; startTime?: number; endTime?: number }[];
        };
        title = data.title;
        author = data.author;
        description = data.description;
        if (Array.isArray(data.chapters)) {
          chapters = data.chapters.map((ch, i) => ({
            index: ch.index ?? i,
            title: ch.title ?? `Chapter ${i + 1}`,
            startTime: ch.startTime ?? 0,
            endTime: ch.endTime ?? 0,
          }));
        }
      } catch {
        /* ignore */
      }
    }
  }
  return { title, author, description, chapters, coverKey: coverKey ?? undefined };
}

/** Load optional metadata.json and cover from R2 for a given folder. */
export async function loadSidecarMetadata(
  folderPrefix: string,
  signal?: AbortSignal
): Promise<{ title?: string; author?: string; description?: string; chapters?: ChapterInfo[]; coverKey?: string } | null> {
  const keys = await listKeysWithPrefix(folderPrefix);
  if (keys.length === 0) return null;
  const metadataKey = keys.find((k) => k.endsWith('metadata.json'));
  const coverKey = keys.find((k) => COVER_NAMES.some((n) => k.endsWith(n)));
  let title: string | undefined;
  let author: string | undefined;
  let chapters: ChapterInfo[] | undefined;
  let description: string | undefined;
  if (metadataKey) {
    const raw = await getObjectAsText(metadataKey, signal);
    if (raw) {
      try {
        const data = JSON.parse(raw) as {
          title?: string;
          author?: string;
          description?: string;
          chapters?: { index?: number; title?: string; startTime?: number; endTime?: number }[];
        };
        title = data.title;
        author = data.author;
        description = data.description;
        if (Array.isArray(data.chapters)) {
          chapters = data.chapters.map((ch, i) => ({
            index: ch.index ?? i,
            title: ch.title ?? `Chapter ${i + 1}`,
            startTime: ch.startTime ?? 0,
            endTime: ch.endTime ?? 0,
          }));
        }
      } catch {
        // ignore invalid JSON
      }
    }
  }
  return { title, author, description, chapters, coverKey: coverKey ?? undefined };
}

/** Parse a buffer (m4b/mp3) and return enriched metadata; returns null on parse error. */
async function parseAudioBuffer(
  buffer: Buffer,
  mimeType: string | undefined
): Promise<Partial<EnrichedMetadata> | null> {
  try {
    const meta = await parseBuffer(buffer, mimeType, { includeChapters: true });
    const picture = meta.common.picture?.[0];
    let coverDataUrl: string | null = null;
    if (picture?.data) {
      const base64 = Buffer.from(picture.data).toString('base64');
      const mime = picture.format ?? 'image/jpeg';
      coverDataUrl = `data:${mime};base64,${base64}`;
    }
    const chapters: ChapterInfo[] = [];
    if (meta.format.chapters?.length) {
      meta.format.chapters.forEach((ch, i) => {
        chapters.push({
          index: i,
          title: ch.title ?? `Chapter ${i + 1}`,
          startTime: Math.floor(ch.start),
          endTime: ch.end != null ? Math.floor(ch.end) : 0,
        });
      });
    }
    return {
      title: meta.common.title ?? undefined,
      author: meta.common.artist ?? undefined,
      duration: meta.format.duration ?? 0,
      coverDataUrl,
      chapters: chapters.length > 0 ? chapters : undefined,
    };
  } catch {
    return null;
  }
}

/** Extract metadata (and embedded cover) from m4b/mp3 in R2. M4B stores everything in one file; moov atom can be at start (first ~4MB) or at end. */
export async function extractMetadataFromR2(
  key: string,
  signal?: AbortSignal
): Promise<Partial<EnrichedMetadata> | null> {
  const isM4b = key.toLowerCase().endsWith('.m4b') || key.toLowerCase().endsWith('.m4a');
  const ext = isM4b ? 'audio/mp4' : key.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : undefined;
  if (!ext) return null;

  const maxBytes = isM4b ? M4B_MOOV_READ_BYTES : 512 * 1024;
  let buffer = await getObjectFirstBytes(key, maxBytes, signal);
  if (!buffer || buffer.length === 0) return null;

  let result = await parseAudioBuffer(buffer, ext);
  if (result?.coverDataUrl != null || (result?.duration != null && result.duration > 0)) {
    return result;
  }
  if (!isM4b) return result;

  buffer = await getObjectLastBytes(key, M4B_MOOV_READ_BYTES, signal);
  if (!buffer || buffer.length === 0) return result;
  const tailResult = await parseAudioBuffer(buffer, ext);
  if (tailResult && (tailResult.coverDataUrl != null || (tailResult.duration != null && tailResult.duration > 0))) {
    return tailResult;
  }
  return result;
}

/** Enrich metadata for one audiobook: sidecar + embedded from first file. */
export async function getEnrichedMetadata(
  firstFileKey: string,
  fallbackTitle: string,
  signal?: AbortSignal
): Promise<EnrichedMetadata> {
  const folderPrefix = folderPrefixFromKey(firstFileKey);
  const sidecar = await loadSidecarMetadata(folderPrefix, signal);
  const embedded = await extractMetadataFromR2(firstFileKey, signal);

  const title = sidecar?.title ?? embedded?.title ?? fallbackTitle;
  const author = sidecar?.author ?? embedded?.author ?? '';
  const description = sidecar?.description ?? null;
  const duration = embedded?.duration ?? 0;
  const chapters: ChapterInfo[] =
    sidecar?.chapters?.length ? sidecar.chapters : embedded?.chapters ?? [];

  let coverDataUrl = embedded?.coverDataUrl ?? null;
  const coverKey = sidecar?.coverKey ?? null;
  if (!coverDataUrl && coverKey) {
    const buf = await getObjectAsBuffer(coverKey, 2 * 1024 * 1024, signal);
    if (buf && buf.length > 0) {
      const base64 = buf.toString('base64');
      const mime = coverKey.endsWith('.png') ? 'image/png' : 'image/jpeg';
      coverDataUrl = `data:${mime};base64,${base64}`;
    }
  }

  return {
    title,
    author,
    description,
    duration,
    coverDataUrl,
    coverKey,
    chapters,
  };
}
