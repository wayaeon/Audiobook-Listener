'use client';

import { usePathname } from 'next/navigation';
import { usePlayerOptional } from '@/lib/PlayerContext';

export function MainWithMiniPlayerSpacer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const player = usePlayerOptional();

  const isOnFullPlayer = pathname?.startsWith('/play/');
  const isOuterPage = pathname === '/login' || pathname === '/onboarding';

  const showMiniPlayer = !!player?.id && !isOnFullPlayer && !isOuterPage;

  return (
    <div className={showMiniPlayer ? 'main-with-mini-player' : undefined}>
      {children}
    </div>
  );
}
