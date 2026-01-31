'use client';

import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    setIsOffline(!navigator.onLine);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!mounted || !isOffline) return null;

  return (
    <div
      role="status"
      style={{
        padding: '8px 1rem',
        background: '#333',
        color: 'var(--muted)',
        fontSize: 14,
        textAlign: 'center',
      }}
    >
      You&apos;re offline. Downloaded audiobooks are still available to play.
    </div>
  );
}
