'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase';
import {
  getAudiobook,
  getStreamUrls,
  getMetadataCached,
  getCoverBlobUrl,
  fetchStreamAsBlob,
  type AudiobookDto,
  type StreamUrlDto,
  type MetadataDto,
} from '@/lib/api';
import {
  getOfflineBlob,
  hasOfflineAudiobook,
  saveOfflineBlob,
} from '@/lib/offline';

export type PlayerChapter = { index: number; title: string; startTime: number; endTime: number };

export type PlayerState = {
  id: string | null;
  audiobook: AudiobookDto | null;
  metadata: MetadataDto | null;
  streamUrls: StreamUrlDto[];
  loading: boolean;
  error: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  currentIndex: number;
  playbackRate: number;
  offlineReady: boolean;
  downloading: boolean;
  coverUrl: string | null;
};

const initialState: PlayerState = {
  id: null,
  audiobook: null,
  metadata: null,
  streamUrls: [],
  loading: false,
  error: null,
  playing: false,
  currentTime: 0,
  duration: 0,
  currentIndex: 0,
  playbackRate: 1,
  offlineReady: false,
  downloading: false,
  coverUrl: null,
};

type PlayerContextValue = PlayerState & {
  loadBook: (id: string) => void;
  clearBook: () => void;
  togglePlay: () => void;
  skipBack: () => void;
  skipForward: () => void;
  goPrevPart: () => void;
  goNextPart: () => void;
  seek: (percent: number) => void;
  seekToTime: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  download: () => Promise<void>;
  canPlay: boolean;
  isMobile: boolean;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

export function usePlayerOptional() {
  return useContext(PlayerContext);
}

const PREFERRED_RATE_KEY = 'liberia-preferred-speed';

function getPreferredSpeed(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const s = localStorage.getItem(PREFERRED_RATE_KEY);
    const n = parseFloat(s ?? '1');
    return [1, 1.25, 1.5, 1.75, 2].includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>(initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const coverUrlRef = useRef<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const h = () => setIsMobile(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const canPlay = state.offlineReady;

  const loadedIdRef = useRef<string | null>(null);

  const loadBook = useCallback(async (id: string) => {
    if (loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    setState((s) => ({ ...s, id, loading: true, error: null }));

    const supabase = createClient();
    if (!supabase) {
      setState((s) => ({ ...s, loading: false, error: 'Supabase not configured' }));
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';
    const userId = session?.user?.id;

    try {
      const [book, urls, meta] = await Promise.all([
        getAudiobook(id, token),
        getStreamUrls(id, token),
        getMetadataCached(id, token, userId).catch(() => null),
      ]);
      const metadata = meta ?? null;

      let offlineReady = false;
      if (userId) {
        offlineReady = await hasOfflineAudiobook(userId, id, book.sourceFileCount);
      }

      let coverUrl: string | null = null;
      if (metadata && !metadata.coverDataUrl) {
        coverUrl = await getCoverBlobUrl(id, token);
        if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current);
        coverUrlRef.current = coverUrl;
      }

      const preferredRate = getPreferredSpeed();

      loadedIdRef.current = id;
      setState({
        id,
        audiobook: book,
        metadata,
        streamUrls: urls,
        loading: false,
        error: null,
        playing: false,
        currentTime: 0,
        duration: 0,
        currentIndex: 0,
        playbackRate: preferredRate,
        offlineReady,
        downloading: false,
        coverUrl: metadata?.coverDataUrl ?? coverUrl,
      });
    } catch (e) {
      loadedIdRef.current = null;
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load',
      }));
    }
  }, []);

  const clearBook = useCallback(() => {
    loadedIdRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (coverUrlRef.current) {
      URL.revokeObjectURL(coverUrlRef.current);
      coverUrlRef.current = null;
    }
    setState(initialState);
  }, []);

  useEffect(() => {
    if (!state.audiobook || state.streamUrls.length === 0) return;

    const audio = audioRef.current ?? new Audio();
    if (!audioRef.current) audioRef.current = audio;
    audio.playbackRate = state.playbackRate;

    let cancelled = false;

    const onTimeUpdate = () => {
      if (!cancelled) setState((s) => ({ ...s, currentTime: audio.currentTime }));
    };
    const onLoadedMetadata = () => {
      if (!cancelled) setState((s) => ({ ...s, duration: audio.duration }));
    };
    const onEnded = () => {
      if (cancelled) return;
      setState((s) => {
        if (s.currentIndex < s.streamUrls.length - 1) {
          return { ...s, playing: false, currentIndex: s.currentIndex + 1 };
        }
        return { ...s, playing: false };
      });
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    (async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      const { id, currentIndex, streamUrls, offlineReady: off } = state;

      if (session?.user?.id) {
        const blob = await getOfflineBlob(session.user.id, id!, currentIndex);
        if (blob && !cancelled) {
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = URL.createObjectURL(blob);
          audio.src = blobUrlRef.current;
        }
      }
    })();

    return () => {
      cancelled = true;
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [
    state.audiobook,
    state.id,
    state.currentIndex,
    state.streamUrls,
    state.playbackRate,
    state.offlineReady,
  ]);

  const togglePlay = useCallback(() => {
    if (!canPlay) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (state.playing) audio.pause();
    else audio.play();
    setState((s) => ({ ...s, playing: !s.playing }));
  }, [canPlay, state.playing]);

  const skipBack = useCallback(() => {
    if (!canPlay) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  }, [canPlay]);

  const skipForward = useCallback(() => {
    if (!canPlay) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30);
  }, [canPlay]);

  const goPrevPart = useCallback(() => {
    if (!canPlay) return;
    setState((s) => (s.currentIndex > 0 ? { ...s, currentIndex: s.currentIndex - 1 } : s));
  }, [canPlay]);

  const goNextPart = useCallback(() => {
    if (!canPlay) return;
    setState((s) =>
      s.currentIndex < s.streamUrls.length - 1 ? { ...s, currentIndex: s.currentIndex + 1 } : s
    );
  }, [canPlay, state.streamUrls.length]);

  const seek = useCallback(
    (percent: number) => {
      if (!canPlay) return;
      const audio = audioRef.current;
      if (!audio || !state.duration) return;
      audio.currentTime = (percent / 100) * state.duration;
    },
    [canPlay, state.duration]
  );

  const seekToTime = useCallback(
    (seconds: number) => {
      if (!canPlay) return;
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = seconds;
    },
    [canPlay]
  );

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
    try {
      localStorage.setItem(PREFERRED_RATE_KEY, String(rate));
    } catch {}
    setState((s) => ({ ...s, playbackRate: rate }));
  }, []);

  const download = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session.user?.id || !state.audiobook) return;

    setState((s) => ({ ...s, downloading: true }));
    try {
      for (let i = 0; i < state.streamUrls.length; i++) {
        const blob = await fetchStreamAsBlob(state.streamUrls[i].url);
        await saveOfflineBlob(session.user.id, state.id!, i, blob);
      }
      setState((s) => ({ ...s, offlineReady: true, downloading: false }));
    } catch (e) {
      console.error(e);
      setState((s) => ({ ...s, downloading: false }));
    }
  }, [state.audiobook, state.streamUrls, state.id]);

  const value: PlayerContextValue = {
    ...state,
    loadBook,
    clearBook,
    togglePlay,
    skipBack,
    skipForward,
    goPrevPart,
    goNextPart,
    seek,
    seekToTime,
    setPlaybackRate,
    download,
    canPlay,
    isMobile,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
