// Lazy-loaded DOMPurify wrapper to avoid including ~8KB in the initial bundle.
// DOMPurify is only needed when rendering user-generated HTML content.

let importPromise: Promise<(html: string) => string> | null = null

export async function sanitizeHtml(html: string): Promise<string> {
  if (!importPromise) {
    importPromise = import("dompurify").then(
      (mod) => (h: string) => mod.default.sanitize(h)
    )
  }
  const sanitize = await importPromise
  return sanitize(html)
}
