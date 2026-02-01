import { parseBuffer } from 'music-metadata';
import { getObjectFirstBytes, getObjectLastBytes, getObjectAsText, getObjectAsBuffer, listKeysWithPrefix, M4B_MOOV_READ_BYTES } from './r2';

export type ChapterInfo = { index: number; title: string; startTime: number; endTime: number };

export type EnrichedMetadata = {
  title: string;
  author: string;
  description: string | null;
  duration: number;
  series?: string;
  genre?: string;
  /** 1–2 line curator note (personal perspective) */
  curatorNote?: string;
  /** Curated section IDs (e.g. recommended-starting-points, foundational-works) */
  sections?: string[];
  /** Intellectual dimension tags (e.g. big-ideas, practical) */
  tags?: string[];
  /** Reading path guidance when book is part of a series */
  seriesNote?: string;
  /** Data URL for embedded cover (e.g. data:image/jpeg;base64,...) */
  coverDataUrl: string | null;
  /** R2 key for cover image if sidecar cover.jpg exists */
  coverKey: string | null;
  chapters: ChapterInfo[];
  narrator?: string;
  authorBio?: string;
  narratorBio?: string;
  /** "Why people listen" – max 3 bullets */
  whyListen?: string[];
  atGlance?: AtGlance;
  publisher?: string;
  releaseYear?: string;
  language?: string;
  fileSizeBytes?: number;
  isbn?: string;
};

export const COVER_NAMES = ['cover.jpg', 'cover.png', 'cover.jpeg', 'cover.webp'];

/** Get folder prefix from first source file key (e.g. "Author - Title/file.m4b" -> "Author - Title/"). */
function folderPrefixFromKey(key: string): string {
  const i = key.lastIndexOf('/');
  return i >= 0 ? key.slice(0, i + 1) : '';
}

const METADATA_JSON_PATTERNS = ['.metadata.json', 'metadata.json', 'book.json', 'info.json'];

function findMetadataJsonKey(keys: string[]): string | undefined {
  for (const pattern of METADATA_JSON_PATTERNS) {
    const found = keys.find((k) => k.toLowerCase().endsWith(pattern.toLowerCase()));
    if (found) return found;
  }
  return keys.find((k) => k.toLowerCase().endsWith('.json'));
}

/** Parse ffprobe time_base (e.g. "1/44100") and convert value in ticks to seconds. */
function timeBaseToSeconds(value: number, timeBase: string | undefined): number {
  if (timeBase == null || typeof timeBase !== 'string') return value;
  const parts = timeBase.split('/').map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1]) || parts[1] === 0) return value;
  return (value * parts[0]) / parts[1];
}

export type AtGlance = { tone?: string; pace?: string; world?: string; audience?: string };

/** Map ffprobe-style JSON (streams, chapters, format) to our sidecar metadata shape. */
function parseFfprobeMetadata(data: {
  format?: { duration?: string | number; size?: string | number; tags?: Record<string, string> };
  chapters?: Array<{ id?: number; start?: number; end?: number; time_base?: string; tags?: { title?: string } }>;
}): {
  title?: string;
  author?: string;
  description?: string;
  duration?: number;
  series?: string;
  genre?: string;
  chapters?: ChapterInfo[];
  publisher?: string;
  releaseYear?: string;
  language?: string;
  fileSizeBytes?: number;
} | null {
  const format = data?.format;
  if (!format || typeof format !== 'object') return null;

  const tags = format.tags && typeof format.tags === 'object' ? format.tags : {};
  const title = typeof tags.title === 'string' ? tags.title : undefined;
  const author = typeof tags.artist === 'string' ? tags.artist : undefined;
  const description = typeof tags.comment === 'string' ? tags.comment : undefined;
  const series = typeof tags.SERIES === 'string' ? tags.SERIES : typeof tags.series === 'string' ? tags.series : undefined;
  const genre = typeof tags.genre === 'string' ? tags.genre : undefined;
  const publisher = typeof tags.PUBLISHER === 'string' ? tags.PUBLISHER : undefined;
  const language = typeof tags.LANGUAGE === 'string' ? tags.LANGUAGE : undefined;
  const dateStr = typeof tags.date === 'string' ? tags.date : undefined;
  const releaseYear = dateStr && /^\d{4}/.test(dateStr) ? dateStr.slice(0, 4) : undefined;

  let fileSizeBytes: number | undefined;
  if (typeof format.size === 'number' && format.size >= 0) fileSizeBytes = format.size;
  else if (typeof format.size === 'string') {
    const n = parseInt(format.size, 10);
    if (Number.isFinite(n) && n >= 0) fileSizeBytes = n;
  }

  let duration: number | undefined;
  if (typeof format.duration === 'number' && format.duration >= 0) {
    duration = format.duration;
  } else if (typeof format.duration === 'string') {
    const d = parseFloat(format.duration);
    if (Number.isFinite(d) && d >= 0) duration = d;
  }

  let chapters: ChapterInfo[] | undefined;
  if (Array.isArray(data.chapters) && data.chapters.length > 0) {
    chapters = data.chapters.map((ch, i) => {
      const timeBase = ch.time_base;
      const start = typeof ch.start === 'number' ? ch.start : 0;
      const end = typeof ch.end === 'number' ? ch.end : start;
      const titleStr = ch.tags && typeof ch.tags.title === 'string' ? ch.tags.title : `Chapter ${i + 1}`;
      return {
        index: typeof ch.id === 'number' ? ch.id : i,
        title: titleStr,
        startTime: Math.floor(timeBaseToSeconds(start, timeBase)),
        endTime: Math.floor(timeBaseToSeconds(end, timeBase)),
      };
    });
    if (duration == null && chapters.length > 0) {
      const lastEnd = Math.max(...chapters.map((c) => c.endTime));
      if (lastEnd > 0) duration = lastEnd;
    }
  }

  return { title, author, description, duration, series, genre, chapters, publisher, releaseYear, language, fileSizeBytes };
}

export type SidecarMetadata = {
  title?: string;
  author?: string;
  description?: string;
  duration?: number;
  series?: string;
  genre?: string;
  curatorNote?: string;
  sections?: string[];
  tags?: string[];
  seriesNote?: string;
  chapters?: ChapterInfo[];
  coverKey?: string;
  narrator?: string;
  authorBio?: string;
  narratorBio?: string;
  /** Max 3 bullets: "Why people listen to this" */
  whyListen?: string[];
  atGlance?: AtGlance;
  publisher?: string;
  releaseYear?: string;
  language?: string;
  fileSizeBytes?: number;
  isbn?: string;
};

/** Load metadata from keys already known – no listKeysWithPrefix. */
export async function loadSidecarMetadataFromKeys(
  keys: string[],
  signal?: AbortSignal
): Promise<SidecarMetadata | null> {
  if (keys.length === 0) return null;
  const metadataKey = findMetadataJsonKey(keys);
  const coverKey = keys.find((k) => COVER_NAMES.some((n) => k.toLowerCase().endsWith(n.toLowerCase())));
  let title: string | undefined;
  let author: string | undefined;
  let chapters: ChapterInfo[] | undefined;
  let description: string | undefined;
  let duration: number | undefined;
  let series: string | undefined;
  let genre: string | undefined;
  let curatorNote: string | undefined;
  let sections: string[] | undefined;
  let tags: string[] | undefined;
  let seriesNote: string | undefined;
  let narrator: string | undefined;
  let authorBio: string | undefined;
  let narratorBio: string | undefined;
  let whyListen: string[] | undefined;
  let atGlance: AtGlance | undefined;
  let publisher: string | undefined;
  let releaseYear: string | undefined;
  let language: string | undefined;
  let fileSizeBytes: number | undefined;
  let isbn: string | undefined;
  if (metadataKey) {
    let raw = await getObjectAsText(metadataKey, signal);
    if (raw) {
      raw = raw.replace(/^\uFEFF/, '');
      try {
        const data = JSON.parse(raw) as Record<string, unknown>;

        const ffprobe = parseFfprobeMetadata(data as Parameters<typeof parseFfprobeMetadata>[0]);
        if (ffprobe) {
          title = ffprobe.title ?? title;
          author = ffprobe.author ?? author;
          description = ffprobe.description ?? description;
          duration = ffprobe.duration ?? duration;
          series = ffprobe.series ?? series;
          genre = ffprobe.genre ?? genre;
          chapters = ffprobe.chapters ?? chapters;
          publisher = ffprobe.publisher ?? publisher;
          releaseYear = ffprobe.releaseYear ?? releaseYear;
          language = ffprobe.language ?? language;
          fileSizeBytes = ffprobe.fileSizeBytes ?? fileSizeBytes;
        }

        const simple = data as {
          title?: string;
          author?: string;
          description?: string;
          duration?: number;
          series?: string;
          genre?: string;
          curatorNote?: string;
          sections?: unknown;
          tags?: unknown;
          seriesNote?: string;
          chapters?: { index?: number; title?: string; startTime?: number; endTime?: number }[];
          narrator?: string;
          authorBio?: string;
          narratorBio?: string;
          whyListen?: unknown;
          atGlance?: { tone?: string; pace?: string; world?: string; audience?: string };
          publisher?: string;
          releaseYear?: string;
          language?: string;
          fileSizeBytes?: number;
          isbn?: string;
        };
        curatorNote = typeof simple.curatorNote === 'string' ? simple.curatorNote : undefined;
        sections = Array.isArray(simple.sections) ? simple.sections.filter((s): s is string => typeof s === 'string') : undefined;
        tags = Array.isArray(simple.tags) ? simple.tags.filter((t): t is string => typeof t === 'string') : undefined;
        seriesNote = typeof simple.seriesNote === 'string' ? simple.seriesNote : undefined;
        narrator = typeof simple.narrator === 'string' ? simple.narrator : undefined;
        authorBio = typeof simple.authorBio === 'string' ? simple.authorBio : undefined;
        narratorBio = typeof simple.narratorBio === 'string' ? simple.narratorBio : undefined;
        if (Array.isArray(simple.whyListen)) {
          whyListen = simple.whyListen.filter((x): x is string => typeof x === 'string').slice(0, 3);
        }
        if (simple.atGlance && typeof simple.atGlance === 'object') {
          atGlance = {
            tone: typeof simple.atGlance.tone === 'string' ? simple.atGlance.tone : undefined,
            pace: typeof simple.atGlance.pace === 'string' ? simple.atGlance.pace : undefined,
            world: typeof simple.atGlance.world === 'string' ? simple.atGlance.world : undefined,
            audience: typeof simple.atGlance.audience === 'string' ? simple.atGlance.audience : undefined,
          };
        }
        publisher = publisher ?? (typeof simple.publisher === 'string' ? simple.publisher : undefined);
        releaseYear = releaseYear ?? (typeof simple.releaseYear === 'string' ? simple.releaseYear : undefined);
        language = language ?? (typeof simple.language === 'string' ? simple.language : undefined);
        if (fileSizeBytes == null && typeof simple.fileSizeBytes === 'number' && simple.fileSizeBytes >= 0) fileSizeBytes = simple.fileSizeBytes;
        isbn = typeof simple.isbn === 'string' ? simple.isbn : undefined;

        if (title == null) title = typeof simple.title === 'string' ? simple.title : undefined;
        if (author == null) author = typeof simple.author === 'string' ? simple.author : undefined;
        if (description == null) description = typeof simple.description === 'string' ? simple.description : undefined;
        if (duration == null) duration = typeof simple.duration === 'number' && simple.duration >= 0 ? simple.duration : undefined;
        if (series == null) series = typeof simple.series === 'string' ? simple.series : undefined;
        if (genre == null) genre = typeof simple.genre === 'string' ? simple.genre : undefined;
        if (chapters == null && Array.isArray(simple.chapters)) {
          chapters = simple.chapters.map((ch, i) => ({
            index: typeof ch.index === 'number' ? ch.index : i,
            title: typeof ch.title === 'string' ? ch.title : `Chapter ${i + 1}`,
            startTime: typeof ch.startTime === 'number' ? ch.startTime : 0,
            endTime: typeof ch.endTime === 'number' ? ch.endTime : 0,
          }));
          if (duration == null && chapters.length > 0) {
            const lastEnd = Math.max(...chapters.map((c) => c.endTime));
            if (lastEnd > 0) duration = lastEnd;
          }
        }
      } catch {
        /* ignore invalid JSON */
      }
    }
  }
  return {
    title,
    author,
    description,
    duration,
    series,
    genre,
    curatorNote,
    sections,
    tags,
    seriesNote,
    chapters,
    coverKey: coverKey ?? undefined,
    narrator,
    authorBio,
    narratorBio,
    whyListen,
    atGlance,
    publisher,
    releaseYear,
    language,
    fileSizeBytes,
    isbn,
  };
}

/** Load optional metadata.json and cover from R2 for a given folder. */
export async function loadSidecarMetadata(
  folderPrefix: string,
  signal?: AbortSignal
): Promise<SidecarMetadata | null> {
  const keys = await listKeysWithPrefix(folderPrefix);
  if (keys.length === 0) return null;
  return loadSidecarMetadataFromKeys(keys, signal);
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
  const duration = sidecar?.duration ?? embedded?.duration ?? 0;
  const series = sidecar?.series;
  const genre = sidecar?.genre;
  const curatorNote = sidecar?.curatorNote;
  const sections = sidecar?.sections;
  const tags = sidecar?.tags;
  const seriesNote = sidecar?.seriesNote;
  const chapters: ChapterInfo[] =
    sidecar?.chapters?.length ? sidecar.chapters : embedded?.chapters ?? [];
  const narrator = sidecar?.narrator;
  const authorBio = sidecar?.authorBio;
  const narratorBio = sidecar?.narratorBio;
  const whyListen = sidecar?.whyListen;
  const atGlance = sidecar?.atGlance;
  const publisher = sidecar?.publisher;
  const releaseYear = sidecar?.releaseYear;
  const language = sidecar?.language;
  const fileSizeBytes = sidecar?.fileSizeBytes;
  const isbn = sidecar?.isbn;

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
    series,
    genre,
    curatorNote,
    sections,
    tags,
    seriesNote,
    coverDataUrl,
    coverKey,
    chapters,
    narrator,
    authorBio,
    narratorBio,
    whyListen,
    atGlance,
    publisher,
    releaseYear,
    language,
    fileSizeBytes,
    isbn,
  };
}
