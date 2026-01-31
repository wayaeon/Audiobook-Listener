'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { hasOfflineAudiobook } from '@/lib/offline';
import { useAuth } from '@/lib/AuthContext';
import { useCatalog } from '@/lib/catalogCache';

const CACHE_KEY = 'audibly_offline_ids';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function loadCache(userId: string): Set<string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}_${userId}`);
    if (!raw) return null;
    const { ids, ts } = JSON.parse(raw) as { ids: string[]; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return new Set(ids);
  } catch {
    return null;
  }
}

function saveCache(userId: string, ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${CACHE_KEY}_${userId}`,
      JSON.stringify({ ids: [...ids], ts: Date.now() })
    );
  } catch {}
}

type OfflineIdsContextValue = {
  offlineIds: Set<string>;
  addOfflineId: (id: string) => void;
};

const OfflineIdsContext = createContext<OfflineIdsContextValue | null>(null);

export function OfflineIdsProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const { catalog: audiobooks } = useCatalog();
  const [offlineIds, setOfflineIds] = useState<Set<string>>(new Set());
  const checkDoneRef = useRef(false);

  useEffect(() => {
    if (!userId || !audiobooks.length) return;
    const cached = loadCache(userId);
    if (cached) {
      setOfflineIds(cached);
      const uncached = audiobooks.filter((b) => !cached.has(b.id));
      if (uncached.length === 0) return;
      let cancelled = false;
      (async () => {
        const ids = new Set(cached);
        for (const book of uncached) {
          if (cancelled) return;
          const ok = await hasOfflineAudiobook(userId, book.id, book.sourceFileCount);
          if (ok) ids.add(book.id);
        }
        if (!cancelled) {
          setOfflineIds(ids);
          saveCache(userId, ids);
        }
      })();
      return () => { cancelled = true; };
    }
    if (checkDoneRef.current) return;
    checkDoneRef.current = true;
    let cancelled = false;
    (async () => {
      const ids = new Set<string>();
      for (const book of audiobooks) {
        if (cancelled) return;
        const ok = await hasOfflineAudiobook(userId, book.id, book.sourceFileCount);
        if (ok) ids.add(book.id);
      }
      if (!cancelled) {
        setOfflineIds(ids);
        saveCache(userId, ids);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, audiobooks]);

  const addOfflineId = useCallback((id: string) => {
    setOfflineIds((prev) => {
      const next = new Set(prev).add(id);
      if (userId) saveCache(userId, next);
      return next;
    });
  }, [userId]);

  const value: OfflineIdsContextValue = { offlineIds, addOfflineId };

  return (
    <OfflineIdsContext.Provider value={value}>
      {children}
    </OfflineIdsContext.Provider>
  );
}

export function useOfflineIds(): OfflineIdsContextValue {
  const ctx = useContext(OfflineIdsContext);
  if (!ctx) {
    return {
      offlineIds: new Set(),
      addOfflineId: () => {},
    };
  }
  return ctx;
}
