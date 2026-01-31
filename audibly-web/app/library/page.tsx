'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { getStreamUrls, fetchStreamAsBlob, type AudiobookDto } from '@/lib/api';
import { saveOfflineBlob, hasOfflineAudiobook } from '@/lib/offline';
import { useCatalog } from '@/lib/catalogCache';
import { useCoverUrls, PLACEHOLDER_COVER } from '@/lib/useCoverUrls';
import { displayTitle } from '@/lib/displayTitle';
import Link from 'next/link';

export default function LibraryPage() {
  const { catalog: audiobooks, loading, error } = useCatalog();
  const [offlineIds, setOfflineIds] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const coverUrls = useCoverUrls(audiobooks, accessToken);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const apply = (token: string | null) => setAccessToken(token);
    supabase.auth.getSession().then(({ data: { session } }) => apply(session?.access_token ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => apply(session?.access_token ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !audiobooks.length) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.id) {
        for (const book of audiobooks) {
          const ok = await hasOfflineAudiobook(session.user.id, book.id, book.sourceFileCount);
          if (ok) setOfflineIds((prev) => new Set(prev).add(book.id));
        }
      }
    });
  }, [audiobooks]);

  async function handleDownload(book: AudiobookDto) {
    const supabase = createClient();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session.user?.id) return;
    setDownloadingId(book.id);
    try {
      const urls = await getStreamUrls(book.id, session.access_token);
      for (let i = 0; i < urls.length; i++) {
        const blob = await fetchStreamAsBlob(urls[i].url);
        await saveOfflineBlob(session.user.id, book.id, i, blob);
      }
      setOfflineIds((prev) => new Set(prev).add(book.id));
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <main className="page-with-nav" style={{ padding: 'var(--page-padding)' }}>
      {!loading && !error && audiobooks.length > 0 && (
        <header className="page-header">
          <h1 className="page-title">Library</h1>
        </header>
      )}

      {loading && (
        <div className="library-loading" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading library…
        </div>
      )}
      
      {error && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#ef4444' }}>
          {error}
        </div>
      )}
      
      {!loading && !error && audiobooks.length > 0 && (
        <div className="card-grid">
          {audiobooks.map((book) => (
            <div key={book.id} className="book-card-wrapper">
              <Link
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
                    <div className="book-card-play-overlay" aria-hidden>
                      <span className="book-card-play-icon">
                        <PlayIcon />
                      </span>
                    </div>
                  </div>
                  <div className="book-card-info">
                    <div className="book-card-title">{displayTitle(book.title)}</div>
                    {book.author && <div className="book-card-author">{book.author}</div>}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); handleDownload(book); }}
                disabled={downloadingId === book.id || offlineIds.has(book.id)}
                className={`book-card-download ${offlineIds.has(book.id) ? 'downloaded' : ''}`}
              >
                {downloadingId === book.id ? (
                  <>Downloading…</>
                ) : offlineIds.has(book.id) ? (
                  <>✓ Downloaded</>
                ) : (
                  <>Download</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
      
      {!loading && !error && audiobooks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
          <h2 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>No audiobooks yet</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Add m4b files to your R2 bucket to get started
          </p>
        </div>
      )}
    </main>
  );
}

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
