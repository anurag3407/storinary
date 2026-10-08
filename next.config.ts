import type { NextConfig } from 'next';

const isClerk =
  (process.env.isclerk || process.env.IS_CLERK || '').trim().toLowerCase() === 'true';
const isResend =
  (process.env.isresend || process.env.IS_RESEND || '').trim().toLowerCase() === 'true';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_IS_CLERK: String(isClerk),
    NEXT_PUBLIC_IS_RESEND: String(isResend),
  },
  // Allow images from storage providers & external sources
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.appwrite.io',
      },
      {
        protocol: 'https',
        hostname: 'sgp.cloud.appwrite.io',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  // Prisma must stay external: its generated client is resolved at runtime
  // (and is patched by OpenNext), so bundling it breaks on Workers.
  serverExternalPackages: ['sharp', 'resend', 'nodemailer', '@prisma/client', '.prisma/client'],

  // Allow large uploads via server actions
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // @imgly selects the optional WebGPU ONNX entrypoint at bundle time. The
  // npm package intentionally does not ship that entrypoint's wasm artifact,
  // so force the shipped browser entrypoint and keep this feature buildable.

  // Exclude @imgly/background-removal from server-side bundling
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'onnxruntime-web/webgpu': 'onnxruntime-web',
      };
    }
    if (isServer) {
      const externals = Array.isArray(config.externals)
        ? config.externals
        : [];
      externals.push('@imgly/background-removal', 'nodemailer', 'resend');
      config.externals = externals;
    }
    return config;
  },
};

export default nextConfig;

// Local (Node) development: give dev bindings the same origin database the
// Worker reaches through Hyperdrive, and never let this dev-only proxy break
// `next build` when no connection string is configured (e.g. in CI).
const hyperdriveLocalConn = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (hyperdriveLocalConn && !process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE) {
  process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = hyperdriveLocalConn;
}

import('@opennextjs/cloudflare')
  .then(m => m.initOpenNextCloudflareForDev())
  .catch(() => undefined);
