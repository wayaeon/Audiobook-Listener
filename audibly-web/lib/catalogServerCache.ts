import type { AudiobookEntry } from './catalog';

const TTL_MS = 5 * 60 * 1000; // 5 minutes

let cached: { entries: AudiobookEntry[]; ts: number } | null = null;

export function getCachedCatalog(): AudiobookEntry[] | null {
  if (!cached || Date.now() - cached.ts > TTL_MS) return null;
  return cached.entries;
}

export function setCachedCatalog(entries: AudiobookEntry[]): void {
  cached = { entries, ts: Date.now() };
}
