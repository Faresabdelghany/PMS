import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/invite/", "/onboarding"],
    },
    sitemap: "https://pms-nine-gold.vercel.app/sitemap.xml",
  }
}
