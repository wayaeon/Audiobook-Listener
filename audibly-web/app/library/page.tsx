'use client';

import { useMemo, useState } from 'react';
import { useCatalog } from '@/lib/catalogCache';
import { useCoverUrls, PLACEHOLDER_COVER } from '@/lib/useCoverUrls';
import { useAuth } from '@/lib/AuthContext';
import { displayTitle } from '@/lib/displayTitle';
import Link from 'next/link';

type SortOption = 'title' | 'author' | 'duration' | 'recent';

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function LibraryPage() {
  const { catalog: audiobooks, loading, error } = useCatalog();
  const { accessToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = q
      ? audiobooks.filter(
          (b) =>
            (b.title || '').toLowerCase().includes(q) ||
            (b.author || '').toLowerCase().includes(q)
        )
      : [...audiobooks];

    list.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'author':
          return (a.author || '').localeCompare(b.author || '');
        case 'duration':
          return (b.duration || 0) - (a.duration || 0);
        default:
          return 0;
      }
    });
    return list;
  }, [audiobooks, searchQuery, sortBy]);

  const coverUrls = useCoverUrls(filteredAndSorted, accessToken);

  return (
    <main className="page-with-nav library-page">
      {!loading && !error && audiobooks.length > 0 && (
        <>
          <header className="library-page-header">
            <h1 className="page-title">Library</h1>
            <p className="library-page-subtitle">{audiobooks.length} audiobooks</p>
          </header>

          <div className="library-filters">
            <div className="library-search-wrap">
              <SearchIcon />
              <input
                type="search"
                placeholder="Search by title or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="library-search-input"
                aria-label="Search library"
              />
            </div>
            <div className="library-sort-wrap">
              <label htmlFor="library-sort" className="library-sort-label">
                Sort
              </label>
              <select
                id="library-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="library-sort-select"
              >
                <option value="recent">Recent</option>
                <option value="title">Title A–Z</option>
                <option value="author">Author A–Z</option>
                <option value="duration">Longest first</option>
              </select>
            </div>
          </div>
        </>
      )}

      {loading && (
        <div className="library-loading">
          Loading library…
        </div>
      )}

      {error && (
        <div className="library-error">
          {error}
        </div>
      )}

      {!loading && !error && audiobooks.length > 0 && (
        <>
          {filteredAndSorted.length === 0 ? (
            <div className="library-empty-search">
              <p>No results for &ldquo;{searchQuery}&rdquo;</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="library-clear-search"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="card-grid card-grid-library">
              {filteredAndSorted.map((book) => (
                <Link
                  key={book.id}
                  href={`/audiobook/${encodeURIComponent(book.id)}`}
                  className="book-card-wrapper library-book-card"
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
                      <div className="book-card-play-overlay" aria-hidden>
                        <span className="book-card-play-icon">
                          <PlayIcon />
                        </span>
                      </div>
                    </div>
                    <div className="book-card-info library-book-info">
                      <div className="book-card-title library-book-title">
                        {displayTitle(book.title)}
                      </div>
                      <div className="book-card-author library-book-author">
                        {book.author || 'Unknown'}
                      </div>
                      {book.duration > 0 && (
                        <div className="library-book-duration">
                          {formatDuration(book.duration)}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !error && audiobooks.length === 0 && (
        <div className="library-empty">
          <div className="library-empty-icon">📚</div>
          <h2>No audiobooks yet</h2>
          <p>Add m4b files to your R2 bucket to get started</p>
        </div>
      )}
    </main>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="18" height="18">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
