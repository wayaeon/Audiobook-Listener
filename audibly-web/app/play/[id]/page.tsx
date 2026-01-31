'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePlayer } from '@/lib/PlayerContext';
import { displayTitle } from '@/lib/displayTitle';
import {
  IconBack,
  IconPrevPart,
  IconSkipBack,
  IconPlay,
  IconPause,
  IconSkipForward,
  IconNextPart,
} from '@/app/components/PlayerIcons';

const RATES = [1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(d: number): string {
  const h = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)}MB`;
}

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const player = usePlayer();

  useEffect(() => {
    if (id) player.loadBook(id);
  }, [id, player.loadBook]);

  useEffect(() => {
    if (!player.loading && player.audiobook && !player.offlineReady) {
      player.clearBook();
      router.replace(`/audiobook/${encodeURIComponent(id)}`);
    }
  }, [player.loading, player.audiobook, player.offlineReady, id, router, player.clearBook]);

  if (player.loading)
    return (
      <main className="player-page">
        <div className="player-loading">Loading…</div>
      </main>
    );
  if (player.error)
    return (
      <main className="player-page">
        <p className="player-error">{player.error}</p>
        <Link href="/library" className="player-back">
          <IconBack /> <span>Library</span>
        </Link>
      </main>
    );
  if (!player.audiobook) return null;

  const displayTitle_ = displayTitle(player.metadata?.title ?? player.audiobook.title ?? '');
  const displayAuthor = player.metadata?.author ?? player.audiobook.author ?? '';
  const chapters = player.metadata?.chapters ?? [];
  const progressPercent = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;
  const showDownloadRequired = !player.offlineReady && player.streamUrls.length > 0;

  const currentChapter = chapters.find(
    (ch) => player.currentTime >= ch.startTime && player.currentTime < (ch.endTime ?? Infinity)
  );
  const currentChapterTitle = currentChapter?.title ?? null;

  const totalDurationSec = player.audiobook.duration ?? 0;
  const estimatedSizeBytes = totalDurationSec * 16000;
  const remainingSec = player.duration > 0 ? player.duration - player.currentTime : 0;

  return (
    <main
      className={`player-page ${player.playing ? 'playing' : ''} ${
        showDownloadRequired ? 'player-download-required' : ''
      }`}
    >
      <div className="player-backdrop" />
      <div className="player-overlay" />
      <div className="player-content">
        <Link href="/library" className="player-back" aria-label="Back to Library">
          <IconBack />
        </Link>
        <div className="player-cover-wrap">
          {player.metadata?.coverDataUrl ?? player.coverUrl ? (
            <img
              src={player.metadata?.coverDataUrl ?? player.coverUrl ?? ''}
              alt=""
              className="player-cover-img"
            />
          ) : (
            <div className="player-cover" />
          )}
        </div>
        <div className="player-title-artist">
          <h1 className="player-title">{displayTitle_}</h1>
          {displayAuthor ? <p className="player-author">{displayAuthor}</p> : null}
        </div>
        {player.metadata?.description && !showDownloadRequired ? (
          <p className="player-description">{player.metadata.description}</p>
        ) : null}

        {/* Single context-aware CTA: Download or Resume */}
        <div className="player-actions player-actions-primary">
          {!player.canPlay && player.streamUrls.length > 0 && (
            <button
              type="button"
              onClick={player.download}
              disabled={player.downloading}
              className="player-cta-btn player-cta-download"
            >
              {player.downloading ? (
                'Downloading…'
              ) : (
                <>
                  <span className="player-cta-icon">⬇</span>
                  Download • {formatDuration(totalDurationSec)} • ~{formatSize(estimatedSizeBytes)}
                </>
              )}
            </button>
          )}
          {player.canPlay && (
            <button
              type="button"
              onClick={player.togglePlay}
              disabled={!player.canPlay}
              className="player-cta-btn player-cta-resume"
            >
              <span className="player-cta-icon">{player.playing ? '⏸' : '▶'}</span>
              {player.playing ? 'Pause' : 'Resume'}
              {currentChapterTitle && (
                <span className="player-cta-sub"> • {currentChapterTitle}</span>
              )}
              {remainingSec > 0 && (
                <span className="player-cta-sub"> • {formatTime(remainingSec)} left</span>
              )}
            </button>
          )}
        </div>

        {/* Transport controls – semantic weight: Play dominant, Skip secondary, Chapter tertiary */}
        <div className={`player-controls ${!player.canPlay ? 'player-controls-disabled' : ''}`}>
          <button
            type="button"
            onClick={player.goPrevPart}
            className="player-btn player-btn-tertiary"
            title="Previous part"
            aria-label="Previous part"
            disabled={!player.canPlay}
          >
            <IconPrevPart />
          </button>
          <button
            type="button"
            onClick={player.skipBack}
            className="player-btn player-btn-secondary"
            title="Skip back 10 seconds"
            aria-label="Skip back 10 seconds"
            disabled={!player.canPlay}
          >
            <IconSkipBack />
          </button>
          <button
            type="button"
            onClick={player.togglePlay}
            className="player-btn player-btn-play"
            title={player.canPlay ? (player.playing ? 'Pause' : 'Play') : 'Download to listen'}
            aria-label={player.canPlay ? (player.playing ? 'Pause' : 'Play') : 'Download to listen'}
            disabled={!player.canPlay}
          >
            {player.playing ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            onClick={player.skipForward}
            className="player-btn player-btn-secondary"
            title="Skip forward 30 seconds"
            aria-label="Skip forward 30 seconds"
            disabled={!player.canPlay}
          >
            <IconSkipForward />
          </button>
          <button
            type="button"
            onClick={player.goNextPart}
            className="player-btn player-btn-tertiary"
            title="Next part"
            aria-label="Next part"
            disabled={!player.canPlay}
          >
            <IconNextPart />
          </button>
        </div>

        {/* Progress bar – with chapter title */}
        <div className={`player-progress-wrap ${!player.canPlay ? 'player-progress-disabled' : ''}`}>
          {currentChapterTitle && (
            <p className="player-progress-chapter">{currentChapterTitle}</p>
          )}
          <div className="player-progress-row">
            <span className="player-time player-time-current">{formatTime(player.currentTime)}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={progressPercent}
              onChange={(e) => player.seek(Number(e.target.value))}
              className="player-progress"
              aria-label="Playback position"
              disabled={!player.canPlay}
            />
            <span className="player-time player-time-duration">
              {player.duration ? formatTime(player.duration) : '—'}
            </span>
          </div>
        </div>

        {player.audiobook.sourceFileCount > 1 && (
          <p className="player-part">
            Part {player.currentIndex + 1} of {player.audiobook.sourceFileCount}
          </p>
        )}

        {chapters.length > 0 && player.canPlay && (
          <div className="player-chapters">
            <p className="player-chapters-title">Chapters</p>
            <ul className="player-chapters-list">
              {chapters.map((ch) => (
                <li key={ch.index}>
                  <button
                    type="button"
                    className="player-chapter-btn"
                    onClick={() => player.seekToTime(ch.startTime)}
                  >
                    {ch.title}{' '}
                    <span className="player-chapter-time">{formatTime(ch.startTime)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Speed – collapsed, expandable */}
        <details className="player-speed-details">
          <summary className="player-speed-summary">
            Speed • {player.playbackRate === 1 ? '1×' : `${player.playbackRate}×`}
          </summary>
          <div className="player-speed-options">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                className={`player-speed-btn ${player.playbackRate === r ? 'player-speed-btn-active' : ''}`}
                onClick={() => player.setPlaybackRate(r)}
              >
                {r === 1 ? '1×' : `${r}×`}
              </button>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}
