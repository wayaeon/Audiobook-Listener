'use client';

import { useEffect, useState } from 'react';
import { type AudiobookDto } from '@/lib/api';
import { useCatalog } from '@/lib/catalogCache';
import { useCoverUrls, PLACEHOLDER_COVER } from '@/lib/useCoverUrls';
import { displayTitle } from '@/lib/displayTitle';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

export default function ShelfPage() {
  const { catalog: audiobooks, loading, error } = useCatalog();
  const [filteredBooks, setFilteredBooks] = useState<AudiobookDto[]>([]);
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'recent'>('recent');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const coverUrls = useCoverUrls(filteredBooks, accessToken);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const apply = (token: string | null) => setAccessToken(token);
    supabase.auth.getSession().then(({ data: { session } }) => apply(session?.access_token ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => apply(session?.access_token ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // Sort books
  useEffect(() => {
    const sorted = [...audiobooks];
    sorted.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'author') {
        return (a.author || '').localeCompare(b.author || '');
      }
      return 0; // 'recent' - keep original order
    });
    setFilteredBooks(sorted);
  }, [audiobooks, sortBy]);

  return (
    <main className="page-with-nav" style={{ padding: 'var(--page-padding)' }}>
      {/* Sort Bar */}
      {!loading && !error && audiobooks.length > 0 && (
        <div style={{ 
          marginBottom: 'var(--section-gap)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '0.875rem',
              alignSelf: 'center'
            }}>
              Sort by:
            </span>
            {(['recent', 'title', 'author'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.875rem',
                  background: sortBy === option ? 'var(--accent)' : 'var(--surface-elevated)',
                  color: sortBy === option ? 'white' : 'var(--text)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textTransform: 'capitalize',
                }}
              >
                {option}
              </button>
            ))}
          </div>

          <div style={{ 
            fontSize: '0.875rem', 
            color: 'var(--text-secondary)' 
          }}>
            {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading shelf…
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {!loading && !error && audiobooks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
          <h2 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>Shelf is empty</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Upload m4b files to your R2 bucket to see them here
          </p>
        </div>
      )}

      {!loading && !error && filteredBooks.length > 0 && (
        <div className="card-grid">
          {filteredBooks.map((book) => (
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
                  {book.duration > 0 && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--muted)',
                      marginTop: '4px'
                    }}>
                      {Math.floor(book.duration / 3600)}h {Math.floor((book.duration % 3600) / 60)}m
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
