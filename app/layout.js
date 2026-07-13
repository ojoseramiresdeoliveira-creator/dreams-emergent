import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'Monument of Dreams — Every dream deserves a monument',
  description: 'Preserve your journey. Build your future. Become who you dream of becoming.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-obsidian text-platinum antialiased min-h-screen font-sans">
        {children}
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
