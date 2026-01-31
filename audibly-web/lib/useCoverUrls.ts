'use client';

import { useEffect, useState, useMemo } from 'react';
import { getBatchCoverUrls } from '@/lib/api';
import type { AudiobookDto } from '@/lib/api';

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
  const idsNeedingFetch = useMemo(
    () => audiobooks.filter((b) => !b.coverUrl).map((b) => b.id),
    [audiobooks]
  );
  const idKey = idsNeedingFetch.join(',');

  useEffect(() => {
    if (!idsNeedingFetch.length || !accessToken) {
      setFetchedUrls({});
      return;
    }
    let cancelled = false;
    getBatchCoverUrls(idsNeedingFetch, accessToken).then((urls) => {
      if (cancelled) return;
      const next: Record<string, string | null> = {};
      for (const id of idsNeedingFetch) {
        next[id] = urls[id] ?? null;
      }
      setFetchedUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [idKey, accessToken]);

  return useMemo(() => {
    const merged = { ...fromCatalog };
    for (const id of Object.keys(fetchedUrls)) {
      merged[id] = fetchedUrls[id];
    }
    return merged;
  }, [fromCatalog, fetchedUrls]);
}
