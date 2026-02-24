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
  task?: {
    id: string
    name: string
  } | null
}

export interface TaskSelectorOption {
  id: string
  title: string
  projectName: string | null
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

// ── Org-wide Queries ─────────────────────────────────────────────────

/**
 * Fetch all documents for an organization (across all tasks/agents).
 * Includes agent and task joins for display.
 */
export async function getOrgDocuments(
  orgId: string
): Promise<ActionResult<AgentDocument[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await (supabase as any)
    .from("agent_documents")
    .select(`
      *,
      agent:agents(id, name),
      task:tasks(id, name)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: (data ?? []) as unknown as AgentDocument[] }
}

/**
 * Fetch tasks for the "New Document" form task selector.
 * Returns a lightweight list of tasks with their project names.
 */
export async function getTasksForSelector(
  orgId: string
): Promise<ActionResult<TaskSelectorOption[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id,
      name,
      project:projects!inner(id, name, organization_id)
    `)
    .eq("project.organization_id", orgId)
    .order("name", { ascending: true })
    .limit(500)

  if (error) {
    return { error: error.message }
  }

  const tasks = (data ?? []) as unknown as Array<{
    id: string
    name: string
    project: { id: string; name: string; organization_id: string } | null
  }>

  return {
    data: tasks.map((t) => ({
      id: t.id,
      title: t.name,
      projectName: t.project?.name ?? null,
    })),
  }
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
      agent:agents(id, name),
      task:tasks(id, name)
    `)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as unknown as AgentDocument }
}
