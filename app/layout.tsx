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
