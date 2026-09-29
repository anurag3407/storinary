import type { MetadataRoute } from 'next';

/** Best-effort public origin; falls back to localhost during local dev. */
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/landing'],
        // Everything behind auth is useless to crawlers and reveals structure.
        disallow: [
          '/api/',
          '/onboarding',
          '/upload',
          '/gallery',
          '/videos',
          '/settings',
          '/images/',
          '/accept-invitation',
          '/reset-password',
          '/forgot-password',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
