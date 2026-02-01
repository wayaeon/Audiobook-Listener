'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { getBatchCoverUrls } from '@/lib/api';
import type { AudiobookDto } from '@/lib/api';

const COVER_CACHE_TTL_MS = 50 * 60 * 1000; // 50 min (presigned URLs last 1hr)
const coverCache = new Map<string, { url: string; ts: number }>();

function getCachedCover(id: string): string | null {
  const entry = coverCache.get(id);
  if (!entry || Date.now() - entry.ts > COVER_CACHE_TTL_MS) return null;
  return entry.url;
}

function setCachedCover(id: string, url: string) {
  coverCache.set(id, { url, ts: Date.now() });
}

export const PLACEHOLDER_COVER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="%23242424"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="48">📚</text></svg>'
);

export function useCoverUrls(
  audiobooks: AudiobookDto[],
  accessToken: string | null
): Record<string, string | null> {
  const fromCatalog = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const b of audiobooks) {
      map[b.id] = b.coverUrl ?? null;
    }
    return map;
  }, [audiobooks]);

  const [fetchedUrls, setFetchedUrls] = useState<Record<string, string | null>>({});
  const idsNeedingFetch = useMemo(() => {
    return audiobooks
      .filter((b) => {
        if (b.coverUrl) return false;
        if (getCachedCover(b.id)) return false;
        return true;
      })
      .map((b) => b.id);
  }, [audiobooks]);
  const idKey = idsNeedingFetch.join(',');
  const prevIdKeyRef = useRef<string>('');

  useEffect(() => {
    if (!idsNeedingFetch.length || !accessToken) return;
    if (idKey === prevIdKeyRef.current) return;
    prevIdKeyRef.current = idKey;
    let cancelled = false;
    getBatchCoverUrls(idsNeedingFetch, accessToken).then((urls) => {
      if (cancelled) return;
      const next: Record<string, string | null> = {};
      for (const id of idsNeedingFetch) {
        const url = urls[id] ?? null;
        if (url) setCachedCover(id, url);
        next[id] = url;
      }
      setFetchedUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [idKey, accessToken]);

  return useMemo(() => {
    const merged = { ...fromCatalog };
    for (const b of audiobooks) {
      if (merged[b.id]) continue;
      const cached = getCachedCover(b.id);
      if (cached) merged[b.id] = cached;
    }
    for (const id of Object.keys(fetchedUrls)) {
      merged[id] = fetchedUrls[id];
    }
    return merged;
  }, [fromCatalog, fetchedUrls, audiobooks]);
}
