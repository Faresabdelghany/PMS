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

// Default skills to seed for a new organization
const DEFAULT_SKILLS: Array<Omit<SkillInsert, "org_id">> = [
  {
    name: "Web Search",
    description: "Search the web for information using Brave Search API",
    category: "research",
    version: "1.0.0",
    author: "OpenClaw",
    installed: true,
    enabled: true,
    config: null,
  },
  {
    name: "Code Execution",
    description: "Execute code in a sandboxed environment",
    category: "development",
    version: "1.0.0",
    author: "OpenClaw",
    installed: true,
    enabled: true,
    config: null,
  },
  {
    name: "File Management",
    description: "Read, write, and manage files on the gateway workspace",
    category: "filesystem",
    version: "1.0.0",
    author: "OpenClaw",
    installed: false,
    enabled: true,
    config: null,
  },
  {
    name: "Browser Control",
    description: "Automate web browsers for scraping and testing",
    category: "automation",
    version: "1.0.0",
    author: "OpenClaw",
    installed: false,
    enabled: true,
    config: null,
  },
  {
    name: "Slack Integration",
    description: "Send messages and interact with Slack workspaces",
    category: "communication",
    version: "1.0.0",
    author: "OpenClaw",
    installed: false,
    enabled: false,
    config: null,
  },
  {
    name: "GitHub Integration",
    description: "Create PRs, review code, and manage GitHub repositories",
    category: "development",
    version: "1.0.0",
    author: "OpenClaw",
    installed: false,
    enabled: false,
    config: null,
  },
  {
    name: "Email",
    description: "Send and receive emails via SMTP/IMAP",
    category: "communication",
    version: "1.0.0",
    author: "OpenClaw",
    installed: false,
    enabled: false,
    config: null,
  },
  {
    name: "Database Query",
    description: "Execute read-only SQL queries against connected databases",
    category: "data",
    version: "1.0.0",
    author: "OpenClaw",
    installed: false,
    enabled: false,
    config: null,
  },
]

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

    after(() => revalidatePath("/mission-control/skills"))

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

    after(() => revalidatePath("/mission-control/skills"))

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

    after(() => revalidatePath("/mission-control/skills"))

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

    const toInsert = DEFAULT_SKILLS.map((s) => ({ ...s, org_id: orgId }))
    const { data, error } = await supabase.from("skills" as any).insert(toInsert).select()

    if (error) return { error: error.message }

    after(() => revalidatePath("/mission-control/skills"))

    return { data: { seeded: data?.length ?? 0 } }
  } catch {
    return { error: "Not authorized" }
  }
}
