'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams?.get('forgot') === '1') setShowForgot(true);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/login`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setForgotSent(true);
  }

  const authLayout = {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '2rem var(--page-padding)',
    paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
    background: 'linear-gradient(165deg, #0c0c10 0%, #12121a 40%, #0a0a0e 100%)',
  };

  const cardStyle = {
    width: '100%',
    maxWidth: 320,
    padding: '1.5rem',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const titleStyle = {
    margin: '0 0 1rem',
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.8)',
    fontWeight: 500 as const,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  };

  const inputClass = 'auth-input';

  if (showForgot) {
    return (
      <main className="auth-page" style={authLayout}>
        <h1
          style={{
            fontFamily: 'ui-serif, Georgia, serif',
            fontSize: 'clamp(2.5rem, 12vw, 4rem)',
            fontWeight: 400,
            margin: '4rem 0 0',
            color: 'white',
            letterSpacing: '0.05em',
          }}
        >
          Libera
        </h1>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <div style={cardStyle}>
            <h2 style={titleStyle}>Reset password</h2>
            {forgotSent ? (
              <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: '0.9375rem' }}>
                Check your email for a link to reset your password.
              </p>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Email"
                  className={inputClass}
                />
                {error && <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.8125rem' }}>{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.625rem',
                    background: 'white',
                    color: '#0a0a0a',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '0.9375rem',
                  }}
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => { setShowForgot(false); setForgotSent(false); setError(null); }}
              style={{
                marginTop: '1rem',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page" style={authLayout}>
      <h1
        style={{
          fontFamily: 'ui-serif, Georgia, serif',
          fontSize: 'clamp(2.5rem, 12vw, 4rem)',
          fontWeight: 400,
          margin: '4rem 0 0',
          color: 'white',
          letterSpacing: '0.05em',
        }}
      >
        Libera
      </h1>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <div style={cardStyle}>
          <h2 style={titleStyle}>Sign in</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              className={inputClass}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              className={inputClass}
            />
            {error && <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.8125rem' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.625rem',
                background: 'white',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: 8,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.9375rem',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.875rem' }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
              Request access from the homepage
            </Link>
          </p>
        </div>
      </div>
      <Link
        href="/login?forgot=1"
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.875rem',
          textDecoration: 'none',
          marginTop: 'auto',
          paddingTop: '1.5rem',
        }}
      >
        Forgot password?
      </Link>
    </main>
  );
}
