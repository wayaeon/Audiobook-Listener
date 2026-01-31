'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { getAudiobook, getStreamUrls, getMetadataCached, getCoverBlobUrl, fetchStreamAsBlob, type AudiobookDto, type StreamUrlDto, type MetadataDto } from '@/lib/api';
import { getOfflineBlob, hasOfflineAudiobook, saveOfflineBlob } from '@/lib/offline';
import { displayTitle } from '@/lib/displayTitle';
import { IconBack, IconPrevPart, IconSkipBack, IconPlay, IconPause, IconSkipForward, IconNextPart } from '@/app/components/PlayerIcons';
import Link from 'next/link';

export default function PlayPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [audiobook, setAudiobook] = useState<AudiobookDto | null>(null);
  const [streamUrls, setStreamUrls] = useState<StreamUrlDto[]>([]);
  const [metadata, setMetadata] = useState<MetadataDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [offlineReady, setOfflineReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [coverBlobUrl, setCoverBlobUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const coverBlobUrlRef = useRef<string | null>(null);

  const loadBook = useCallback(async (accessToken: string, userId: string | undefined) => {
    try {
      const [book, urls, meta] = await Promise.all([
        getAudiobook(id, accessToken),
        getStreamUrls(id, accessToken),
        getMetadataCached(id, accessToken, userId).catch(() => null),
      ]);
      setAudiobook(book);
      setStreamUrls(urls);
      setMetadata(meta ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setLoading(false); setError('Supabase not configured'); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token ?? '';
      const userId = session?.user?.id;
      loadBook(token, userId);
    });
  }, [loadBook]);

  useEffect(() => {
    if (!audiobook || !streamUrls.length) return;
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        hasOfflineAudiobook(session.user.id, id, audiobook.sourceFileCount).then(setOfflineReady);
      }
    });
  }, [audiobook, id, audiobook?.sourceFileCount]);

  useEffect(() => {
    if (!metadata || metadata.coverDataUrl || !id) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const token = session?.access_token;
      if (!token || cancelled) return;
      const url = await getCoverBlobUrl(id, token);
      if (cancelled) return;
      if (coverBlobUrlRef.current) URL.revokeObjectURL(coverBlobUrlRef.current);
      coverBlobUrlRef.current = url ?? null;
      setCoverBlobUrl(url ?? null);
    });
    return () => {
      cancelled = true;
      if (coverBlobUrlRef.current) {
        URL.revokeObjectURL(coverBlobUrlRef.current);
        coverBlobUrlRef.current = null;
      }
    };
  }, [id, metadata?.coverDataUrl, metadata]);

  useEffect(() => {
    if (!audiobook || streamUrls.length === 0) return;

    const audio = audioRef.current ?? new Audio();
    if (!audioRef.current) audioRef.current = audio;
    audio.playbackRate = playbackRate;

    let cancelled = false;

    const onTimeUpdate = () => { if (!cancelled) setCurrentTime(audio.currentTime); };
    const onLoadedMetadata = () => { if (!cancelled) setDuration(audio.duration); };
    const onEnded = () => {
      if (cancelled) return;
      setPlaying(false);
      if (currentIndex < streamUrls.length - 1) setCurrentIndex((i) => i + 1);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    (async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const blob = await getOfflineBlob(session.user.id, id, currentIndex);
        if (blob && !cancelled) {
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = URL.createObjectURL(blob);
          audio.src = blobUrlRef.current;
          return;
        }
      }
      if (!cancelled && streamUrls[currentIndex]) {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        const entry = streamUrls[currentIndex];
        audio.src = entry.contentUrl ?? entry.url;
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
  }, [audiobook, id, currentIndex, streamUrls, playbackRate]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
    setPlaying(!playing);
  }

  function skipBack() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  }

  function skipForward() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30);
  }

  function goPrevPart() {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  function goNextPart() {
    if (currentIndex < streamUrls.length - 1) setCurrentIndex(currentIndex + 1);
  }

  function onProgressChange(percent: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = (percent / 100) * duration;
    setCurrentTime(audio.currentTime);
  }

  function seekToChapter(startTimeSeconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = startTimeSeconds;
    setCurrentTime(startTimeSeconds);
  }

  const displayTitle_ = metadata?.title ?? audiobook?.title ?? '';
  const displayAuthor = metadata?.author ?? audiobook?.author ?? '';
  const chapters = metadata?.chapters ?? [];
  const RATES = [1, 1.25, 1.5, 1.75, 2];

  async function handleDownload() {
    const supabase = createClient();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session.user?.id || !audiobook) return;
    setDownloading(true);
    try {
      for (let i = 0; i < streamUrls.length; i++) {
        const blob = await fetchStreamAsBlob(streamUrls[i].url);
        await saveOfflineBlob(session.user.id, id, i, blob);
      }
      setOfflineReady(true);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <main className="player-page"><div className="player-loading">Loading…</div></main>;
  if (error) return <main className="player-page"><p className="player-error">{error}</p><Link href="/library" className="player-back"><IconBack /> <span>Library</span></Link></main>;
  if (!audiobook) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <main className={`player-page ${playing ? 'playing' : ''}`}>
      <div className="player-backdrop" />
      <div className="player-overlay" />
      <div className="player-content">
        <Link href="/library" className="player-back" aria-label="Back to Library"><IconBack /></Link>
        <div className="player-cover-wrap">
          {(metadata?.coverDataUrl ?? coverBlobUrl) ? (
            <img src={metadata?.coverDataUrl ?? coverBlobUrl ?? ''} alt="" className="player-cover-img" />
          ) : (
            <div className="player-cover" />
          )}
        </div>
        <div className="player-title-artist">
          <h1 className="player-title">{displayTitle(displayTitle_)}</h1>
          {displayAuthor ? <p className="player-author">{displayAuthor}</p> : null}
        </div>
        {metadata?.description ? (
          <p className="player-description">{metadata.description}</p>
        ) : null}
        <div className="player-controls">
          <button type="button" onClick={goPrevPart} className="player-btn" title="Previous part" aria-label="Previous part"><IconPrevPart /></button>
          <button type="button" onClick={skipBack} className="player-btn" title="Skip back 10 seconds" aria-label="Skip back 10 seconds"><IconSkipBack /></button>
          <button type="button" onClick={togglePlay} className="player-btn player-btn-play" title={playing ? 'Pause' : 'Play'} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button type="button" onClick={skipForward} className="player-btn" title="Skip forward 30 seconds" aria-label="Skip forward 30 seconds"><IconSkipForward /></button>
          <button type="button" onClick={goNextPart} className="player-btn" title="Next part" aria-label="Next part"><IconNextPart /></button>
        </div>
        <div className="player-progress-wrap">
          <span className="player-time player-time-current">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={progressPercent}
            onChange={(e) => onProgressChange(Number(e.target.value))}
            className="player-progress"
            aria-label="Playback position"
          />
          <span className="player-time player-time-duration">{duration ? formatTime(duration) : '—'}</span>
        </div>
        {audiobook.sourceFileCount > 1 && (
          <p className="player-part">Part {currentIndex + 1} of {audiobook.sourceFileCount}</p>
        )}
        {chapters.length > 0 && (
          <div className="player-chapters">
            <p className="player-chapters-title">Chapters</p>
            <ul className="player-chapters-list">
              {chapters.map((ch) => (
                <li key={ch.index}>
                  <button type="button" className="player-chapter-btn" onClick={() => seekToChapter(ch.startTime)}>
                    {ch.title} <span className="player-chapter-time">{formatTime(ch.startTime)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="player-speed-wrap">
          <span className="player-speed-label">Speed</span>
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              className={`player-speed-btn ${playbackRate === r ? 'player-speed-btn-active' : ''}`}
              onClick={() => {
                setPlaybackRate(r);
                const a = audioRef.current;
                if (a) a.playbackRate = r;
              }}
            >
              {r === 1 ? '1×' : `${r}×`}
            </button>
          ))}
        </div>
        <div className="player-actions">
          {!offlineReady && streamUrls.length > 0 && (
            <button type="button" onClick={handleDownload} disabled={downloading} className="player-download">
              {downloading ? 'Downloading…' : 'Download for offline'}
            </button>
          )}
          {offlineReady && <span className="player-offline">Available offline</span>}
        </div>
      </div>
    </main>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
