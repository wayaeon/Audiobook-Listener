'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCatalog } from '@/lib/catalogCache';
import { displayTitle } from '@/lib/displayTitle';

export function TopBar() {
  const pathname = usePathname();
  const { catalog: audiobooks, loading } = useCatalog();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const filteredBooks = searchQuery.trim()
    ? audiobooks.filter(
        (book) =>
          book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          book.author?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSearchOpen = (open: boolean) => {
    setSearchOpen(open);
    if (!open) setSearchQuery('');
  };

  const handleResultClick = (bookId: string) => {
    handleSearchOpen(false);
    router.push(`/play/${encodeURIComponent(bookId)}`);
  };

  if (pathname?.startsWith('/play/') || pathname === '/login') {
    return null;
  }

  return (
    <>
      <div className="top-bar">
        <button
          type="button"
          onClick={() => handleSearchOpen(true)}
          className="top-bar-search-btn"
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
                placeholder="Search by title or author..."
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
