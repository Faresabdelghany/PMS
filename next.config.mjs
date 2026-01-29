/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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

export default nextConfig
