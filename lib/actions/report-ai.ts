"use server"

import { generateText } from "./ai/generation"
import { requireAuth } from "./auth-helpers"
import { checkRateLimit, rateLimiters, rateLimitError } from "@/lib/rate-limit"
import type { ActionResult } from "./types"

// ============================================
// Generate narrative for a project (Step 2)
// ============================================

export async function generateReportNarrative(params: {
  projectId: string
  projectName: string
  clientName?: string
  status: string
  progressPercent: number
  previousProgress?: number | null
  teamContributions: { memberName: string; contribution: string }[]
}): Promise<ActionResult<string>> {
  const { user, supabase } = await requireAuth()

  // Rate limit AI generation
  const rl = await checkRateLimit(rateLimiters.ai, user.id)
  if (!rl.success) return rateLimitError(rl.reset)

  // Fetch recent task activity for this project
  const today = new Date()
  const oneWeekAgo = new Date(today)
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const [completedResult, inProgressResult, overdueResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("name")
      .eq("project_id", params.projectId)
      .eq("status", "done")
      .gte("updated_at", oneWeekAgo.toISOString())
      .limit(10),
    supabase
      .from("tasks")
      .select("name")
      .eq("project_id", params.projectId)
      .eq("status", "in-progress")
      .limit(10),
    supabase
      .from("tasks")
      .select("name, end_date")
      .eq("project_id", params.projectId)
      .neq("status", "done")
      .lt("end_date", today.toISOString().split("T")[0])
      .limit(5),
  ])

  const completedTasks = completedResult.data ?? []
  const inProgressTasks = inProgressResult.data ?? []
  const overdueTasks = overdueResult.data ?? []

  const teamContext = params.teamContributions
    .filter((c) => c.contribution.trim())
    .map((c) => `- ${c.memberName}: ${c.contribution}`)
    .join("\n")

  const progressDelta =
    params.previousProgress !== null && params.previousProgress !== undefined
      ? params.progressPercent - params.previousProgress
      : null

  const systemPrompt = `You are a professional project management report writer. Write concise, factual project status narratives for weekly reports. Use a professional but clear tone. Do NOT use markdown formatting — write plain text paragraphs only.`

  const userPrompt = `Write a 2-3 sentence narrative for the following project status update:

Project: ${params.projectName}${params.clientName ? ` (Client: ${params.clientName})` : ""}
Status: ${params.status.replace("_", " ")}
Progress: ${params.progressPercent}%${progressDelta !== null ? ` (${progressDelta > 0 ? "+" : ""}${progressDelta}% from last week)` : ""}

${completedTasks.length > 0 ? `Completed this week (${completedTasks.length}): ${completedTasks.map((t) => t.name).join(", ")}` : "No tasks completed this week."}
${inProgressTasks.length > 0 ? `Currently in progress (${inProgressTasks.length}): ${inProgressTasks.map((t) => t.name).join(", ")}` : ""}
${overdueTasks.length > 0 ? `Overdue tasks (${overdueTasks.length}): ${overdueTasks.map((t) => t.name).join(", ")}` : ""}
${teamContext ? `\nTeam activity:\n${teamContext}` : ""}

Write a brief, professional narrative summarizing progress, key accomplishments, and any concerns. Keep it factual and concise (2-3 sentences). Do not use bullet points or headers.`

  const result = await generateText(userPrompt, systemPrompt, {
    temperature: 0.5,
    maxTokens: 300,
  })

  if (result.error) return { error: result.error }
  return { data: result.data!.text.trim() }
}

// ============================================
// Suggest risks based on project data (Step 4)
// ============================================

export async function suggestReportRisks(params: {
  projects: {
    id: string
    name: string
    status: string
    progressPercent: number
    narrative?: string
  }[]
  existingRisks: { description: string; type: string; severity: string }[]
}): Promise<
  ActionResult<
    {
      type: "blocker" | "risk"
      description: string
      severity: "low" | "medium" | "high" | "critical"
      projectName?: string
    }[]
  >
> {
  const { user: riskUser } = await requireAuth()
  const rl = await checkRateLimit(rateLimiters.ai, riskUser.id)
  if (!rl.success) return rateLimitError(rl.reset)

  const projectSummaries = params.projects
    .map(
      (p) =>
        `- ${p.name}: Status=${p.status.replace("_", " ")}, Progress=${p.progressPercent}%${p.narrative ? `, Notes: ${p.narrative}` : ""}`,
    )
    .join("\n")

  const existingRisksSummary =
    params.existingRisks.length > 0
      ? `\nAlready identified risks/blockers (do NOT duplicate these):\n${params.existingRisks.map((r) => `- [${r.type}/${r.severity}] ${r.description}`).join("\n")}`
      : ""

  const systemPrompt = `You are a project risk analyst. Identify potential risks and blockers based on project status data. Return ONLY a JSON array. No markdown, no explanation.`

  const userPrompt = `Based on the following project statuses, suggest 2-4 potential risks or blockers that should be tracked:

Projects:
${projectSummaries}
${existingRisksSummary}

Focus on:
- Projects that are behind schedule or at risk
- Low progress relative to timeline
- Resource or dependency risks
- Patterns that suggest problems

Return a JSON array in this exact format:
[
  {
    "type": "blocker" or "risk",
    "description": "Clear description of the risk",
    "severity": "low" | "medium" | "high" | "critical",
    "projectName": "Name of relevant project or null"
  }
]

Only return the JSON array.`

  const result = await generateText(userPrompt, systemPrompt, {
    temperature: 0.6,
    maxTokens: 600,
  })

  if (result.error) return { error: result.error }

  try {
    let jsonText = result.data!.text.trim()
    if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7)
    else if (jsonText.startsWith("```")) jsonText = jsonText.slice(3)
    if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3)

    const suggestions = JSON.parse(jsonText.trim())
    return { data: suggestions }
  } catch {
    return { error: "Failed to parse AI risk suggestions" }
  }
}

// ============================================
// Suggest highlights based on project data (Step 5)
// ============================================

export async function suggestReportHighlights(params: {
  projects: {
    name: string
    status: string
    progressPercent: number
    previousProgress?: number | null
    narrative?: string
  }[]
  existingHighlights: string[]
}): Promise<ActionResult<{ description: string; projectName?: string }[]>> {
  const { user: highlightUser } = await requireAuth()
  const hlRl = await checkRateLimit(rateLimiters.ai, highlightUser.id)
  if (!hlRl.success) return rateLimitError(hlRl.reset)

  const projectSummaries = params.projects
    .map((p) => {
      const delta =
        p.previousProgress !== null && p.previousProgress !== undefined
          ? p.progressPercent - p.previousProgress
          : null
      return `- ${p.name}: Status=${p.status.replace("_", " ")}, Progress=${p.progressPercent}%${delta !== null ? ` (${delta > 0 ? "+" : ""}${delta}%)` : ""}${p.narrative ? `, Notes: ${p.narrative}` : ""}`
    })
    .join("\n")

  const existingSummary =
    params.existingHighlights.length > 0
      ? `\nAlready listed highlights (do NOT duplicate):\n${params.existingHighlights.map((h) => `- ${h}`).join("\n")}`
      : ""

  const systemPrompt = `You are a project management report writer. Identify key achievements and highlights from project status data. Return ONLY a JSON array. No markdown, no explanation.`

  const userPrompt = `Based on the following project statuses, suggest 2-3 noteworthy highlights or achievements for this week's report:

Projects:
${projectSummaries}
${existingSummary}

Focus on:
- Significant progress or milestones reached
- Projects that moved from behind/at-risk to on-track
- Large progress jumps
- Notable accomplishments mentioned in narratives

Return a JSON array in this exact format:
[
  {
    "description": "Clear, concise highlight statement",
    "projectName": "Name of relevant project or null"
  }
]

Only return the JSON array.`

  const result = await generateText(userPrompt, systemPrompt, {
    temperature: 0.5,
    maxTokens: 400,
  })

  if (result.error) return { error: result.error }

  try {
    let jsonText = result.data!.text.trim()
    if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7)
    else if (jsonText.startsWith("```")) jsonText = jsonText.slice(3)
    if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3)

    const suggestions = JSON.parse(jsonText.trim())
    return { data: suggestions }
  } catch {
    return { error: "Failed to parse AI highlight suggestions" }
  }
}
