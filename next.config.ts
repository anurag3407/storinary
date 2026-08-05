import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow images from Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Allow large uploads via server actions
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // Exclude @imgly/background-removal from server-side bundling
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = Array.isArray(config.externals)
        ? config.externals
        : [];
      externals.push('@imgly/background-removal');
      config.externals = externals;
    }
    return config;
  },
};

export default nextConfig;
