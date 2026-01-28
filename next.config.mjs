/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
