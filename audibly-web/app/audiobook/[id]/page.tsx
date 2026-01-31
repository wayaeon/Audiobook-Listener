'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getAudiobook,
  getStreamUrls,
  getMetadataCached,
  getCoverBlobUrl,
  fetchStreamAsBlob,
  type AudiobookDto,
  type MetadataDto,
} from '@/lib/api';
import { saveOfflineBlob } from '@/lib/offline';
import { displayTitle } from '@/lib/displayTitle';
import { useAuth } from '@/lib/AuthContext';
import { useOfflineIds } from '@/lib/OfflineIdsContext';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export default function AudiobookDetailsPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { accessToken, userId } = useAuth();
  const { offlineIds, addOfflineId } = useOfflineIds();
  const [audiobook, setAudiobook] = useState<AudiobookDto | null>(null);
  const [metadata, setMetadata] = useState<MetadataDto | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const isDownloaded = offlineIds.has(id);

  const loadDetails = useCallback(async () => {
    if (!id || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [book, meta] = await Promise.all([
        getAudiobook(id, accessToken),
        getMetadataCached(id, accessToken, userId).catch(() => null),
      ]);
      setAudiobook(book);
      setMetadata(meta ?? null);
      if (!meta?.coverDataUrl) {
        const url = await getCoverBlobUrl(id, accessToken);
        setCoverUrl(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, accessToken, userId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  async function handleDownload() {
    if (!accessToken || !userId || !audiobook) return;
    setDownloading(true);
    try {
      const urls = await getStreamUrls(id, accessToken);
      for (let i = 0; i < urls.length; i++) {
        const blob = await fetchStreamAsBlob(urls[i].url);
        await saveOfflineBlob(userId, id, i, blob);
      }
      addOfflineId(id);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }

  if (loading)
    return (
      <main className="audiobook-details-page">
        <div className="audiobook-details-loading">
          <div className="audiobook-details-loading-spinner" />
          <p>Loading…</p>
        </div>
      </main>
    );

  if (error || !audiobook)
    return (
      <main className="audiobook-details-page audiobook-details-error">
        <p>{error ?? 'Not found'}</p>
        <Link href="/library" className="audiobook-details-back-link">
          ← Back to Library
        </Link>
      </main>
    );

  const title = displayTitle(metadata?.title ?? audiobook.title ?? '');
  const author = metadata?.author ?? audiobook.author ?? '';
  const description = metadata?.description ?? null;
  const chapters = metadata?.chapters ?? [];
  const duration = audiobook.duration ?? 0;
  const estimatedSize = duration * 16000;
  const coverSrc = metadata?.coverDataUrl ?? coverUrl;
  const descShortLength = 280;
  const hasLongDesc = description && description.length > descShortLength;
  const descPreview = hasLongDesc
    ? (() => {
        const cut = description.slice(0, descShortLength);
        const lastSpace = cut.lastIndexOf(' ');
        return (lastSpace > 200 ? cut.slice(0, lastSpace) : cut).trim() + '…';
      })()
    : description;

  return (
    <main className="audiobook-details-page">
      <div className="audiobook-details-hero">
        <div className="audiobook-details-hero-bg" />
        <div className="audiobook-details-hero-overlay" />
        <div className="audiobook-details-hero-content">
          <Link href="/library" className="audiobook-details-back">
            <BackIcon /> Library
          </Link>
          <div className="audiobook-details-hero-inner">
            <div className="audiobook-details-cover-wrap">
              {coverSrc ? (
                <img src={coverSrc} alt="" className="audiobook-details-cover" />
              ) : (
                <div className="audiobook-details-cover-placeholder">📚</div>
              )}
            </div>
            <div className="audiobook-details-hero-meta">
              <h1 className="audiobook-details-title">{title}</h1>
              <p className="audiobook-details-author">{author}</p>
              <div className="audiobook-details-badges">
                {duration > 0 && (
                  <span className="audiobook-details-badge">{formatDuration(duration)}</span>
                )}
                {audiobook.sourceFileCount > 1 && (
                  <span className="audiobook-details-badge">{audiobook.sourceFileCount} parts</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="audiobook-details-body">
        <div className="audiobook-details-cta-wrap">
          {!isDownloaded ? (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="audiobook-details-cta audiobook-details-cta-download"
            >
              {downloading ? (
                <>
                  <span className="audiobook-details-cta-spinner" />
                  Downloading…
                </>
              ) : (
                <>
                  <DownloadIcon />
                  Download · {formatDuration(duration)} · ~{formatSize(estimatedSize)}
                </>
              )}
            </button>
          ) : (
            <Link href={`/play/${encodeURIComponent(id)}`} className="audiobook-details-cta audiobook-details-cta-listen">
              <PlayIcon />
              Listen
            </Link>
          )}
        </div>

        {description && (
          <section className="audiobook-details-section">
            <h2 className="audiobook-details-section-title">About this audiobook</h2>
            <div className="audiobook-details-description">
              <p>
                {descriptionExpanded ? description : descPreview}
              </p>
              {hasLongDesc && (
                <button
                  type="button"
                  onClick={() => setDescriptionExpanded((e) => !e)}
                  className="audiobook-details-read-more"
                >
                  {descriptionExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          </section>
        )}

        {chapters.length > 0 && (
          <section className="audiobook-details-section">
            <h2 className="audiobook-details-section-title">
              Chapters <span className="audiobook-details-section-count">{chapters.length}</span>
            </h2>
            <div className="audiobook-details-chapters">
              {chapters.slice(0, 30).map((ch) => (
                <div key={ch.index} className="audiobook-details-chapter">
                  <span className="audiobook-details-chapter-num">{ch.index + 1}</span>
                  <span className="audiobook-details-chapter-title">{ch.title}</span>
                </div>
              ))}
              {chapters.length > 30 && (
                <div className="audiobook-details-chapter audiobook-details-chapter-more">
                  +{chapters.length - 30} more chapters
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
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
