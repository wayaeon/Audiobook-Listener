'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase';
import { getCatalog, type AudiobookDto } from '@/lib/api';

const CACHE_KEY_PREFIX = 'audibly_catalog';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [catalog, setCatalog] = useState<AudiobookDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCatalog = useCallback(async (showStale = false) => {
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

    // Try cache first (instant load)
    const cached = userId ? loadFromStorage(userId) : null;
    if (cached && !showStale) {
      setCatalog(cached.data);
      setLoading(false);
      setError(null);
      // Revalidate in background
      try {
        const fresh = await getCatalog(token);
        setCatalog(fresh);
        if (userId) saveToStorage(userId, fresh);
      } catch (e) {
        // Keep showing cached data
      }
      return;
    }

    if (!showStale) setLoading(true);
    setError(null);
    try {
      const data = await getCatalog(token);
      setCatalog(data);
      if (userId) saveToStorage(userId, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog');
      if (cached) setCatalog(cached.data);
    } finally {
      setLoading(false);
    }
  }, []);

  const mutate = useCallback(() => fetchCatalog(true), [fetchCatalog]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchCatalog();
    });
    return () => subscription.unsubscribe();
  }, [fetchCatalog]);

  const value: CatalogState = {
    catalog: mounted ? catalog : [],
    loading: mounted ? loading : true,
    error: mounted ? error : null,
    needsAuth: mounted ? needsAuth : false,
    mutate,
  };

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
