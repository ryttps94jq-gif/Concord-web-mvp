import './globals.css';
import { Providers } from '@/components/Providers';
import type { Metadata, Viewport } from 'next';

/**
 * Root layout — Server Component.
 * Client-side providers (QueryClient, AppShell) are in <Providers>.
 * Fixes FE-002: root layout no longer forces entire tree into client mode.
 */

export const metadata: Metadata = {
  title: 'Concord OS',
  description: 'Concord Cognitive Engine - 76 Lens Empire',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-lattice-void">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
