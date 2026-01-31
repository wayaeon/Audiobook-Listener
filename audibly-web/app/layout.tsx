import type { Metadata, Viewport } from 'next';
import './globals.css';
import { OfflineBanner } from './OfflineBanner';
import { SupabaseGuard } from './SupabaseGuard';
import { BottomNav } from './components/BottomNav';
import { TopBar } from './components/TopBar';
import { CatalogProvider } from '@/lib/catalogCache';

export const metadata: Metadata = {
  title: 'Audibly — Audiobook Player',
  description: 'Listen to audiobooks from your library, offline or online.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <OfflineBanner />
        <SupabaseGuard>
          <CatalogProvider>
            <TopBar />
            {children}
          </CatalogProvider>
        </SupabaseGuard>
        <BottomNav />
      </body>
    </html>
  );
}
