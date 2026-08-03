import type { Metadata } from 'next';
import { Archivo_Black, Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { Sidebar } from '@/components/layout/Sidebar';

const archivoBlack = Archivo_Black({
  weight: '400', // Archivo Black only has one weight
  subsets: ['latin'],
  variable: '--nb-font-heading',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--nb-font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Storinary — Self-Hosted Image CDN',
    template: '%s — Storinary',
  },
  description:
    'Free, self-hosted Cloudinary alternative. Bulk upload, transform, and serve images from Supabase Storage.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivoBlack.variable} ${inter.variable}`}>
      <body>
        <ToastProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="app-main">
              <div className="app-content">{children}</div>
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
