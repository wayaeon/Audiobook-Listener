'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getAudiobook,
  getStreamUrls,
  getMetadataCached,
  getCoverBlobUrl,
  fetchStreamAsBlobWithProgress,
  type AudiobookDto,
  type MetadataDto,
} from '@/lib/api';
import { saveOfflineBlob } from '@/lib/offline';
import { displayTitle } from '@/lib/displayTitle';
import { useAuth } from '@/lib/AuthContext';
import { useOfflineIds } from '@/lib/OfflineIdsContext';
import { useCatalog } from '@/lib/catalogCache';
import { useProgressMap } from '@/lib/useProgressMap';
import { createClient } from '@/lib/supabase';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/** Commitment lines derived from duration and pace. Pre-download: reduce uncertainty. */
function getCommitmentLines(
  durationSeconds: number,
  chapterCount: number,
  pace?: string | null
): string[] {
  const lines: string[] = [];
  if (durationSeconds >= 45 * 3600) {
    const hours = Math.round(durationSeconds / 3600);
    lines.push(`Long listen (≈${hours}+ hours)`);
  } else if (durationSeconds > 0) {
    const h = Math.floor(durationSeconds / 3600);
    const m = Math.floor((durationSeconds % 3600) / 60);
    const durationStr = h >= 1 ? `≈${h}h ${m}m` : `≈${m}m`;
    lines.push(durationStr);
  }
  if (chapterCount > 0) lines.push(`${chapterCount} chapter${chapterCount !== 1 ? 's' : ''}`);
  const paceLower = (pace ?? '').toLowerCase();
  if (paceLower.includes('slow') || paceLower.includes('patient') || paceLower.includes('measured')) {
    lines.push('Rewards patience over speed');
    lines.push('Best entered without rushing');
  }
  return lines;
}

function getChapterAtPosition(
  chapters: { index: number; title: string; startTime: number; endTime: number }[],
  positionSeconds: number
): { index: number; title: string } | null {
  if (!chapters.length) return null;
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (positionSeconds >= chapters[i].startTime) return { index: i, title: chapters[i].title };
  }
  return { index: 0, title: chapters[0].title };
}

type PersonModal = 'author' | 'narrator' | null;

export default function AudiobookDetailsPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { accessToken, userId } = useAuth();
  const { offlineIds, addOfflineId, removeOfflineId } = useOfflineIds();
  const { catalog } = useCatalog();
  const { progressMap, getStatus, setCompleted, setUncompleted, refetch: refetchProgress } = useProgressMap();

  const catalogBook = catalog.find((b) => b.id === id);
  const [audiobook, setAudiobook] = useState<AudiobookDto | null>(catalogBook ?? null);
  const [metadata, setMetadata] = useState<MetadataDto | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(!catalogBook);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [personModal, setPersonModal] = useState<PersonModal>(null);
  const [markingFinished, setMarkingFinished] = useState(false);
  const [heroGradient, setHeroGradient] = useState<string | null>(null);
  const [heroHeight, setHeroHeight] = useState(0);
  const [profileRole, setProfileRole] = useState<'user' | 'admin' | null>(null);
  const coverRef = useRef<HTMLImageElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const isDownloaded = offlineIds.has(id);
  const book = audiobook ?? catalogBook;
  const hasBook = !!book;
  const coverSrc = metadata?.coverDataUrl ?? coverUrl ?? null;

  const loadDetails = useCallback(async () => {
    if (!id) return;
    if (!catalogBook && accessToken) {
      setMetaLoading(true);
      setError(null);
      try {
        const b = await getAudiobook(id, accessToken);
        setAudiobook(b);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setMetaLoading(false);
      }
    } else if (catalogBook) {
      setAudiobook(catalogBook);
      setMetaLoading(false);
    }
  }, [id, accessToken, catalogBook]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const loadMetadata = useCallback(async () => {
    if (!id || !accessToken || !hasBook) return;
    try {
      const meta = await getMetadataCached(id, accessToken, userId).catch(() => null);
      setMetadata(meta ?? null);
      if (!meta?.coverDataUrl) {
        const url = await getCoverBlobUrl(id, accessToken);
        setCoverUrl(url);
      }
    } catch {
      /* non-blocking */
    }
  }, [id, accessToken, userId, hasBook]);

  useEffect(() => {
    if (hasBook && accessToken) loadMetadata();
  }, [hasBook, accessToken, loadMetadata]);

  useEffect(() => {
    if (!coverSrc) setHeroGradient(null);
  }, [coverSrc]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHeroHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    setHeroHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [hasBook]);

  const handleCoverLoad = useCallback(() => {
    const img = coverRef.current;
    if (!img || !img.complete || img.naturalWidth === 0) return;
    try {
      const canvas = document.createElement('canvas');
      const size = 32;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, Math.floor(size * 0.5), size, Math.floor(size * 0.5));
      const d = data.data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n += 1;
      }
      if (n === 0) return;
      r = Math.floor(r / n);
      g = Math.floor(g / n);
      b = Math.floor(b / n);
      const darken = (v: number, f: number) => Math.max(0, Math.floor(v * f));
      const mid = `rgb(${darken(r, 0.5)},${darken(g, 0.5)},${darken(b, 0.5)})`;
      const dark = `rgb(${darken(r, 0.25)},${darken(g, 0.25)},${darken(b, 0.25)})`;
      const base = `rgb(${r},${g},${b})`;
      setHeroGradient(`linear-gradient(135deg, ${base} 0%, ${mid} 45%, ${dark} 100%)`);
    } catch {
      setHeroGradient(null);
    }
  }, []);

  async function handleDownload() {
    if (!accessToken || !userId || !book) return;
    addOfflineId(id);
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const urls = await getStreamUrls(id, accessToken);
      const totalFiles = urls.length;
      for (let i = 0; i < urls.length; i++) {
        const blob = await fetchStreamAsBlobWithProgress(urls[i].url, (loaded, total) => {
          const fileWeight = 1 / totalFiles;
          const fileProgress = total > 0 ? loaded / total : 0;
          const overall = (i * fileWeight + fileWeight * fileProgress) * 100;
          setDownloadProgress(Math.min(100, Math.round(overall)));
        });
        await saveOfflineBlob(userId, id, i, blob);
      }
      setDownloadProgress(100);
    } catch (e) {
      console.error(e);
      removeOfflineId(id);
      setDownloadProgress(0);
    } finally {
      setDownloading(false);
    }
  }

  async function handleMarkFinished() {
    if (!book) return;
    setMarkingFinished(true);
    try {
      if (status === 'completed') {
        await setUncompleted(id);
      } else if (book.duration) {
        await setCompleted(id, book.duration);
      }
    } finally {
      setMarkingFinished(false);
    }
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  }

  function handleShare() {
    if (typeof navigator === 'undefined' || !navigator.share) return;
    const shareTitle = displayTitle(metadata?.title ?? book?.title ?? '');
    const shareAuthor = metadata?.author ?? book?.author ?? '';
    const isAdminShare = profileRole === 'admin';
    let url: string;
    let title: string;
    let text: string;
    if (isAdminShare) {
      url = typeof window !== 'undefined' ? window.location.origin : '';
      title = 'Libera – Audiobooks';
      text = 'Listen to audiobooks with Libera.';
    } else {
      const isbn = metadata?.isbn ?? book?.isbn ?? null;
      const query = isbn ? isbn : [shareTitle, shareAuthor].filter(Boolean).join(' ');
      if (isbn) {
        url = `https://www.goodreads.com/search?q=${encodeURIComponent(isbn)}`;
      } else {
        url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
      }
      title = `${shareTitle} · Audiobook`;
      text = shareAuthor ? `${shareTitle} by ${shareAuthor}` : shareTitle;
    }
    navigator.share({ title, url, text }).catch(() => {});
  }

  if (!id) {
    return (
      <main className="audiobook-details-page audiobook-details-error">
        <p>Invalid book</p>
        <Link href="/browse" className="audiobook-details-back-link">← Browse</Link>
      </main>
    );
  }

  if (metaLoading && !hasBook) {
    return (
      <main className="audiobook-details-page">
        <div className="audiobook-details-loading">
          <div className="audiobook-details-loading-spinner" />
          <p>Loading…</p>
        </div>
      </main>
    );
  }

  if (error && !hasBook) {
    return (
      <main className="audiobook-details-page audiobook-details-error">
        <p>{error}</p>
        <Link href="/browse" className="audiobook-details-back-link">← Browse</Link>
      </main>
    );
  }

  if (!hasBook) {
    return (
      <main className="audiobook-details-page audiobook-details-error">
        <p>Not found</p>
        <Link href="/browse" className="audiobook-details-back-link">← Browse</Link>
      </main>
    );
  }

  const rawTitle = displayTitle(metadata?.title ?? book.title ?? '');
  const title = rawTitle.length > 34 ? rawTitle.slice(0, 30).trim() + '…' : rawTitle;
  const author = metadata?.author ?? book.author ?? '';
  const narrator = metadata?.narrator ?? book.narrator ?? null;
  const authorBio = metadata?.authorBio ?? book.authorBio ?? null;
  const narratorBio = metadata?.narratorBio ?? book.narratorBio ?? null;
  const series = metadata?.series ?? book.series ?? null;
  const seriesNote = metadata?.seriesNote ?? book.seriesNote ?? null;
  const genre = metadata?.genre ?? book.genre ?? null;
  const description = metadata?.description ?? book.description ?? null;
  const curatorNote = metadata?.curatorNote ?? book.curatorNote ?? null;
  const chapters = metadata?.chapters ?? book.chapters ?? [];
  const duration = metadata?.duration ?? book.duration ?? 0;
  const whyListen = metadata?.whyListen ?? book.whyListen ?? (metadata?.tags?.length ? metadata.tags.slice(0, 3) : book.tags?.slice(0, 3)) ?? [];
  const atGlance = metadata?.atGlance ?? book.atGlance ?? null;
  const publisher = metadata?.publisher ?? book.publisher ?? null;
  const releaseYear = metadata?.releaseYear ?? book.releaseYear ?? null;
  const language = metadata?.language ?? book.language ?? null;
  const fileSizeBytes = metadata?.fileSizeBytes ?? book.fileSizeBytes ?? null;
  const isbn = metadata?.isbn ?? book.isbn ?? null;

  const progress = progressMap.get(id);
  const positionSeconds = progress?.positionSeconds ?? 0;
  const status = getStatus(id, duration);
  const progressPercent = duration > 0 ? Math.min(100, (positionSeconds / duration) * 100) : 0;
  const remainingSeconds = Math.max(0, duration - positionSeconds);
  const currentChapter = getChapterAtPosition(chapters, positionSeconds);

  const experienceLines: string[] = [];
  const firstLineParts = [genre, atGlance?.tone, atGlance?.pace, atGlance?.world].filter(Boolean);
  if (firstLineParts.length > 0) {
    experienceLines.push(firstLineParts.join(' · '));
  }
  if (atGlance?.audience) experienceLines.push(atGlance.audience);

  const commitmentLines = getCommitmentLines(duration, chapters.length, atGlance?.pace);
  const hasEditionDetails = !!(publisher || releaseYear || language || fileSizeBytes || isbn);

  type InfoCard = { id: string; title: string; lines: string[] };
  const infoCards: InfoCard[] = [];
  if (experienceLines.length > 0) infoCards.push({ id: 'what', title: 'What this is', lines: experienceLines });
  if (commitmentLines.length > 0) infoCards.push({ id: 'length', title: 'Length & structure', lines: commitmentLines });
  if (releaseYear || publisher) {
    const pubLines: string[] = [];
    if (releaseYear) pubLines.push(`Released ${releaseYear}`);
    if (publisher) pubLines.push(publisher);
    infoCards.push({ id: 'publishing', title: 'Publishing', lines: pubLines });
  }
  if (narrator) infoCards.push({ id: 'narrator', title: 'Narrator', lines: [narrator] });
  if (language) infoCards.push({ id: 'language', title: 'Language', lines: [language] });
  if (curatorNote) infoCards.push({ id: 'curator', title: 'Curator note', lines: [curatorNote] });
  if (series && seriesNote && !curatorNote) infoCards.push({ id: 'series', title: 'Series', lines: [seriesNote] });

  return (
    <main className="audiobook-details-page" style={{ '--hero-height': heroHeight ? `${heroHeight}px` : '60vh' } as React.CSSProperties}>
      <div ref={heroRef} className="audiobook-details-hero">
        <div className="audiobook-details-hero-bg" style={heroGradient ? { background: heroGradient } : undefined} />
        <div className="audiobook-details-hero-overlay" />
        <div className="audiobook-details-hero-content">
          <div className="audiobook-details-hero-inner">
            <div className="audiobook-details-cover-wrap">
              {coverSrc ? (
                <img src={coverSrc} alt="" className="audiobook-details-cover" ref={coverRef} onLoad={handleCoverLoad} />
              ) : (
                <div className="audiobook-details-cover-placeholder">📚</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="audiobook-details-body">
        <h1 className="audiobook-details-title audiobook-details-title-scroll">{title}</h1>
        <div className="audiobook-details-author-block">
          {author ? (
            authorBio ? (
              <button type="button" className="audiobook-details-author-plain" onClick={() => setPersonModal('author')}>
                By {author}
              </button>
            ) : (
              <p className="audiobook-details-author-plain">By {author}</p>
            )
          ) : (
            <p className="audiobook-details-author-plain">Author unknown</p>
          )}
        </div>

        {infoCards.length > 0 ? (
          <div className="audiobook-details-cards-scroll" role="region" aria-label="Book info cards">
            <div className="audiobook-details-cards-track">
              {infoCards.map((card) => (
                <article key={card.id} className="audiobook-details-info-card">
                  <h2 className="audiobook-details-info-card-title">{card.title}</h2>
                  <div className="audiobook-details-info-card-lines">
                    {card.lines.map((line, i) => (
                      <p key={i} className="audiobook-details-info-card-line">{line}</p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="audiobook-details-cta-sticky">
          {!isDownloaded ? (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="audiobook-details-cta audiobook-details-cta-download"
              style={{ '--download-progress': `${downloadProgress}%` } as React.CSSProperties}
            >
              <span className="audiobook-details-cta-download-fill" aria-hidden="true" />
              <span className="audiobook-details-cta-inner">
                {downloading ? (
                  <>
                    <span className="audiobook-details-cta-spinner" />
                    Downloading… {downloadProgress}%
                  </>
                ) : (
                  <>
                    <DownloadIcon />
                    Download & begin
                  </>
                )}
              </span>
            </button>
          ) : (
            <Link
              href={`/play/${encodeURIComponent(id)}`}
              className="audiobook-details-cta audiobook-details-cta-listen"
            >
              <PlayIcon />
              Listen
            </Link>
          )}
        </div>
        <div className="audiobook-details-cta-after">
          {!isDownloaded && !downloading ? (
            <p className="audiobook-details-cta-subtext">Stored on your device · Play only in Libera</p>
          ) : !isDownloaded && downloading ? (
            <p className="audiobook-details-cta-subtext">Saving locally…</p>
          ) : isDownloaded && status === 'in_progress' && (currentChapter || progressPercent > 0) ? (
            <p className="audiobook-details-cta-subtext">
              {currentChapter ? `Last listened · ${currentChapter.title}` : `${Math.round(progressPercent)}% · ${formatDuration(remainingSeconds)} left`}
            </p>
          ) : null}
          <div className="audiobook-details-cta-divider" aria-hidden="true" />
        </div>

        <div className="audiobook-details-secondary-actions">
          {duration > 0 && (
            <>
              <button
                type="button"
                className="audiobook-details-secondary-btn audiobook-details-secondary-btn-finished"
                onClick={handleMarkFinished}
                disabled={markingFinished}
                aria-pressed={status === 'completed'}
              >
                {status === 'completed' ? (
                  <CheckIcon className="audiobook-details-secondary-btn-icon" />
                ) : (
                  <CheckOutlineIcon className="audiobook-details-secondary-btn-icon" />
                )}
                <span>{status === 'completed' ? 'Finished' : 'Mark as finished'}</span>
              </button>
              {status === 'completed' && progress?.finishedAt && (
                <span className="audiobook-details-finished-date">
                  {formatDate(progress.finishedAt)}
                  {progress.startedAt && progress.startedAt !== progress.finishedAt && (
                    <> · Started {formatDate(progress.startedAt)}</>
                  )}
                </span>
              )}
            </>
          )}
          {typeof navigator !== 'undefined' && navigator.share && (
            <button
              type="button"
              className="audiobook-details-secondary-btn audiobook-details-secondary-btn-share"
              onClick={handleShare}
            >
              <ShareIcon className="audiobook-details-secondary-btn-icon" />
              <span>{profileRole === 'admin' ? 'Share app' : 'Share'}</span>
            </button>
          )}
        </div>

        {description ? (
          <article className="audiobook-details-text-card">
            <h2 className="audiobook-details-text-card-title">Publisher description</h2>
            <div className="audiobook-details-text-card-body">
              <p>{description}</p>
            </div>
          </article>
        ) : null}

        {hasEditionDetails ? (
          <article className="audiobook-details-text-card">
            <h2 className="audiobook-details-text-card-title">About this edition</h2>
            <div className="audiobook-details-text-card-body audiobook-details-edition-grid">
              {releaseYear && (
                <div className="audiobook-details-edition-row">
                  <span className="audiobook-details-edition-label">Release year</span>
                  <span>{releaseYear}</span>
                </div>
              )}
              {publisher && (
                <div className="audiobook-details-edition-row">
                  <span className="audiobook-details-edition-label">Publisher</span>
                  <span>{publisher}</span>
                </div>
              )}
              {language && (
                <div className="audiobook-details-edition-row">
                  <span className="audiobook-details-edition-label">Language</span>
                  <span>{language}</span>
                </div>
              )}
              {fileSizeBytes != null && fileSizeBytes > 0 && (
                <div className="audiobook-details-edition-row">
                  <span className="audiobook-details-edition-label">File size</span>
                  <span>{formatSize(fileSizeBytes)}</span>
                </div>
              )}
              {isbn && (
                <div className="audiobook-details-edition-row">
                  <span className="audiobook-details-edition-label">ISBN</span>
                  <span>{isbn}</span>
                </div>
              )}
            </div>
          </article>
        ) : null}
      </div>

      {personModal ? (
        <div
          className="audiobook-details-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={personModal === 'author' ? 'Author' : 'Narrator'}
          onClick={() => setPersonModal(null)}
        >
          <div
            className="audiobook-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="audiobook-details-modal-title">
              {personModal === 'author' ? author : narrator}
            </h3>
            <p className="audiobook-details-modal-bio">
              {personModal === 'author' ? (authorBio ?? 'Bio not available.') : (narratorBio ?? 'Bio not available.')}
            </p>
            <button
              type="button"
              className="audiobook-details-modal-close"
              onClick={() => setPersonModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function CheckOutlineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  );
}
