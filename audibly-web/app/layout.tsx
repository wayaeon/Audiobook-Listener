import type { Metadata, Viewport } from 'next';
import './globals.css';
import { OfflineBanner } from './OfflineBanner';
import { SupabaseGuard } from './SupabaseGuard';
import { OnboardingGuard } from './OnboardingGuard';
import { BottomNav } from './components/BottomNav';
import { TopBar } from './components/TopBar';
import { MiniPlayer } from './components/MiniPlayer';
import { MainWithMiniPlayerSpacer } from './components/MainWithMiniPlayerSpacer';
import { CatalogProvider } from '@/lib/catalogCache';
import { PlayerProvider } from '@/lib/PlayerContext';
import { AuthProvider } from '@/lib/AuthContext';
import { OfflineIdsProvider } from '@/lib/OfflineIdsContext';

export const metadata: Metadata = {
  title: 'Libera — Audiobook Library',
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
          <AuthProvider>
            <CatalogProvider>
              <OfflineIdsProvider>
                <PlayerProvider>
                <OnboardingGuard>
                  <MainWithMiniPlayerSpacer>
                    <TopBar />
                    {children}
                  </MainWithMiniPlayerSpacer>
                </OnboardingGuard>
                <MiniPlayer />
                <BottomNav />
                </PlayerProvider>
              </OfflineIdsProvider>
            </CatalogProvider>
          </AuthProvider>
        </SupabaseGuard>
      </body>
    </html>
  );
}
