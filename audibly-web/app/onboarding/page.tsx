'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.replace('/login');
        return;
      }
      setEmail(session.user.email ?? '');
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', session.user.id)
        .single();
      if (profile?.first_name && profile?.last_name) {
        router.replace('/');
        return;
      }
      setFirstName(profile?.first_name ?? '');
      setLastName(profile?.last_name ?? '');
      setLoading(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    if (!supabase) {
      setSubmitting(false);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.replace('/login');
      return;
    }
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || 'Failed to save profile');
      return;
    }
    router.replace('/');
  }

  if (loading) {
    return (
      <main className="page-with-nav" style={{ padding: 'var(--page-padding)', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="page-with-nav" style={{ padding: 'var(--page-padding)' }}>
      <div
        style={{
          maxWidth: 400,
          margin: '0 auto',
          padding: '2rem',
          background: 'var(--surface)',
          borderRadius: 'var(--overlay-radius-lg)',
        }}
      >
        <h1 style={{ marginBottom: '0.5rem' }}>Welcome</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Please add your name to complete setup.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label>
            <span style={{ display: 'block', marginBottom: 4, color: 'var(--muted)' }}>Email</span>
            <input
              type="email"
              value={email}
              readOnly
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--glass-border)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
              }}
            />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: 4, color: 'var(--muted)' }}>First name</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="Jane"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--surface)',
                border: '1px solid var(--glass-border)',
                borderRadius: 6,
                color: 'inherit',
              }}
            />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: 4, color: 'var(--muted)' }}>Last name</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="Doe"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--surface)',
                border: '1px solid var(--glass-border)',
                borderRadius: 6,
                color: 'inherit',
              }}
            />
          </label>
          {error && <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </main>
  );
}
