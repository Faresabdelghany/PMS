"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember, requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

export type Skill = {
  id: string
  org_id: string
  name: string
  description: string | null
  category: string | null
  version: string | null
  author: string | null
  installed: boolean
  enabled: boolean
  config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type SkillInsert = Omit<Skill, "id" | "created_at" | "updated_at">
export type SkillUpdate = Partial<Omit<Skill, "id" | "org_id" | "created_at" | "updated_at">>

type CatalogSkill = {
  name: string
  description: string
  category: string
  version: string
  author: string
}

type MarketplaceSkillsPayload = {
  skills: Skill[]
  degraded: boolean
}

// Static fallback catalog for graceful degradation when gateway catalog is unavailable.
const FALLBACK_SKILL_CATALOG: CatalogSkill[] = [
  { name: "read", description: "Read file contents", category: "filesystem", version: "1.0.0", author: "OpenClaw" },
  { name: "write", description: "Create or overwrite files", category: "filesystem", version: "1.0.0", author: "OpenClaw" },
  { name: "edit", description: "Make precise edits to files", category: "filesystem", version: "1.0.0", author: "OpenClaw" },
  { name: "exec", description: "Run shell commands", category: "development", version: "1.0.0", author: "OpenClaw" },
  { name: "process", description: "Manage running shell sessions", category: "development", version: "1.0.0", author: "OpenClaw" },
  { name: "web_search", description: "Search the web", category: "research", version: "1.0.0", author: "OpenClaw" },
  { name: "web_fetch", description: "Fetch and extract page content", category: "research", version: "1.0.0", author: "OpenClaw" },
  { name: "browser", description: "Control a web browser", category: "automation", version: "1.0.0", author: "OpenClaw" },
  { name: "canvas", description: "Control node canvases", category: "automation", version: "1.0.0", author: "OpenClaw" },
  { name: "nodes", description: "Control paired nodes/devices", category: "nodes", version: "1.0.0", author: "OpenClaw" },
  { name: "message", description: "Send/manage channel messages", category: "communication", version: "1.0.0", author: "OpenClaw" },
  { name: "tts", description: "Text-to-speech synthesis", category: "media", version: "1.0.0", author: "OpenClaw" },
  { name: "image", description: "Analyze images with vision", category: "media", version: "1.0.0", author: "OpenClaw" },
  { name: "subagents", description: "List/steer/kill sub-agents", category: "automation", version: "1.0.0", author: "OpenClaw" },
]

function toCatalogSkill(input: any): CatalogSkill | null {
  const nameRaw = input?.name ?? input?.id ?? input?.tool ?? input?.slug ?? input?.title
  const name = typeof nameRaw === "string" ? nameRaw.trim() : ""
  if (!name) return null

  const description =
    (typeof input?.description === "string" && input.description.trim()) ||
    (typeof input?.summary === "string" && input.summary.trim()) ||
    (typeof input?.help === "string" && input.help.trim()) ||
    ""

  const category =
    (typeof input?.category === "string" && input.category.trim().toLowerCase()) ||
    (typeof input?.group === "string" && input.group.trim().toLowerCase()) ||
    "automation"

  const version = (typeof input?.version === "string" && input.version.trim()) || "1.0.0"
  const author = (typeof input?.author === "string" && input.author.trim()) || "OpenClaw"

  return { name, description, category, version, author }
}

async function fetchCatalogFromGateway(baseUrl: string, token?: string | null): Promise<CatalogSkill[] | null> {
  const trimmedBase = baseUrl.replace(/\/+$/, "")
  const candidates = ["/api/skills", "/api/skills/list", "/skills", "/api/tools", "/tools"]

  for (const endpoint of candidates) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2500)
      const headers: Record<string, string> = { Accept: "application/json" }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch(`${trimmedBase}${endpoint}`, {
        method: "GET",
        headers,
        cache: "no-store",
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) continue

      const payload = await res.json()
      const rawList =
        (Array.isArray(payload) && payload) ||
        (Array.isArray(payload?.skills) && payload.skills) ||
        (Array.isArray(payload?.tools) && payload.tools) ||
        (Array.isArray(payload?.data) && payload.data) ||
        []

      const parsed = rawList
        .map((item: any) => toCatalogSkill(item))
        .filter((item: CatalogSkill | null): item is CatalogSkill => Boolean(item))

      if (parsed.length > 0) {
        return parsed
      }
    } catch {
      // Try next candidate endpoint.
    }
  }

  return null
}

async function getCatalogForOrg(orgId: string): Promise<{ catalog: CatalogSkill[]; degraded: boolean }> {
  try {
    const { supabase } = await requireOrgMember(orgId)
    const { data: gateways } = await supabase
      .from("gateways" as any)
      .select("url, auth_mode, auth_token, status, last_seen_at")
      .eq("org_id", orgId)
      .order("last_seen_at", { ascending: false })

    const gatewayRows = ((gateways ?? []) as unknown[]) as Array<{
      url: string
      auth_mode: "none" | "token" | "basic" | null
      auth_token: string | null
      status: string | null
      last_seen_at: string | null
    }>

    const prioritized = [...gatewayRows].sort((a, b) => {
      const aOnline = a.status === "online" ? 0 : 1
      const bOnline = b.status === "online" ? 0 : 1
      return aOnline - bOnline
    })

    for (const gateway of prioritized) {
      if (!gateway.url) continue
      const token = gateway.auth_mode === "token" ? gateway.auth_token : null
      const catalog = await fetchCatalogFromGateway(gateway.url, token)
      if (catalog && catalog.length > 0) {
        return { catalog, degraded: false }
      }
    }
  } catch {
    // Fall through to fallback.
  }

  return { catalog: FALLBACK_SKILL_CATALOG, degraded: true }
}

function mergeCatalogWithOrgSkills(orgId: string, catalog: CatalogSkill[], orgSkills: Skill[]): Skill[] {
  const orgByName = new Map(orgSkills.map((s) => [s.name.toLowerCase(), s]))
  const merged: Skill[] = []
  const seenNames = new Set<string>()

  for (const catalogSkill of catalog) {
    const key = catalogSkill.name.toLowerCase()
    if (seenNames.has(key)) continue
    seenNames.add(key)

    const existing = orgByName.get(key)
    if (existing) {
      merged.push({
        ...existing,
        description: catalogSkill.description || existing.description,
        category: catalogSkill.category || existing.category,
        version: catalogSkill.version || existing.version,
        author: catalogSkill.author || existing.author,
      })
      continue
    }

    merged.push({
      id: `catalog-${catalogSkill.name}`,
      org_id: orgId,
      name: catalogSkill.name,
      description: catalogSkill.description,
      category: catalogSkill.category,
      version: catalogSkill.version,
      author: catalogSkill.author,
      installed: false,
      enabled: false,
      config: null,
      created_at: "",
      updated_at: "",
    })
  }

  // Keep orphaned org skills visible.
  for (const orgSkill of orgSkills) {
    const key = orgSkill.name.toLowerCase()
    if (seenNames.has(key)) continue
    seenNames.add(key)
    merged.push(orgSkill)
  }

  return merged.sort((a, b) => {
    const categoryCompare = (a.category ?? "").localeCompare(b.category ?? "")
    if (categoryCompare !== 0) return categoryCompare
    return a.name.localeCompare(b.name)
  })
}

// ── CRUD: Skills ────────────────────────────────────────────────────

export async function getSkills(orgId: string): Promise<ActionResult<Skill[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("skills" as any)
      .select("*")
      .eq("org_id", orgId)
      .order("category")
      .order("name")

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as Skill[] }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function getMarketplaceSkills(orgId: string): Promise<ActionResult<MarketplaceSkillsPayload>> {
  try {
    const [catalogResult, orgSkillsResult] = await Promise.all([
      getCatalogForOrg(orgId),
      getSkills(orgId),
    ])

    if (orgSkillsResult.error) return { error: orgSkillsResult.error }

    const merged = mergeCatalogWithOrgSkills(orgId, catalogResult.catalog, orgSkillsResult.data ?? [])

    return { data: { skills: merged, degraded: catalogResult.degraded } }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function upsertSkill(
  orgId: string,
  skillData: Omit<SkillInsert, "org_id">
): Promise<ActionResult<Skill>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const name = skillData.name?.trim()
    if (!name) return { error: "Skill name is required" }

    // Check if skill exists by name
    const { data: existing } = await supabase
      .from("skills" as any)
      .select("id")
      .eq("org_id", orgId)
      .eq("name", name)
      .single()

    let result
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from("skills" as any)
        .update({ ...skillData, name })
        .eq("id", (existing as any).id)
        .select()
        .single()
      if (error) return { error: error.message }
      result = data
    } else {
      // Insert new
      const { data, error } = await supabase
        .from("skills" as any)
        .insert({ ...skillData, name, org_id: orgId })
        .select()
        .single()
      if (error) return { error: error.message }
      result = data
    }

    after(() => { revalidatePath("/skills/marketplace"); revalidatePath("/skills") })

    return { data: result as unknown as Skill }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function updateSkill(
  id: string,
  input: SkillUpdate
): Promise<ActionResult<Skill>> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from("skills" as any)
      .select("org_id")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) return { error: "Skill not found" }

    await requireOrgMember((existing as any).org_id)

    const { data, error } = await supabase
      .from("skills" as any)
      .update(input)
      .eq("id", id)
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => { revalidatePath("/skills/marketplace"); revalidatePath("/skills") })

    return { data: data as unknown as Skill }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function deleteSkill(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from("skills" as any)
      .select("org_id")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) return { error: "Skill not found" }

    await requireOrgMember((existing as any).org_id, true)

    const { error } = await supabase.from("skills" as any).delete().eq("id", id)
    if (error) return { error: error.message }

    after(() => { revalidatePath("/skills/marketplace"); revalidatePath("/skills") })

    return {}
  } catch {
    return { error: "Not authorized" }
  }
}

export async function seedDefaultSkills(
  orgId: string
): Promise<ActionResult<{ seeded: number }>> {
  try {
    const { supabase } = await requireOrgMember(orgId, true)

    // Check existing count
    const { count } = await supabase
      .from("skills" as any)
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)

    if ((count ?? 0) > 0) {
      return { data: { seeded: 0 } }
    }

    const toInsert = FALLBACK_SKILL_CATALOG.map((s) => ({
      ...s,
      org_id: orgId,
      installed: false,
      enabled: false,
      config: null,
    }))
    const { data, error } = await supabase.from("skills" as any).insert(toInsert).select()

    if (error) return { error: error.message }

    after(() => { revalidatePath("/skills/marketplace"); revalidatePath("/skills") })

    return { data: { seeded: data?.length ?? 0 } }
  } catch {
    return { error: "Not authorized" }
  }
}
