"use server"

import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "./types"

export type ActivityItem = {
  id: string
  agent_id: string
  agent_name: string
  agent_role: string
  activity_type: string
  title: string
  description: string | null
  metadata: any
  created_at: string
}

export async function getActivityFeed(
  orgId: string,
  limit = 50
): Promise<ActionResult<ActivityItem[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("agent_activities")
    .select("id, agent_id, activity_type, title, description, metadata, created_at, agent:agents!inner(name, role, organization_id)")
    .eq("agents.organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { error: error.message }
  }

  const items = (data || []).map((a: any) => ({
    id: a.id,
    agent_id: a.agent_id,
    agent_name: a.agent?.name || "Unknown",
    agent_role: a.agent?.role || "",
    activity_type: a.activity_type,
    title: a.title,
    description: a.description,
    metadata: a.metadata,
    created_at: a.created_at,
  }))

  return { data: items }
}
