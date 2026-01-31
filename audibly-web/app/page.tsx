'use client';

import { useState } from 'react';
import { useCatalog } from '@/lib/catalogCache';
import { useCoverUrls, PLACEHOLDER_COVER } from '@/lib/useCoverUrls';
import { useAuth } from '@/lib/AuthContext';
import { displayTitle } from '@/lib/displayTitle';
import Link from 'next/link';
import { getRandomQuote } from '@/lib/quotes';

export default function HomePage() {
  const { catalog: audiobooks, loading, error, needsAuth, mutate } = useCatalog();
  const { accessToken } = useAuth();
  const recentlyAdded = audiobooks.slice(0, 10);
  const coverUrls = useCoverUrls(recentlyAdded, accessToken);

  if (needsAuth && !loading) {
    return <LandingPage />;
  }

  return (
    <main
      className="page-with-nav"
      style={{
        padding: 'var(--page-padding)',
        minHeight: '60vh',
        background: 'var(--bg, #0a0a0a)',
      }}
    >
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--overlay-radius-lg)',
          marginTop: '1rem',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
          <p style={{ margin: 0 }}>Loading your library…</p>
        </div>
      )}

      {error && (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          borderRadius: 'var(--overlay-radius-lg)',
          marginTop: '1rem',
          border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Couldn't load library</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>{error}</p>
          <button
            type="button"
            onClick={() => mutate()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && audiobooks.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--overlay-radius-lg)',
          marginTop: '1rem',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
          <h2 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>No audiobooks yet</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Add m4b files to your R2 bucket to get started
          </p>
        </div>
      )}

      {!loading && !error && audiobooks.length > 0 && (
        <>
          {/* Continue Listening Section - TODO: Implement based on listening progress */}
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Continue Listening</h2>
              <Link href="/library" className="section-action">
                See all
              </Link>
            </div>
            <div className="carousel">
              {recentlyAdded.slice(0, 5).map((book) => (
                <Link
                  key={book.id}
                  href={`/audiobook/${encodeURIComponent(book.id)}`}
                  className="carousel-item"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="book-card">
                    <div className="book-card-cover">
                      {coverUrls[book.id] !== undefined ? (
                        <img
                          src={coverUrls[book.id] ?? PLACEHOLDER_COVER}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="book-card-cover-img book-card-cover-img-loaded"
                        />
                      ) : (
                        <div className="book-card-cover-skeleton" aria-hidden />
                      )}
                    </div>
                    <div className="book-card-info">
                      <div className="book-card-title">{displayTitle(book.title)}</div>
                      {book.author && <div className="book-card-author">{book.author}</div>}
                      {/* TODO: Add progress bar */}
                      <div style={{
                        marginTop: '8px',
                        height: '3px',
                        background: 'var(--surface-elevated)',
                        borderRadius: '999px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: '35%', // Placeholder progress
                          background: 'var(--accent-gradient)',
                        }} />
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginTop: '4px'
                      }}>
                        35% complete
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Recently Added Section */}
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Recently Added</h2>
              <Link href="/shelf" className="section-action">
                Browse all
              </Link>
            </div>
            <div className="card-grid card-grid-compact">
              {recentlyAdded.map((book) => (
                <Link
                  key={book.id}
                  href={`/audiobook/${encodeURIComponent(book.id)}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className="book-card">
                    <div className="book-card-cover">
                      {coverUrls[book.id] !== undefined ? (
                        <img
                          src={coverUrls[book.id] ?? PLACEHOLDER_COVER}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="book-card-cover-img book-card-cover-img-loaded"
                        />
                      ) : (
                        <div className="book-card-cover-skeleton" aria-hidden />
                      )}
                    </div>
                    <div className="book-card-info">
                      <div className="book-card-title">{displayTitle(book.title)}</div>
                      {book.author && <div className="book-card-author">{book.author}</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Quick Stats Card */}
          <section className="section">
            <div className="book-card" style={{ 
              padding: '20px',
              background: 'var(--accent-gradient)',
              cursor: 'default'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.125rem', fontWeight: 600 }}>
                Your Library
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700 }}>{audiobooks.length}</div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Books</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700 }}>0</div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Hours</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700 }}>0</div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Finished</div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function LandingPage() {
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [successView, setSuccessView] = useState<{ firstName: string; quote: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    const submittedFirstName = firstName.trim() || 'there';
    const submittedLastName = lastName.trim();
    const submittedEmail = email.trim();
    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: submittedEmail,
          firstName: submittedFirstName,
          lastName: submittedLastName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const displayName = submittedFirstName === 'there' ? 'there' : submittedFirstName;
        setSuccessView({
          firstName: displayName,
          quote: getRandomQuote(),
        });
        setEmail('');
        setFirstName('');
        setLastName('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to submit request' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="landing-page"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem var(--page-padding)',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        background: 'linear-gradient(165deg, #0c0c10 0%, #12121a 40%, #0a0a0e 100%)',
      }}
    >
      {/* Upper: Libera */}
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

      {/* Middle: buttons */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: 320,
          gap: '0.875rem',
        }}
      >
        {successView ? (
          <div
            style={{
              width: '100%',
              padding: '1.5rem',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <p
              style={{
                margin: '0 0 1rem',
                color: 'rgba(255,255,255,0.95)',
                fontSize: '1rem',
                lineHeight: 1.5,
              }}
            >
              {successView.firstName === 'there'
                ? "Thanks for reaching out. We'll be in touch soon."
                : `Thanks, ${successView.firstName}. We've received your request and will be in touch soon.`}
            </p>
            <blockquote
              style={{
                margin: 0,
                paddingLeft: '1rem',
                borderLeft: '3px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.9375rem',
                fontStyle: 'italic',
                lineHeight: 1.6,
              }}
            >
              {successView.quote}
            </blockquote>
            <button
              type="button"
              onClick={() => { setSuccessView(null); setShowForm(false); }}
              style={{
                marginTop: '1.25rem',
                padding: '0.5rem 1rem',
                background: 'transparent',
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Close
            </button>
          </div>
        ) : !showForm ? (
          <>
            <Link
              href="/login"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.875rem 1.5rem',
                background: 'white',
                color: '#0a0a0a',
                borderRadius: 10,
                fontWeight: 500,
                textDecoration: 'none',
                textAlign: 'center',
                letterSpacing: '0.03em',
                transition: 'opacity 0.15s',
              }}
            >
              Sign in
            </Link>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              style={{
                width: '100%',
                padding: '0.875rem 1.5rem',
                background: 'transparent',
                color: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10,
                fontWeight: 500,
                cursor: 'pointer',
                letterSpacing: '0.03em',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              Request access
            </button>
          </>
        ) : (
          <div
            style={{
              width: '100%',
              padding: '1.5rem',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <h2
              style={{
                margin: '0 0 1rem',
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.8)',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Request access
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="landing-input"
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="landing-input"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
                className="landing-input"
              />
              {message && (
                <p
                  style={{
                    margin: 0,
                    color: message.type === 'success' ? '#86efac' : '#fca5a5',
                    fontSize: '0.8125rem',
                  }}
                >
                  {message.text}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontSize: '0.9375rem',
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    background: 'white',
                    color: '#0a0a0a',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 500,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontSize: '0.9375rem',
                  }}
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Bottom: Forgot password */}
      <Link
        href="/login?forgot=1"
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.875rem',
          textDecoration: 'none',
          marginTop: 'auto',
          paddingTop: '1.5rem',
          transition: 'color 0.15s',
        }}
      >
        Forgot password?
      </Link>
    </main>
  );
}
