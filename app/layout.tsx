import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const SITE_URL = 'https://unit-x-eta.vercel.app';
const TITLE = 'UNIT-X // terminal';
const DESCRIPTION =
  'a lifelong companion in a terminal. the unit keeps a ledger of the people it has met.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · UNIT-X',
  },
  description: DESCRIPTION,
  applicationName: 'UNIT-X',
  authors: [{ name: 'nxyz' }],
  keywords: [
    'unit-x',
    'terminal',
    'cognition',
    'companion',
    'cogmind',
    'crt',
    'ai',
    'journal',
  ],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'UNIT-X',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  // Tell mobile browsers the virtual keyboard should shrink the layout
  // viewport, not just the visual one. Without this, `100vh` / `100dvh`
  // stay fixed at full-screen and the input row ends up behind the
  // keyboard. With it, the grid actually re-lays-out as the keyboard
  // appears. Also shows nicely on desktop (no-op).
  interactiveWidget: 'resizes-content',
  viewportFit: 'cover',
  // Lock the app to 1× scale — no pinch zoom, no double-tap zoom, no
  // accidental scaling when focusing an input. Trade-off: disables the
  // browser's own zoom gesture. We accept this because the terminal is
  // already monospace + designed to fit the viewport; zoom breaks the
  // grid rather than helping. The size toggles in /settings cover
  // accessibility needs within the app's own system.
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body>{children}</body>
    </html>
  );
}
