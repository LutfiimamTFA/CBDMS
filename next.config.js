
/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
      {
        protocol: 'https' ,
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      }
    ],
  },
};

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: !isProd, // Explicitly disable PWA in development
});

module.exports = withPWA(nextConfig);
