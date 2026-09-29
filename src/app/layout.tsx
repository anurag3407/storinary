import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const APP_DESCRIPTION =
  'Free, self-hosted Cloudinary alternative. Bulk upload, transform, and serve images and video from Appwrite, Backblaze B2, or Supabase Storage — on-the-fly transforms, signed URLs, and no per-image pricing.';

/** Resolve the canonical origin for absolute metadata URLs. */
function metadataBaseUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: {
    default: 'Storinary — Self-Hosted Image CDN',
    template: '%s — Storinary',
  },
  description: APP_DESCRIPTION,
  applicationName: 'Storinary',
  keywords: [
    'image CDN',
    'Cloudinary alternative',
    'self-hosted media',
    'image transformation',
    'Supabase storage',
    'Backblaze B2',
    'Appwrite storage',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Storinary',
    title: 'Storinary — The Zero-Cost Cloudinary Alternative',
    description: APP_DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Storinary — The Zero-Cost Cloudinary Alternative',
    description: APP_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ToastProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
