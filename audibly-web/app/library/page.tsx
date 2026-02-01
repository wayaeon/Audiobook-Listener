'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LibraryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/browse');
  }, [router]);
  return (
    <main className="page-with-nav" style={{ padding: 'var(--page-padding)', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
        <p style={{ margin: 0 }}>Redirecting…</p>
      </div>
    </main>
  );
}
