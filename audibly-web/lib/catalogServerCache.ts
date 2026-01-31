import type { AudiobookEntry } from './catalog';

const TTL_MS = 2 * 60 * 1000; // 2 minutes

let cached: { entries: AudiobookEntry[]; ts: number } | null = null;

export function getCachedCatalog(): AudiobookEntry[] | null {
  if (!cached || Date.now() - cached.ts > TTL_MS) return null;
  return cached.entries;
}

export function setCachedCatalog(entries: AudiobookEntry[]): void {
  cached = { entries, ts: Date.now() };
}
