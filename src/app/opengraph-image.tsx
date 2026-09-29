import { ImageResponse } from 'next/og';

export const alt = 'Storinary — self-hosted image CDN and Cloudinary alternative';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0b0b12',
          color: '#ffffff',
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 30,
            letterSpacing: 6,
            fontWeight: 700,
            color: '#a1a1b5',
          }}
        >
          STORINARY
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 78, fontWeight: 800, lineHeight: 1.05 }}>
            Unlimited media delivery.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.05,
              color: '#7c8cff',
            }}
          >
            Zero cloud invoices.
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 30, color: '#a1a1b5' }}>
          Self-hosted image &amp; video CDN · On-the-fly transforms · No vendor lock-in
        </div>
      </div>
    ),
    { ...size }
  );
}
