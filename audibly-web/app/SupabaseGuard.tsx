'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export function SupabaseGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="hydration-placeholder" aria-hidden suppressHydrationWarning />;
  }

  const supabase = createClient();
  if (!supabase) {
    return (
      <div style={{
        padding: '2rem',
        maxWidth: '32rem',
        margin: '2rem auto',
        background: 'var(--surface, #1a1a1a)',
        borderRadius: '8px',
        color: 'var(--text, #f5f5f5)',
      }}>
        <h1 style={{ marginTop: 0 }}>Supabase not configured</h1>
        <p>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (or new publishable key <code>sb_publishable_...</code>) to <code>.env.local</code>.</p>
        <p>Copy <code>.env.local.example</code> to <code>.env.local</code> and set the values from your Supabase project (Project Settings → API).</p>
      </div>
    );
  }
  return <>{children}</>;
}
