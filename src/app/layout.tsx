import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SITE_NAME, SITE_TWITTER, SITE_URL } from '@/lib/site-config';
import ThemeProvider from '@/components/ThemeProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Nonton TV Live Streaming Online Gratis`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    `${SITE_NAME} adalah platform streaming TV live online gratis. Tonton siaran langsung channel Indonesia dan dunia - RCTI, ANTV, CNN, dan masih banyak lagi.`,
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'id_ID',
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_TWITTER,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icons/logo.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SITE_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const stored = localStorage.getItem('theme');
    const cookieTheme = document.cookie.match(/(?:^|; )theme=(dark|light)/)?.[1];
    const preferred =
      stored === 'dark' || stored === 'light'
        ? stored
        : cookieTheme === 'dark' || cookieTheme === 'light'
          ? cookieTheme
          : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(preferred);
  } catch {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased`}
        style={{ backgroundColor: 'var(--c-bg)', color: 'var(--c-text)' }}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
