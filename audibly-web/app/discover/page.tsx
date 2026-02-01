'use client';

import Link from 'next/link';

export default function DiscoverPage() {
  return (
    <main className="page-with-nav discover-page">
      <div className="discover-placeholder">
        <div className="discover-placeholder-icon">✨</div>
        <h1>Discover</h1>
        <p>Editorial picks and recommendations coming soon.</p>
        <Link href="/browse" className="discover-browse-link">
          Browse catalog
        </Link>
      </div>
    </main>
  );
}
