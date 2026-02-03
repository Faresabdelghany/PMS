export function getAvatarUrl(name?: string): string | undefined {
  if (!name) return undefined
  const key = name.trim().toLowerCase()

  // Sync with avatar config in SidebarFooter (app-sidebar.tsx).
  // In this demo, only the primary user uses a real photo; others fall back to initials.
  if (key === "jason duong" || key === "jason d" || key === "jd") {
    return "/avatar-profile.jpg"
  }

  return undefined
}

/**
 * Optimizes a Supabase Storage avatar URL by adding image transformation parameters.
 * This reduces the image size to match the display dimensions, improving performance.
 *
 * @param url - The original avatar URL from Supabase Storage
 * @param size - The display size in pixels (defaults to 64 for 2x resolution at 32px display)
 * @returns The optimized URL with transformation parameters, or the original URL if not a Supabase URL
 */
export function getOptimizedAvatarUrl(url: string | null | undefined, size: number = 64): string | undefined {
  if (!url) return undefined

  // Only transform Supabase Storage URLs
  if (!url.includes('supabase.co/storage/v1/object/public/avatars/')) {
    return url
  }

  // Convert from object URL to render URL for image transformation
  // From: https://<project>.supabase.co/storage/v1/object/public/avatars/<path>
  // To:   https://<project>.supabase.co/storage/v1/render/image/public/avatars/<path>?width=64&height=64
  const transformedUrl = url.replace(
    '/storage/v1/object/public/avatars/',
    '/storage/v1/render/image/public/avatars/'
  )

  return `${transformedUrl}?width=${size}&height=${size}&resize=cover`
}
