'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useCatalog } from '@/lib/catalogCache';
import { useCoverUrls, PLACEHOLDER_COVER } from '@/lib/useCoverUrls';
import { useAuth } from '@/lib/AuthContext';
import { useFilter } from '@/lib/FilterContext';
import { useOfflineIds } from '@/lib/OfflineIdsContext';
import { displayTitle } from '@/lib/displayTitle';
import Link from 'next/link';
import type { AudiobookDto } from '@/lib/api';
import {
  CURATED_SECTION_ORDER,
  CURATED_SECTION_TITLES,
  CURATED_TAG_ORDER,
  CURATED_TAG_TITLES,
  MACRO_GENRE_ORDER,
  MACRO_GENRE_TITLES,
  genreToMacro,
} from '@/lib/curatedConstants';

const INTRO_DISMISSED_KEY = 'libera-dismissed-intro';

const TITLE_MAX_LEN = 30;

function truncateTitle(title: string, maxLen: number = TITLE_MAX_LEN): string {
  const t = displayTitle(title);
  return t.length > maxLen ? t.slice(0, maxLen).trim() + '…' : t;
}

type SortOption = 'title' | 'author' | 'duration' | 'recent' | 'series' | 'genre';

const SKELETON_COUNT = 8;

function BrowseSkeleton() {
  return (
    <div className="browse-skeleton">
      <div className="browse-skeleton-carousel" />
      <div className="card-grid card-grid-browse card-grid-library-skeleton">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <div key={i} className="library-skeleton-card">
            <div className="book-card-cover-skeleton" />
            <div className="library-skeleton-info">
              <div className="library-skeleton-line library-skeleton-title" />
              <div className="library-skeleton-line library-skeleton-author" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="20" height="20">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function getRecentLabel(addedAt: string): string | null {
  const added = new Date(addedAt).getTime();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  if (added >= weekAgo) return 'A recent find';
  if (added >= monthAgo) return 'Added this month';
  return null;
}

export default function BrowsePage() {
  const { catalog: audiobooks, loading, error } = useCatalog();
  const { registerFilter } = useFilter() ?? { registerFilter: () => {} };
  const { accessToken } = useAuth();
  const { offlineIds } = useOfflineIds();
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [authorFilter, setAuthorFilter] = useState<string>('');
  const [seriesFilter, setSeriesFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOpenFocus, setFilterOpenFocus] = useState<'genre' | 'series' | 'author' | 'tag' | null>(null);
  const [introDismissed, setIntroDismissed] = useState(true);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [firstContentEl, setFirstContentEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setIntroDismissed(localStorage.getItem(INTRO_DISMISSED_KEY) === '1');
    } catch {
      setIntroDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (!firstContentEl) return;
    const io = new IntersectionObserver(
      ([entry]) => setShowStickyHeader(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-60px 0px 0px 0px' }
    );
    io.observe(firstContentEl);
    return () => io.disconnect();
  }, [firstContentEl]);

  const dismissIntro = () => {
    setIntroDismissed(true);
    try {
      localStorage.setItem(INTRO_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const macroGenresInCatalog = useMemo(() => {
    const set = new Set<string>();
    for (const b of audiobooks) {
      const macro = genreToMacro(b.genre || '');
      set.add(macro);
    }
    return MACRO_GENRE_ORDER.filter((id) => set.has(id));
  }, [audiobooks]);

  const authors = useMemo(() => {
    const set = new Set<string>();
    for (const b of audiobooks) {
      const a = (b.author || '').trim();
      if (a) set.add(a);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [audiobooks]);

  const series = useMemo(() => {
    const set = new Set<string>();
    for (const b of audiobooks) {
      const s = (b.series || '').trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [audiobooks]);

  const tagsInCatalog = useMemo(() => {
    const set = new Set<string>();
    for (const b of audiobooks) {
      for (const t of b.tags || []) {
        if ((t || '').trim()) set.add((t || '').trim());
      }
    }
    return Array.from(set).filter((t) => CURATED_TAG_ORDER.includes(t as (typeof CURATED_TAG_ORDER)[number]));
  }, [audiobooks]);

  const curatedSections = useMemo(() => {
    const bySection = new Map<string, AudiobookDto[]>();
    for (const book of audiobooks) {
      for (const sectionId of book.sections || []) {
        if (!CURATED_SECTION_ORDER.includes(sectionId as (typeof CURATED_SECTION_ORDER)[number])) continue;
        if (!bySection.has(sectionId)) bySection.set(sectionId, []);
        bySection.get(sectionId)!.push(book);
      }
    }
    const result: { id: string; title: string; books: AudiobookDto[] }[] = [];
    for (const id of CURATED_SECTION_ORDER) {
      const books = bySection.get(id);
      if (books && books.length > 0) {
        result.push({ id, title: CURATED_SECTION_TITLES[id] ?? id, books });
      }
    }
    return result;
  }, [audiobooks]);

  const fallbackStartHere = useMemo(() => {
    if (curatedSections.length > 0) return [];
    return audiobooks.slice(0, 8);
  }, [audiobooks, curatedSections.length]);

  const filteredAndSorted = useMemo(() => {
    let list = [...audiobooks];
    if (categoryFilter) list = list.filter((b) => (b.genre || '').trim() === categoryFilter);
    if (authorFilter) list = list.filter((b) => (b.author || '').trim() === authorFilter);
    if (seriesFilter) list = list.filter((b) => (b.series || '').trim() === seriesFilter);
    if (tagFilter) list = list.filter((b) => (b.tags || []).includes(tagFilter));
    list.sort((a, b) => {
      switch (sortBy) {
        case 'title': return (a.title || '').localeCompare(b.title || '');
        case 'author': return (a.author || '').localeCompare(b.author || '');
        case 'duration': return (b.duration || 0) - (a.duration || 0);
        case 'series': return (a.series || '').localeCompare(b.series || '');
        case 'genre': return (a.genre || '').localeCompare(b.genre || '');
        default: return 0;
      }
    });
    return list;
  }, [audiobooks, sortBy, categoryFilter, authorFilter, seriesFilter, tagFilter]);

  const booksNeedingCovers = useMemo(() => {
    const ids = new Set<string>();
    const result: AudiobookDto[] = [];
    for (const section of curatedSections) {
      for (const b of section.books) {
        if (!ids.has(b.id)) { ids.add(b.id); result.push(b); }
      }
    }
    for (const b of fallbackStartHere) {
      if (!ids.has(b.id)) { ids.add(b.id); result.push(b); }
    }
    for (const b of filteredAndSorted) {
      if (!ids.has(b.id)) { ids.add(b.id); result.push(b); }
    }
    return result;
  }, [curatedSections, fallbackStartHere, filteredAndSorted]);

  const coverUrls = useCoverUrls(booksNeedingCovers, accessToken);

  const activeFilterCount =
    (categoryFilter ? 1 : 0) +
    (authorFilter ? 1 : 0) +
    (seriesFilter ? 1 : 0) +
    (tagFilter ? 1 : 0);

  const showContent = !loading && !error && audiobooks.length > 0;
  const showEmpty = !loading && !error && audiobooks.length === 0;
  const showError = error;
  const showSkeleton = loading;

  const openFilterSheet = useCallback((focus?: 'genre' | 'series' | 'author' | 'tag') => {
    setFilterOpenFocus(focus ?? null);
    setFilterOpen(true);
  }, []);

  useEffect(() => {
    registerFilter(openFilterSheet, showContent, activeFilterCount);
    return () => registerFilter(openFilterSheet, false, 0);
  }, [registerFilter, openFilterSheet, showContent, activeFilterCount]);

  const clearAllFilters = () => {
    setCategoryFilter('');
    setAuthorFilter('');
    setSeriesFilter('');
    setTagFilter('');
    setFilterOpen(false);
  };

  return (
    <main className="page-with-nav browse-page">
      {showSkeleton && <BrowseSkeleton />}

      {showError && <div className="browse-error">{error}</div>}

      {showContent && (
        <>
          {/* Editorial carousels – calm, guided. No taxonomy on screen. */}
          <div ref={setFirstContentEl}>
            {curatedSections.length > 0 ? (
              curatedSections.map((section, idx) => (
                <section key={section.id} className={`browse-section browse-section-curated ${idx === 0 ? 'browse-section-first' : ''}`}>
                  <h2 className="browse-section-title">{idx === 0 ? 'Start here' : section.title}</h2>
                  <div className="browse-carousel">
                    {section.books.map((book) => (
                      <div key={book.id} className="browse-carousel-item">
                        <BrowseTeaserCard
                          book={book}
                          coverUrl={coverUrls[book.id] ?? undefined}
                          isOnShelf={offlineIds.has(book.id)}
                          showCuratorNote
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : fallbackStartHere.length > 0 ? (
              <section className="browse-section browse-section-curated browse-section-first">
                <h2 className="browse-section-title">Start here</h2>
                <div className="browse-carousel">
                  {fallbackStartHere.map((book) => (
                    <div key={book.id} className="browse-carousel-item">
                      <BrowseTeaserCard
                        book={book}
                        coverUrl={coverUrls[book.id] ?? undefined}
                        isOnShelf={offlineIds.has(book.id)}
                        showCuratorNote
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Why This Library Exists – dismissible */}
            {!introDismissed && (
              <div className="browse-intro-card">
                <p className="browse-intro-text">
                  This is a curated library of audiobooks I&apos;ve found genuinely valuable. No ads. No paywalls. No algorithms. Just books worth listening to.
                </p>
                <button type="button" onClick={dismissIntro} className="browse-intro-dismiss" aria-label="Dismiss">
                  <CloseIcon />
                </button>
              </div>
            )}
          </div>

          {/* Sticky header – Libera only, when scrolled past content */}
          {showStickyHeader && (
            <div className="browse-sticky-explore-bar">
              <div className="browse-sticky-center">
                <span className="browse-explore-bar-brand">Libera</span>
              </div>
            </div>
          )}

          {/* Active filter chips – only when filters applied (power-user feedback) */}
          {activeFilterCount > 0 && (
            <div className="browse-filter-chips browse-filter-chips-quiet">
              {categoryFilter && (
                <span className="browse-filter-chip">
                  {MACRO_GENRE_TITLES[categoryFilter] ?? categoryFilter}{' '}
                  <button type="button" onClick={() => setCategoryFilter('')} aria-label={`Clear genre ${categoryFilter}`}>×</button>
                </span>
              )}
              {seriesFilter && (
                <span className="browse-filter-chip">
                  {seriesFilter}{' '}
                  <button type="button" onClick={() => setSeriesFilter('')} aria-label={`Clear series ${seriesFilter}`}>×</button>
                </span>
              )}
              {authorFilter && (
                <span className="browse-filter-chip">
                  {authorFilter}{' '}
                  <button type="button" onClick={() => setAuthorFilter('')} aria-label={`Clear author ${authorFilter}`}>×</button>
                </span>
              )}
              {tagFilter && (
                <span className="browse-filter-chip">
                  {(CURATED_TAG_TITLES[tagFilter] ?? tagFilter)}{' '}
                  <button type="button" onClick={() => setTagFilter('')} aria-label={`Clear tag ${tagFilter}`}>×</button>
                </span>
              )}
            </div>
          )}

          {/* All Titles grid */}
          <section className="browse-section">
            <h2 className="browse-section-title browse-all-titles-title">All Titles</h2>
            <div className="card-grid card-grid-browse card-grid-2-rows">
              {filteredAndSorted.map((book) => (
                <BrowseTeaserCard
                  key={book.id}
                  book={book}
                  coverUrl={coverUrls[book.id] ?? undefined}
                  isOnShelf={offlineIds.has(book.id)}
                  showCuratorNote
                />
              ))}
            </div>
          </section>
        </>
      )}

      {showEmpty && (
        <div className="browse-empty">
          <div className="browse-empty-icon">📚</div>
          <h2>No audiobooks yet</h2>
          <p>Add m4b files to your R2 bucket to get started</p>
        </div>
      )}

      {/* Filter bottom sheet */}
      {filterOpen && (
        <div className="browse-filter-overlay" onClick={() => setFilterOpen(false)} aria-hidden>
          <div className="browse-filter-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Filter">
            <div className="browse-filter-sheet-header">
              <h2>Filter</h2>
              <button type="button" onClick={() => setFilterOpen(false)} className="browse-filter-close" aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <div className="browse-filter-sheet-body" data-focus={filterOpenFocus}>
              {macroGenresInCatalog.length > 0 && (
                <div className="browse-filter-section">
                  <label className="browse-filter-label">Genre</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="browse-filter-select"
                  >
                    <option value="">All genres</option>
                    {macroGenresInCatalog.map((id) => (
                      <option key={id} value={id}>{MACRO_GENRE_TITLES[id] ?? id}</option>
                    ))}
                  </select>
                </div>
              )}
              {series.length > 0 && (
                <div className="browse-filter-section">
                  <label className="browse-filter-label">Series</label>
                  <select
                    value={seriesFilter}
                    onChange={(e) => setSeriesFilter(e.target.value)}
                    className="browse-filter-select"
                  >
                    <option value="">All series</option>
                    {series.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="browse-filter-section">
                <label className="browse-filter-label">Author</label>
                <select
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  className="browse-filter-select"
                >
                  <option value="">All authors</option>
                  {authors.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              {tagsInCatalog.length > 0 && (
                <div className="browse-filter-section">
                  <label className="browse-filter-label">Ways of thinking</label>
                  <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    className="browse-filter-select"
                  >
                    <option value="">All</option>
                    {tagsInCatalog.map((t) => (
                      <option key={t} value={t}>{CURATED_TAG_TITLES[t] ?? t}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="browse-filter-section">
                <label className="browse-filter-label">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="browse-filter-select"
                >
                  <option value="recent">Recent</option>
                  <option value="title">Title A–Z</option>
                  <option value="author">Author A–Z</option>
                  <option value="series">Series</option>
                  <option value="genre">Genre</option>
                  <option value="duration">Longest first</option>
                </select>
              </div>
              <button type="button" onClick={clearAllFilters} className="browse-filter-clear">
                Clear filters
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function BrowseTeaserCard({
  book,
  coverUrl,
  isOnShelf,
  showCuratorNote = false,
}: {
  book: AudiobookDto;
  coverUrl: string | undefined;
  isOnShelf: boolean;
  showCuratorNote?: boolean;
}) {
  return (
    <Link href={`/audiobook/${encodeURIComponent(book.id)}`} className="browse-teaser-card-link">
      <div className="browse-teaser-card">
        <div className="browse-teaser-cover">
          {coverUrl !== undefined ? (
            <img src={coverUrl ?? PLACEHOLDER_COVER} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="book-card-cover-skeleton" />
          )}
          {book.addedAt && (() => {
            const label = getRecentLabel(book.addedAt);
            return label ? <span className="browse-teaser-recent">{label}</span> : null;
          })()}
        </div>
        <div className="browse-teaser-title">{truncateTitle(book.title)}</div>
        {book.author && <div className="browse-teaser-author">By {book.author}</div>}
        {showCuratorNote && book.curatorNote && (
          <p className="browse-teaser-curator-note">&ldquo;{book.curatorNote}&rdquo;</p>
        )}
      </div>
    </Link>
  );
}
