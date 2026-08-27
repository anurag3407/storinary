import type { Metadata } from 'next';
import { Archivo_Black, Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { AppShell } from '@/components/layout/AppShell';

const archivoBlack = Archivo_Black({
  weight: '400',
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
    'Free, self-hosted Cloudinary alternative for Sayalabs. Bulk upload, transform, and serve images from Appwrite, Backblaze B2, or Supabase Storage.',
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
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
