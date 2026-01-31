'use client';

import { useEffect, useState } from 'react';
import { useCatalog } from '@/lib/catalogCache';
import { useCoverUrls, PLACEHOLDER_COVER } from '@/lib/useCoverUrls';
import { displayTitle } from '@/lib/displayTitle';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

export default function HomePage() {
  const { catalog: audiobooks, loading, error, needsAuth, mutate } = useCatalog();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const recentlyAdded = audiobooks.slice(0, 10);
  const coverUrls = useCoverUrls(recentlyAdded, accessToken);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const apply = (token: string | null) => setAccessToken(token);
    supabase.auth.getSession().then(({ data: { session } }) => apply(session?.access_token ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => apply(session?.access_token ?? null));
    return () => subscription.unsubscribe();
  }, []);

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

      {needsAuth && !loading && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--overlay-radius-lg)',
          marginTop: '1rem',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
          <h2 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>Sign in</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Sign in to view your audiobook library
          </p>
          <Link href="/login" style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            background: 'var(--accent)',
            color: 'white',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            fontWeight: 600,
          }}>
            Go to sign in
          </Link>
        </div>
      )}

      {!loading && !error && !needsAuth && audiobooks.length === 0 && (
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
                  href={`/play/${encodeURIComponent(book.id)}`}
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
                  href={`/play/${encodeURIComponent(book.id)}`}
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
