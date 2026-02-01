import { listAllKeys, isR2Configured, getPresignedUrl, type R2Object } from './r2';
import { isOneDriveConfigured, buildOneDriveCatalog, getOneDriveStreamUrl } from './onedrive';
import { loadSidecarMetadataFromKeys, type AtGlance } from './metadata';
import { getCachedCatalog, setCachedCatalog } from './catalogServerCache';

export type AudiobookEntry = {
  id: string;
  title: string;
  author: string;
  /** From metadata.json; empty if not present */
  description?: string;
  /** Duration in seconds; from metadata.json or 0 */
  duration?: number;
  /** From metadata.json */
  series?: string;
  /** From metadata.json */
  genre?: string;
  /** 1–2 line curator note */
  curatorNote?: string;
  /** Curated section IDs (e.g. recommended-starting-points) */
  sections?: string[];
  /** Intellectual dimension tags (e.g. big-ideas, practical) */
  tags?: string[];
  /** Reading path guidance for series */
  seriesNote?: string;
  sourceFileCount: number;
  sourceFileKeys: string[];
  chapters: { index: number; title: string; startTime: number; endTime: number }[];
  /** R2 key for cover image if sidecar exists */
  coverKey?: string;
  /** When the audiobook was last modified in storage (for "Recent addition" badge) */
  addedAt?: string;
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

function toStableId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

export async function buildCatalogFromR2(): Promise<AudiobookEntry[]> {
  const allKeys = await listAllKeys();
  const audioKeys = allKeys.filter((o) => o.key.endsWith('.m4b') || o.key.endsWith('.mp3'));
  const byFolder = new Map<string, string[]>();
  const singleFiles: R2Object[] = [];

  for (const obj of audioKeys) {
    const parts = obj.key.replace(/\/$/, '').split('/');
    const fileName = parts[parts.length - 1] ?? '';
    if (parts.length > 1) {
      const folder = parts.slice(0, -1).join('/');
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder)!.push(obj.key);
    } else {
      singleFiles.push(obj);
    }
  }

  const catalog: AudiobookEntry[] = [];
  const entriesToEnrich: { entry: AudiobookEntry; keysInFolder: string[] }[] = [];

  for (const [folder, fileKeys] of Array.from(byFolder.entries())) {
    const sorted = fileKeys.sort((a, b) => a.localeCompare(b));
    const name = folder.split('/').pop() ?? folder;
    const folderPrefix = `${folder}/`;
    const keysInFolder = allKeys.filter((o) => o.key.startsWith(folderPrefix)).map((o) => o.key);
    const audioObjs = audioKeys.filter((o) => o.key.startsWith(folderPrefix));
    const latestMod = audioObjs.reduce<Date | null>((acc, o) => {
      const d = o.lastModified;
      if (!d) return acc;
      return !acc || d > acc ? d : acc;
    }, null);
    const entry: AudiobookEntry = {
      id: toStableId(folder),
      title: name,
      author: '',
      sourceFileCount: sorted.length,
      sourceFileKeys: sorted,
      chapters: [],
      addedAt: latestMod?.toISOString(),
    };
    catalog.push(entry);
    entriesToEnrich.push({ entry, keysInFolder });
  }

  for (const obj of singleFiles) {
    const base = obj.key.replace(/\.(m4b|mp3)$/i, '');
    const title = base.split('/').pop() ?? base;
    const folderPrefix = obj.key.includes('/') ? obj.key.slice(0, obj.key.lastIndexOf('/') + 1) : '';
    const keysInFolder = folderPrefix ? allKeys.filter((o) => o.key.startsWith(folderPrefix)).map((o) => o.key) : [];
    const entry: AudiobookEntry = {
      id: toStableId(obj.key),
      title,
      author: '',
      sourceFileCount: 1,
      sourceFileKeys: [obj.key],
      chapters: [],
      addedAt: obj.lastModified?.toISOString(),
    };
    catalog.push(entry);
    if (keysInFolder.length) entriesToEnrich.push({ entry, keysInFolder });
  }

  try {
    const sidecarResults = await Promise.all(
      entriesToEnrich.map(async ({ keysInFolder }) => {
        try {
          return await loadSidecarMetadataFromKeys(keysInFolder);
        } catch {
          return null;
        }
      })
    );
    for (let i = 0; i < entriesToEnrich.length; i++) {
      const { entry } = entriesToEnrich[i];
      const sidecar = sidecarResults[i];
      if (sidecar?.title) entry.title = sidecar.title;
      if (sidecar?.author) entry.author = sidecar.author;
      if (sidecar?.description != null) entry.description = sidecar.description;
      if (sidecar?.duration != null && sidecar.duration >= 0) entry.duration = sidecar.duration;
      if (sidecar?.series != null) entry.series = sidecar.series;
      if (sidecar?.genre != null) entry.genre = sidecar.genre;
      if (sidecar?.curatorNote != null) entry.curatorNote = sidecar.curatorNote;
      if (sidecar?.sections?.length) entry.sections = sidecar.sections;
      if (sidecar?.tags?.length) entry.tags = sidecar.tags;
      if (sidecar?.seriesNote != null) entry.seriesNote = sidecar.seriesNote;
      if (sidecar?.chapters?.length) entry.chapters = sidecar.chapters;
      if (sidecar?.coverKey) entry.coverKey = sidecar.coverKey;
      if (sidecar?.narrator != null) entry.narrator = sidecar.narrator;
      if (sidecar?.authorBio != null) entry.authorBio = sidecar.authorBio;
      if (sidecar?.narratorBio != null) entry.narratorBio = sidecar.narratorBio;
      if (sidecar?.whyListen?.length) entry.whyListen = sidecar.whyListen;
      if (sidecar?.atGlance != null) entry.atGlance = sidecar.atGlance;
      if (sidecar?.publisher != null) entry.publisher = sidecar.publisher;
      if (sidecar?.releaseYear != null) entry.releaseYear = sidecar.releaseYear;
      if (sidecar?.language != null) entry.language = sidecar.language;
      if (sidecar?.fileSizeBytes != null) entry.fileSizeBytes = sidecar.fileSizeBytes;
      if (sidecar?.isbn != null) entry.isbn = sidecar.isbn;
    }
  } catch {
    /* keep defaults */
  }

  return catalog;
}

export async function getCatalog(): Promise<AudiobookEntry[]> {
  if (isOneDriveConfigured()) {
    const list = await buildOneDriveCatalog();
    return list.map((a) => ({
      ...a,
      sourceFileKeys: a.sourceFileIds,
    }));
  }
  if (isR2Configured()) {
    const cached = getCachedCatalog();
    if (cached) return cached;
    const entries = await buildCatalogFromR2();
    setCachedCatalog(entries);
    return entries;
  }
  return buildCatalogFromR2();
}

export async function getStreamUrlForKey(keyOrItemId: string, expiresIn = 3600): Promise<string | null> {
  if (isR2Configured()) return getPresignedUrl(keyOrItemId, expiresIn);
  if (isOneDriveConfigured()) return getOneDriveStreamUrl(keyOrItemId);
  return null;
}
