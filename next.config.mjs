import bundleAnalyzer from '@next/bundle-analyzer'

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
  // - SWR client-side caching: hooks/use-swr-data.ts for background revalidation
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
  // Cache headers for static assets and Supabase storage proxied images
  async headers() {
    return [
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
    ]
  },
  experimental: {
    // Optimize barrel imports for commonly used icon/utility libraries
    // This enables tree-shaking to only include the specific exports used
    optimizePackageImports: [
      'lucide-react',
      '@phosphor-icons/react',
      'date-fns',
      '@radix-ui/react-icons',
      'react-day-picker',
      'recharts',
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
      'framer-motion',
      'react-hook-form',
      'sonner',
      'class-variance-authority',
      'cmdk',
      'vaul',
      'react-resizable-panels',
      'react-markdown',
      'remark-gfm',
      'input-otp',
      'embla-carousel-react',
      'swr',
    ],
    // Client-side router cache durations.
    // Next.js 15+ defaults dynamic to 0s, causing a full server roundtrip on every
    // client navigation. Setting staleTimes lets the router reuse prefetched data
    // for repeat visits within the window, reducing redundant requests.
    staleTimes: {
      dynamic: 30,  // 30 seconds for dynamic pages
      static: 300,  // 5 minutes for static pages
    },
  },
}

export default withBundleAnalyzer(nextConfig)
