"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

// ── Types ────────────────────────────────────────────────────────────

export type DocType = "deliverable" | "research" | "protocol" | "draft" | "report"

export interface AgentDocument {
  id: string
  organization_id: string
  task_id: string | null
  agent_id: string | null
  title: string
  content: string
  doc_type: DocType
  created_at: string
  updated_at: string
  agent?: {
    id: string
    name: string
  } | null
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getDocuments(
  taskId: string
): Promise<ActionResult<AgentDocument[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await (supabase as any)
    .from("agent_documents")
    .select(`
      *,
      agent:agents(id, name)
    `)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: (data ?? []) as unknown as AgentDocument[] }
}

export async function getDocument(
  docId: string
): Promise<ActionResult<AgentDocument>> {
  const { supabase } = await requireAuth()

  const { data, error } = await (supabase as any)
    .from("agent_documents")
    .select(`
      *,
      agent:agents(id, name)
    `)
    .eq("id", docId)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as unknown as AgentDocument }
}

// ── Mutations ────────────────────────────────────────────────────────

export async function createDocument(
  orgId: string,
  input: {
    taskId?: string | null
    agentId?: string | null
    title: string
    content: string
    docType?: DocType
  }
): Promise<ActionResult<AgentDocument>> {
  const { supabase } = await requireAuth()

  const { data, error } = await (supabase as any)
    .from("agent_documents")
    .insert({
      organization_id: orgId,
      task_id: input.taskId ?? null,
      agent_id: input.agentId ?? null,
      title: input.title,
      content: input.content,
      doc_type: input.docType ?? "deliverable",
    })
    .select(`
      *,
      agent:agents(id, name)
    `)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as unknown as AgentDocument }
}
