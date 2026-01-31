import type { MetadataDto } from '@/lib/api';

const MEMORY_TTL_MS = 60 * 60 * 1000; // 1 hour
const STORAGE_KEY_PREFIX = 'audibly_meta';
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type CacheEntry = { data: MetadataDto; ts: number };

const memoryCache = new Map<string, CacheEntry>();

function storageKey(bookId: string, userId: string): string {
  return `${STORAGE_KEY_PREFIX}_${userId}_${bookId}`;
}

function getFromMemory(bookId: string): MetadataDto | null {
  const entry = memoryCache.get(bookId);
  if (!entry || Date.now() - entry.ts > MEMORY_TTL_MS) return null;
  return entry.data;
}

function saveToMemory(bookId: string, data: MetadataDto) {
  memoryCache.set(bookId, { data, ts: Date.now() });
}

function getFromStorage(bookId: string, userId: string): MetadataDto | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(bookId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.ts > STORAGE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function saveToStorage(bookId: string, userId: string, data: MetadataDto) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      storageKey(bookId, userId),
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // ignore
  }
}

export function getCachedMetadata(
  bookId: string,
  userId: string | undefined
): MetadataDto | null {
  const fromMem = getFromMemory(bookId);
  if (fromMem) return fromMem;
  if (userId) {
    const fromStorage = getFromStorage(bookId, userId);
    if (fromStorage) {
      saveToMemory(bookId, fromStorage);
      return fromStorage;
    }
  }
  return null;
}

export function setCachedMetadata(
  bookId: string,
  userId: string | undefined,
  data: MetadataDto
) {
  saveToMemory(bookId, data);
  if (userId) saveToStorage(bookId, userId, data);
}
