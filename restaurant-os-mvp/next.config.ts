import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: ['192.168.1.6', '*.local'],
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
};

export default nextConfig;
