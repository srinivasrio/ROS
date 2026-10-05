import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: ['192.168.1.6', '*.local'],
  typescript: {
    ignoreBuildErrors: true,
  },
  compress: true,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      '@supabase/supabase-js',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      'date-fns',
      'clsx'
    ],
  },
  webpack: (config, { dev }) => {

    config.watchOptions = {
      ...config.watchOptions,
      poll: false,
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/.next/**',
        '**/.next-superadmin/**',
        '**/scratch/**',
        '**/waiter_app/**',
        '**/super-admin/**',
        '**/marketing-repo/**',
        '**/.system_generated/**',
        '**/.agent/**',
        '**/.claude/**',
        '**/.qoder/**',
        '**/supabase/**',
        '**/scripts/**',
        '**/*.tsbuildinfo',
        '**/*.log',
        '**/*.md',
        '**/*.sql',
        '**/.DS_Store'
      ],
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'jmcsygpphwdubnanwjwz.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'pub-fc925b324e51441ba1d8aef9ee47e211.r2.dev',
      },
    ],
  },
  async headers() {
    return [
      {
        // P0 FIX (CF-01): Long-lived caching for static media assets
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2|mp4|webm|mov|mp3)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // P0 FIX (CF-01): Explicit caching for static asset directories
        source: '/(images|videos|services|menu|sounds)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Explicitly prevent public CDN caching of any private/authenticated multi-tenant API route
        source: '/api/((?!public/).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
      {
        // P1 FIX (CW-01): Public edge CDN caching for consolidated public customer menu
        source: '/api/public/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=3600',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
