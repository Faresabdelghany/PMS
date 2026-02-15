// lib/cache/warm.ts
import { createAdminClient } from "@/lib/supabase/admin"
import { CacheKeys, CacheTTL } from "./keys"
import { kv, isKVAvailable, memCache } from "./client"
import { SIDEBAR_PROJECT_LIMIT } from "@/lib/constants"
import { logger } from "@/lib/logger"

/**
 * Warm KV cache with user's dashboard data after login.
 * Uses admin client to bypass RLS. Non-blocking writes.
 */
export async function warmUserCache(userId: string): Promise<void> {
  if (!isKVAvailable()) return // No-op in local dev

  const admin = createAdminClient()

  try {
    // Fetch all warmable data in parallel
    const [orgsResult, profileResult, colorThemeResult] = await Promise.all([
      admin
        .from("organization_members")
        .select("role, organization:organizations(id, name, slug, logo_url)")
        .eq("user_id", userId),
      admin
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("id", userId)
        .single(),
      admin
        .from("user_settings")
        .select("color_theme")
        .eq("user_id", userId)
        .single(),
    ])

    const orgs =
      orgsResult.data
        ?.filter((m: any) => m.organization)
        .map((m: any) => ({
          ...m.organization,
          role: m.role,
        })) ?? []

    // Write user data to cache (non-blocking)
    const colorTheme = colorThemeResult.data?.color_theme || "default"
    const writes: Promise<any>[] = [
      kv.set(CacheKeys.user(userId), profileResult.data, {
        ex: CacheTTL.USER,
      }),
      kv.set(CacheKeys.userOrgs(userId), orgs, { ex: CacheTTL.ORGS }),
      kv.set(CacheKeys.colorTheme(userId), colorTheme, {
        ex: CacheTTL.USER,
      }),
    ]

    // Cache membership for each org
    for (const org of orgs) {
      writes.push(
        kv.set(CacheKeys.membership(org.id, userId), { role: org.role }, {
          ex: CacheTTL.MEMBERSHIP,
        })
      )
    }

    // Warm sidebar for primary org
    if (orgs.length > 0) {
      const primaryOrgId = orgs[0].id
      const { data: projects } = await admin
        .from("projects")
        .select("id, name, status, progress, updated_at")
        .eq("organization_id", primaryOrgId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(SIDEBAR_PROJECT_LIMIT)

      if (projects) {
        writes.push(
          kv.set(CacheKeys.sidebar(primaryOrgId), projects, {
            ex: CacheTTL.SIDEBAR,
          })
        )
      }
    }

    // Fire all writes in parallel, don't await individually
    await Promise.allSettled(writes)
  } catch (error) {
    // Non-fatal - cache warming is best-effort
    logger.error("warmUserCache error", { module: "cache", error })
  }
}
