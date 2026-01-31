'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase';
import { getCatalog, type AudiobookDto } from '@/lib/api';

const CACHE_KEY_PREFIX = 'audibly_catalog';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const REVALIDATE_STALE_MS = 5 * 60 * 1000; // Revalidate in background after 5 min

type CatalogState = {
  catalog: AudiobookDto[];
  loading: boolean;
  error: string | null;
  needsAuth: boolean;
  mutate: () => Promise<void>;
};

const CatalogContext = createContext<CatalogState | null>(null);

function loadFromStorage(userId: string): { data: AudiobookDto[]; ts: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}_${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: AudiobookDto[]; ts: number };
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(userId: string, data: AudiobookDto[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}_${userId}`,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // ignore quota / parse errors
  }
}

function catalogSame(a: AudiobookDto[], b: AudiobookDto[]): boolean {
  if (a.length !== b.length) return false;
  const aIds = new Set(a.map((x) => x.id));
  for (const x of b) if (!aIds.has(x.id)) return false;
  return true;
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [catalog, setCatalog] = useState<AudiobookDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const fetchInFlight = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCatalog = useCallback(async (forceRefresh = false) => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';
    const userId = session?.user?.id ?? '';

    if (!token) {
      setCatalog([]);
      setLoading(false);
      setNeedsAuth(true);
      return;
    }

    setNeedsAuth(false);

    const cached = userId ? loadFromStorage(userId) : null;
    const useCache = cached && !forceRefresh;
    const cacheAge = cached ? Date.now() - cached.ts : Infinity;

    if (useCache) {
      setCatalog(cached.data);
      setLoading(false);
      setError(null);
      if (cacheAge < REVALIDATE_STALE_MS) return;
      if (fetchInFlight.current) return;
      fetchInFlight.current = true;
      try {
        const fresh = await getCatalog(token);
        if (userId) saveToStorage(userId, fresh);
        setCatalog((prev) => {
          if (catalogSame(prev, fresh)) return prev;
          return fresh;
        });
      } catch {
        // Keep cached
      } finally {
        fetchInFlight.current = false;
      }
      return;
    }

    if (!forceRefresh) setLoading(true);
    setError(null);
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      const data = await getCatalog(token);
      setCatalog(data);
      if (userId) saveToStorage(userId, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog');
      if (cached) setCatalog(cached.data);
    } finally {
      setLoading(false);
      fetchInFlight.current = false;
    }
  }, []);

  const mutate = useCallback(() => fetchCatalog(true), [fetchCatalog]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchCatalog(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchCatalog]);

  const value = useMemo<CatalogState>(
    () => ({
      catalog: mounted ? catalog : [],
      loading: mounted ? loading : true,
      error: mounted ? error : null,
      needsAuth: mounted ? needsAuth : false,
      mutate,
    }),
    [mounted, catalog, loading, error, needsAuth, mutate]
  );

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    return {
      catalog: [],
      loading: true,
      error: 'CatalogProvider not found',
      needsAuth: false,
      mutate: async () => {},
    };
  }
  return ctx;
}
