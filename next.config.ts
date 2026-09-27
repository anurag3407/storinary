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
      externals.push('@imgly/background-removal', 'nodemailer');
      config.externals = externals;
    }
    return config;
  },
};

export default nextConfig;
