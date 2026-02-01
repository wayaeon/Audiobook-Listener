'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useCatalog } from '@/lib/catalogCache';
import { displayTitle } from '@/lib/displayTitle';
import { useFilter } from '@/lib/FilterContext';

export function TopBar() {
  const pathname = usePathname();
  const { catalog: audiobooks, loading, needsAuth } = useCatalog();
  const filter = useFilter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const q = searchQuery.trim().toLowerCase();
  const filteredBooks = q
    ? audiobooks.filter(
        (book) =>
          (book.title || '').toLowerCase().includes(q) ||
          (book.author || '').toLowerCase().includes(q) ||
          (book.series || '').toLowerCase().includes(q) ||
          (book.genre || '').toLowerCase().includes(q)
      )
    : [];

  const handleSearchOpen = (open: boolean) => {
    setSearchOpen(open);
    if (!open) setSearchQuery('');
  };

  const handleResultClick = (bookId: string) => {
    handleSearchOpen(false);
    router.push(`/audiobook/${encodeURIComponent(bookId)}`);
  };

  // Hide on pages outside the inner app (login, onboarding, landing, player) or profile
  const isOuterPage =
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname === '/profile' ||
    pathname?.startsWith('/play/') ||
    (needsAuth && pathname === '/');
  if (isOuterPage) {
    return null;
  }

  const showFilter = pathname === '/browse' && filter?.showFilterButton;
  const showBack = pathname?.startsWith('/audiobook/');

  return (
    <>
      <div className="top-bar">
        {showFilter ? (
          <button
            type="button"
            onClick={filter!.openFilter}
            className={`top-bar-btn top-bar-filter-btn ${(filter?.activeFilterCount ?? 0) > 0 ? 'top-bar-filter-btn-active' : ''}`}
            aria-label="Filter"
          >
            <FilterIcon />
            {(filter?.activeFilterCount ?? 0) > 0 && (
              <span className="top-bar-filter-badge">{filter!.activeFilterCount}</span>
            )}
          </button>
        ) : showBack ? (
          <Link href="/browse" className="top-bar-btn" aria-label="Back to Browse">
            <BackIcon />
          </Link>
        ) : (
          <div className="top-bar-spacer" />
        )}
        <button
          type="button"
          onClick={() => handleSearchOpen(true)}
          className="top-bar-btn top-bar-search-btn"
          aria-label="Search audiobooks"
        >
          <SearchIcon />
        </button>
      </div>

      {searchOpen && (
        <div
          className="search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          onClick={() => handleSearchOpen(false)}
        >
          <div
            className="search-overlay-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-overlay-header">
              <input
                type="search"
                placeholder="Search by title, author, series, or genre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="search-overlay-input"
              />
              <button
                type="button"
                onClick={() => handleSearchOpen(false)}
                className="search-overlay-close"
                aria-label="Close search"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="search-overlay-results">
              {loading ? (
                <div className="search-overlay-loading">Loading...</div>
              ) : searchQuery.trim() ? (
                filteredBooks.length > 0 ? (
                  <ul className="search-results-list">
                    {filteredBooks.map((book) => (
                      <li key={book.id}>
                        <button
                          type="button"
                          onClick={() => handleResultClick(book.id)}
                          className="search-result-item"
                        >
                          <div className="search-result-cover">
                            <span>📖</span>
                          </div>
                          <div className="search-result-info">
                            <div className="search-result-title">
                              {displayTitle(book.title)}
                            </div>
                            {book.author && (
                              <div className="search-result-author">{book.author}</div>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="search-overlay-empty">No results found</div>
                )
              ) : (
                <div className="search-overlay-hint">Type to search your audiobooks</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="24" height="24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      width="24"
      height="24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      width="24"
      height="24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
