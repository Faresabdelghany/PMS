import bundleAnalyzer from '@next/bundle-analyzer'
import { withSentryConfig } from '@sentry/nextjs'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: cacheComponents (PPR) is disabled because this app is fully auth-protected.
  // PPR requires static shells which conflicts with app-wide auth requirements.
  // "use cache" also requires cacheComponents and cannot be used independently.
  //
  // Performance is achieved through:
  // - Middleware optimizations: prefetch skip + KV session caching
  // - Cache warming: proactive KV population on login/signup/OAuth
  // - Request-level deduplication: React cache() in lib/request-cache.ts
  // - KV caching: lib/cache/ with Redis/Vercel KV (tags, labels, teams, memberships)
  // - Tag-based invalidation: revalidateTag() in server actions
  // - Suspense streaming: Component-level loading states
  //
  // Custom cache profiles (for future use when PPR becomes more flexible)
  // Values are in seconds: stale (serve while revalidating), revalidate (background refresh), expire (hard limit)
  cacheLife: {
    // For data with real-time subscriptions (projects, tasks, clients)
    // Aggressive caching is safe because WebSockets push live updates after initial load
    realtimeBacked: {
      stale: 300,      // 5 minutes
      revalidate: 900, // 15 minutes
      expire: 3600,    // 1 hour
    },
    // For data that changes infrequently (members, tags, workstreams)
    semiStatic: {
      stale: 900,       // 15 minutes
      revalidate: 1800, // 30 minutes
      expire: 7200,     // 2 hours
    },
    // For rarely changing data (organization details)
    static: {
      stale: 1800,      // 30 minutes
      revalidate: 3600, // 1 hour
      expire: 14400,    // 4 hours
    },
    // For user profile and preferences
    user: {
      stale: 3600,      // 1 hour
      revalidate: 7200, // 2 hours
      expire: 28800,    // 8 hours
    },
  },

  images: {
    // Enable Next.js image optimization for better performance
    // Supports automatic sizing, format conversion (WebP/AVIF), and caching
    formats: ['image/avif', 'image/webp'], // AVIF first (20-50% smaller than WebP), WebP fallback
    minimumCacheTTL: 86400, // 24 hours - override short upstream cache headers (e.g. Supabase Storage 1h)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lazhmdyajdqbnxxwyxun.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  // Cache + security headers
  async headers() {
    return [
      {
        // Security headers for all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // CSP is now set dynamically per-request in middleware.ts (nonce-based)
        ],
      },
      {
        // Long cache for Next.js optimized images (/_next/image)
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // Long cache for static assets
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Allow bfcache for auth pages (no-cache allows bfcache, no-store blocks it)
        source: '/(login|signup)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, max-age=0, must-revalidate',
          },
        ],
      },
    ]
  },
  experimental: {
    // Optimize barrel imports for commonly used icon/utility libraries
    // This enables tree-shaking to only include the specific exports used
    optimizePackageImports: [
      'lucide-react',
      '@phosphor-icons/react',
      'date-fns',
      'react-day-picker',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-task-item',
      '@tiptap/extension-task-list',
      'motion/react',
      'motion/react-m',
      'react-hook-form',
      'sonner',
      'class-variance-authority',
      'cmdk',
      'react-markdown',
      'remark-gfm',
      'swr',
      '@tanstack/react-virtual',
      'zod',
      '@hookform/resolvers',
    ],
    // Client-side router cache durations.
    // Next.js 15+ defaults dynamic to 0s, causing a full server roundtrip on every
    // client navigation. Setting staleTimes lets the router reuse prefetched data
    // for repeat visits within the window, reducing redundant requests.
    staleTimes: {
      dynamic: 30,  // 30 seconds - enough to prevent redundant fetches during rapid navigation
      static: 300,  // 5 minutes for static pages
    },
  },
}

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // Suppress Sentry CLI warnings when DSN is not configured
  silent: !process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Disable source map upload unless auth token is set
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Reduce Sentry client bundle size (~80-100KB savings)
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },

  // Turbopack doesn't support webpack.treeshake — Sentry handles it automatically
})
