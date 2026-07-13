const SUPABASE_PUBLIC_OBJECT_PATH = '/storage/v1/object/public/'
const SUPABASE_PUBLIC_RENDER_PATH = '/storage/v1/render/image/public/'

type OptimizedImageOptions = {
  width: number
  height: number
  quality?: number
}

/**
 * Uses Supabase Storage image transformation only for public Storage URLs.
 * Other remote URLs are returned unchanged so existing external image sources
 * keep working without assumptions about their CDN parameters.
 */
export function getOptimizedRemoteImageUrl(
  imageUrl?: string | null,
  options?: OptimizedImageOptions,
) {
  const source = String(imageUrl ?? '').trim()
  if (!source || !options) return source || null

  const width = Math.max(1, Math.round(options.width))
  const height = Math.max(1, Math.round(options.height))
  const quality = Math.max(20, Math.min(100, Math.round(options.quality ?? 78)))

  try {
    const url = new URL(source)
    if (!url.pathname.includes(SUPABASE_PUBLIC_OBJECT_PATH)) return source

    url.pathname = url.pathname.replace(
      SUPABASE_PUBLIC_OBJECT_PATH,
      SUPABASE_PUBLIC_RENDER_PATH,
    )
    url.searchParams.set('width', String(width))
    url.searchParams.set('height', String(height))
    url.searchParams.set('resize', 'cover')
    url.searchParams.set('quality', String(quality))
    return url.toString()
  } catch {
    return source
  }
}
