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
        <Toaster theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}
