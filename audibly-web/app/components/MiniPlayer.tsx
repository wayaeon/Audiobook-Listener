'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlayerOptional } from '@/lib/PlayerContext';
import { displayTitle } from '@/lib/displayTitle';
import { IconPlay, IconPause } from './PlayerIcons';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MiniPlayer() {
  const pathname = usePathname();
  const player = usePlayerOptional();

  if (!player?.id) return null;

  if (pathname?.startsWith('/play/')) return null;

  const isOuterPage = pathname === '/login' || pathname === '/onboarding';
  if (isOuterPage) return null;

  const title = displayTitle(player.metadata?.title ?? player.audiobook?.title ?? '');
  const coverUrl = player.metadata?.coverDataUrl ?? player.coverUrl ?? '';
  const progressPercent =
    player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;

  return (
    <Link
      href={`/play/${encodeURIComponent(player.id)}`}
      className="mini-player"
      aria-label={`Now playing: ${title}. Tap to open full player.`}
    >
      <div className="mini-player-progress-bar" style={{ width: `${progressPercent}%` }} />
      <div className="mini-player-inner">
        <div className="mini-player-cover">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="mini-player-cover-img" />
          ) : (
            <div className="mini-player-cover-placeholder" />
          )}
        </div>
        <div className="mini-player-info">
          <span className="mini-player-title">{title}</span>
          <span className="mini-player-time">
            {formatTime(player.currentTime)}
            {player.duration ? ` / ${formatTime(player.duration)}` : ''}
          </span>
        </div>
        <button
          type="button"
          className="mini-player-play-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            player.togglePlay();
          }}
          aria-label={player.playing ? 'Pause' : 'Play'}
        >
          {player.playing ? <IconPause /> : <IconPlay />}
        </button>
      </div>
    </Link>
  );
}
