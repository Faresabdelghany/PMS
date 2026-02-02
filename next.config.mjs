import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: cacheComponents (PPR) is disabled because this app is fully auth-protected.
  // PPR requires static shells which conflicts with app-wide auth requirements.
  //
  // Performance is achieved through:
  // - Request-level deduplication: React cache() in lib/request-cache.ts
  // - KV caching: lib/cache/ with Redis/Vercel KV
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
  experimental: {
    // Optimize barrel imports for commonly used icon/utility libraries
    // This enables tree-shaking to only include the specific exports used
    optimizePackageImports: [
      'lucide-react',
      '@phosphor-icons/react',
      '@phosphor-icons/react/dist/ssr',
      'date-fns',
      '@radix-ui/react-icons',
    ],
  },
}

export default withBundleAnalyzer(nextConfig)
