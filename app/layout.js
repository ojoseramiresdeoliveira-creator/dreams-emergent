import './globals.css';
import { Fraunces, Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

// Self-hosted via next/font: no render-blocking Google Fonts <link>, no extra
// preconnect round-trips, and the font files are served from our own origin
// with the CSS injected inline. Both are variable fonts, so a single file per
// style covers the whole weight range the design uses (Fraunces 400/600 +
// italic, Inter 300–700). display: swap keeps text visible during load.
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  // Keep the optical-size axis (paired with font-optical-sizing: auto in the
  // CSS) so the large display titles keep their intended letterforms instead
  // of being pinned to a single optical size.
  axes: ['opsz'],
  variable: '--font-fraunces',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL('https://monumentofdreams.com'),
  title: 'Monument of Dreams — Every dream deserves a monument',
  description: 'Preserve your journey. Build your future. Become who you dream of becoming.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Monument of Dreams — Every dream deserves a monument',
    description: 'Preserve your journey. Build your future. Become who you dream of becoming.',
    url: '/',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`dark ${fraunces.variable} ${inter.variable}`}>
      <head>
        {/* The hero's Act 1 poster fills the viewport and is the LCP candidate
            on first paint (the video itself is preload="none"). Preload it at
            high priority so it is not discovered late via the <video poster>. */}
        <link rel="preload" as="image" href="/videos/act01-poster.jpg" fetchPriority="high" />
      </head>
      <body className="bg-obsidian text-platinum antialiased min-h-screen font-sans">
        {/* Skip link: first focusable element, hidden until a keyboard user
            tabs to it, then jumps focus past the fixed nav to the content. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-full focus:bg-platinum focus:px-5 focus:py-3 focus:text-[11px] focus:font-medium focus:uppercase focus:tracking-[0.24em] focus:text-obsidian"
        >
          Skip to content
        </a>
        <main id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'rgba(16, 16, 18, 0.92)',
              backdropFilter: 'blur(16px) saturate(1.2)',
              border: '1px solid rgba(212, 176, 106, 0.22)',
              color: '#F5F5F3',
              boxShadow: '0 20px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
              borderRadius: '999px',
              padding: '14px 22px',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  );
}
