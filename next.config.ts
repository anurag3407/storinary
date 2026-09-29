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
  serverExternalPackages: ['sharp', 'resend', 'nodemailer'],

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

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
