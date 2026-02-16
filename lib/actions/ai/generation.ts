"use server"

import { cachedGetUser } from "@/lib/request-cache"
import { rateLimiters, checkRateLimit, rateLimitError } from "@/lib/rate-limit/limiter"
import type { ActionResult } from "../types"
import type {
  AIGenerationResult,
  GenerationOptions,
  ProjectContext,
  TaskDescriptionContext,
  WorkstreamDescriptionContext,
  ClientNotesContext,
  FileDescriptionContext,
} from "./types"
import { verifyAIConfig } from "./config"
import {
  callOpenAI,
  callAnthropic,
  callGemini,
  callGroq,
  callMistral,
  callXAI,
  callDeepSeek,
  callOpenRouter,
} from "./providers"
import { sanitizeForPrompt } from "../ai-helpers"

// Generic text generation
export async function generateText(
  prompt: string,
  systemPrompt: string = "You are a helpful assistant for project management tasks.",
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  const configResult = await verifyAIConfig()
  if (configResult.error) {
    return { error: configResult.error }
  }

  // Use cached auth - deduplicates with other calls in the same request
  const { user } = await cachedGetUser()

  if (user) {
    // Check daily AI rate limit
    const dailyLimit = await checkRateLimit(rateLimiters.ai, user.id)
    if (!dailyLimit.success) {
      return rateLimitError(dailyLimit.reset)
    }

    // Check concurrent AI rate limit
    const concurrentLimit = await checkRateLimit(rateLimiters.aiConcurrent, user.id)
    if (!concurrentLimit.success) {
      return rateLimitError(concurrentLimit.reset)
    }
  }

  const { apiKey, provider, model } = configResult.data!

  switch (provider) {
    case "openai":
      return callOpenAI(apiKey, model, systemPrompt, prompt, options)
    case "anthropic":
      return callAnthropic(apiKey, model, systemPrompt, prompt, options)
    case "google":
      return callGemini(apiKey, model, systemPrompt, prompt, options)
    case "groq":
      return callGroq(apiKey, model, systemPrompt, prompt, options)
    case "mistral":
      return callMistral(apiKey, model, systemPrompt, prompt, options)
    case "xai":
      return callXAI(apiKey, model, systemPrompt, prompt, options)
    case "deepseek":
      return callDeepSeek(apiKey, model, systemPrompt, prompt, options)
    case "openrouter":
      return callOpenRouter(apiKey, model, systemPrompt, prompt, options)
    default:
      return { error: `Unsupported AI provider: ${provider}` }
  }
}

// Generate project description
export async function generateProjectDescription(
  context: ProjectContext
): Promise<ActionResult<string>> {
  const systemPrompt = `You are a professional project manager assistant. Generate clear, concise project descriptions that help teams understand the project scope and goals. Keep descriptions between 2-4 paragraphs.`

  const userPrompt = `Generate a professional project description for:
Project Name: ${sanitizeForPrompt(context.name)}
Client: ${sanitizeForPrompt(context.client) || "Internal"}
${context.startDate ? `Timeline: ${sanitizeForPrompt(context.startDate)} to ${sanitizeForPrompt(context.endDate) || "ongoing"}` : ""}
${context.description ? `\nAdditional context: ${sanitizeForPrompt(context.description)}` : ""}

Please write a clear project description that:
1. Summarizes the project purpose
2. Identifies key objectives
3. Outlines expected deliverables`

  const result = await generateText(userPrompt, systemPrompt)

  if (result.error) {
    return { error: result.error }
  }

  return { data: result.data!.text }
}

// Generate tasks for a project
export async function generateTasks(
  context: ProjectContext,
  count: number = 5
): Promise<ActionResult<{ title: string; description: string; priority: string }[]>> {
  const systemPrompt = `You are a project management expert. Generate practical, actionable tasks for projects. Each task should be specific and achievable. Return your response as a JSON array.`

  const existingTasksText = context.existingTasks?.length
    ? `\nExisting tasks (avoid duplicates): ${context.existingTasks.map((t) => sanitizeForPrompt(t.title)).join(", ")}`
    : ""

  const workstreamsText = context.existingWorkstreams?.length
    ? `\nWorkstreams to consider: ${context.existingWorkstreams.map(w => sanitizeForPrompt(w)).join(", ")}`
    : ""

  const userPrompt = `Generate ${count} new tasks for this project:
Project: ${sanitizeForPrompt(context.name)}
${context.description ? `Description: ${sanitizeForPrompt(context.description)}` : ""}
Client: ${sanitizeForPrompt(context.client) || "Internal"}
Status: ${sanitizeForPrompt(context.status) || "active"}
${existingTasksText}
${workstreamsText}

Return a JSON array with exactly ${count} tasks in this format:
[
  {
    "title": "Task title",
    "description": "Brief description of what needs to be done",
    "priority": "high" | "medium" | "low"
  }
]

Only return the JSON array, no other text.`

  const result = await generateText(userPrompt, systemPrompt, { temperature: 0.8 })

  if (result.error) {
    return { error: result.error }
  }

  try {
    // Extract JSON from the response (handle potential markdown code blocks)
    let jsonText = result.data!.text.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3)
    }

    const tasks = JSON.parse(jsonText.trim())
    return { data: tasks }
  } catch {
    return { error: "Failed to parse AI response as tasks" }
  }
}

// Generate workstream suggestions
export async function generateWorkstreams(
  context: ProjectContext,
  count: number = 4
): Promise<ActionResult<{ name: string; description: string }[]>> {
  const systemPrompt = `You are a project management expert. Generate logical workstream/milestone groupings for projects. Return your response as a JSON array.`

  const userPrompt = `Suggest ${count} workstreams/phases for this project:
Project: ${sanitizeForPrompt(context.name)}
${context.description ? `Description: ${sanitizeForPrompt(context.description)}` : ""}
Client: ${sanitizeForPrompt(context.client) || "Internal"}

Return a JSON array with exactly ${count} workstreams in this format:
[
  {
    "name": "Workstream name",
    "description": "Brief description of this phase/workstream"
  }
]

Only return the JSON array, no other text.`

  const result = await generateText(userPrompt, systemPrompt, { temperature: 0.7 })

  if (result.error) {
    return { error: result.error }
  }

  try {
    let jsonText = result.data!.text.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3)
    }

    const workstreams = JSON.parse(jsonText.trim())
    return { data: workstreams }
  } catch {
    return { error: "Failed to parse AI response as workstreams" }
  }
}

// Summarize notes
export async function summarizeNotes(
  notes: { title: string; content: string }[]
): Promise<ActionResult<string>> {
  const systemPrompt = `You are a professional assistant that summarizes meeting notes and project updates. Create clear, actionable summaries.`

  const notesText = notes
    .map((n) => `## ${sanitizeForPrompt(n.title)}\n${sanitizeForPrompt(n.content)}`)
    .join("\n\n")

  const userPrompt = `Please summarize these project notes into key points and action items:

${notesText}

Provide:
1. A brief overall summary (2-3 sentences)
2. Key decisions or updates
3. Action items (if any)
4. Important dates or deadlines mentioned`

  const result = await generateText(userPrompt, systemPrompt)

  if (result.error) {
    return { error: result.error }
  }

  return { data: result.data!.text }
}

// Generate note from voice transcription
export async function enhanceTranscription(
  rawTranscription: string,
  context?: { projectName?: string; meetingType?: string }
): Promise<ActionResult<{ title: string; content: string }>> {
  const systemPrompt = `You are an assistant that formats voice transcriptions into well-structured notes. Clean up filler words, organize thoughts, and add appropriate formatting.`

  const userPrompt = `Format this voice transcription into a clean note:
${context?.projectName ? `Project: ${sanitizeForPrompt(context.projectName)}` : ""}
${context?.meetingType ? `Meeting type: ${context.meetingType}` : ""}

Transcription:
${sanitizeForPrompt(rawTranscription)}

Return a JSON object with:
{
  "title": "A concise title for this note",
  "content": "The formatted note content with proper structure"
}

Only return the JSON object, no other text.`

  const result = await generateText(userPrompt, systemPrompt, { temperature: 0.3 })

  if (result.error) {
    return { error: result.error }
  }

  try {
    let jsonText = result.data!.text.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3)
    }

    const note = JSON.parse(jsonText.trim())
    return { data: note }
  } catch {
    return { error: "Failed to parse AI response" }
  }
}

// Enhance note content - takes user's rough notes and improves them
export async function enhanceNoteContent(
  content: string,
  context?: { title?: string; projectName?: string; noteType?: "general" | "meeting" }
): Promise<ActionResult<string>> {
  // Validate content length
  const trimmedContent = content.trim()
  if (trimmedContent.length < 10) {
    return { error: "Content is too short to enhance. Please add more text." }
  }
  if (trimmedContent.length > 50000) {
    return { error: "Content is too long. Please reduce the text length." }
  }

  const systemPrompt = `You are a professional note-writing assistant. Your job is to transform rough notes into well-written, professional documentation while preserving all the original information.

CRITICAL RULES:
1. Keep ALL specific details from the original: names, dates, deadlines, amounts, decisions
2. Expand brief points into clear, complete sentences
3. Add professional context and structure
4. Use proper business language

Your enhancements:
- Transform bullet points into clear paragraphs or organized lists
- Add context to make notes understandable to others
- Structure with clear sections: Summary, Discussion Points, Decisions/Agreements, Action Items, Next Steps
- Use <strong> to highlight key items: names, dates, deadlines, amounts
- Write in a professional but clear tone

Output clean HTML. Use: <p>, <strong>, <ul>/<li>, <ol>/<li>, <h3> tags.
Do NOT use markdown.`

  const noteTypeContext = context?.noteType === "meeting"
    ? "This is a meeting note - structure with: Attendees (if mentioned), Discussion Topics, Key Decisions, Action Items, and Next Steps."
    : ""

  const userPrompt = `Transform these rough notes into professional, well-written documentation. Keep ALL original details but expand and improve the writing:

${context?.title ? `Title: ${sanitizeForPrompt(context.title)}` : ""}
${context?.projectName ? `Project: ${sanitizeForPrompt(context.projectName)}` : ""}
${noteTypeContext}

ROUGH NOTES:
"""
${sanitizeForPrompt(content)}
"""

Write a professional note that:
1. Preserves every detail (names, dates, deadlines, decisions)
2. Expands brief points into clear sentences
3. Organizes with appropriate sections
4. Is easy to read and understand

Return the enhanced HTML content.`

  const result = await generateText(userPrompt, systemPrompt, { temperature: 0.4 })

  if (result.error) {
    return { error: result.error }
  }

  // Clean up the response - remove any markdown code blocks if present
  let enhancedContent = result.data!.text.trim()
  if (enhancedContent.startsWith("```html")) {
    enhancedContent = enhancedContent.slice(7)
  } else if (enhancedContent.startsWith("```")) {
    enhancedContent = enhancedContent.slice(3)
  }
  if (enhancedContent.endsWith("```")) {
    enhancedContent = enhancedContent.slice(0, -3)
  }

  return { data: enhancedContent.trim() }
}

// Generate task description
export async function generateTaskDescription(
  context: TaskDescriptionContext
): Promise<ActionResult<string>> {
  const isEnhance = Boolean(context.existingDescription?.trim())

  const systemPrompt = isEnhance
    ? `You are a project management assistant. Improve and expand the given task description while keeping the original intent. Output clean HTML using <p>, <strong>, <ul>/<li>, <ol>/<li> tags. Do NOT use markdown.`
    : `You are a project management assistant. Generate clear, actionable task descriptions that help team members understand what needs to be done. Output clean HTML using <p>, <strong>, <ul>/<li>, <ol>/<li> tags. Do NOT use markdown.`

  const userPrompt = isEnhance
    ? `Improve this task description:
Task: ${sanitizeForPrompt(context.taskName)}
${context.projectName ? `Project: ${sanitizeForPrompt(context.projectName)}` : ""}
${context.priority ? `Priority: ${sanitizeForPrompt(context.priority)}` : ""}

Current description:
"""
${sanitizeForPrompt(context.existingDescription!)}
"""

Enhance the description to be clearer and more actionable while preserving the original intent. Return HTML.`
    : `Generate a task description for:
Task: ${sanitizeForPrompt(context.taskName)}
${context.projectName ? `Project: ${sanitizeForPrompt(context.projectName)}` : ""}
${context.priority ? `Priority: ${sanitizeForPrompt(context.priority)}` : ""}
${context.status ? `Status: ${sanitizeForPrompt(context.status)}` : ""}

Write a focused description that:
1. Clarifies the objective
2. Lists key steps or acceptance criteria
3. Notes any dependencies or considerations

Return HTML.`

  const result = await generateText(userPrompt, systemPrompt, { temperature: 0.5 })

  if (result.error) {
    return { error: result.error }
  }

  let text = result.data!.text.trim()
  if (text.startsWith("```html")) text = text.slice(7)
  else if (text.startsWith("```")) text = text.slice(3)
  if (text.endsWith("```")) text = text.slice(0, -3)

  return { data: text.trim() }
}

// Generate workstream description
export async function generateWorkstreamDescription(
  context: WorkstreamDescriptionContext
): Promise<ActionResult<string>> {
  const systemPrompt = `You are a project management assistant. Generate concise workstream descriptions that explain the purpose and scope of a project phase. Output clean HTML using <p>, <strong>, <ul>/<li> tags. Do NOT use markdown.`

  const userPrompt = `Generate a workstream description for:
Workstream: ${sanitizeForPrompt(context.workstreamName)}
${context.projectName ? `Project: ${sanitizeForPrompt(context.projectName)}` : ""}

Write a brief description (1-2 paragraphs) that:
1. Explains the purpose of this workstream
2. Outlines the scope of work
3. Mentions expected outcomes

Return HTML.`

  const result = await generateText(userPrompt, systemPrompt, { temperature: 0.5 })

  if (result.error) {
    return { error: result.error }
  }

  let text = result.data!.text.trim()
  if (text.startsWith("```html")) text = text.slice(7)
  else if (text.startsWith("```")) text = text.slice(3)
  if (text.endsWith("```")) text = text.slice(0, -3)

  return { data: text.trim() }
}

// Generate client notes
export async function generateClientNotes(
  context: ClientNotesContext
): Promise<ActionResult<string>> {
  const systemPrompt = `You are a professional account manager assistant. Generate brief client notes that capture key context about a client relationship. Output plain text (NOT HTML). Keep it concise — 3-5 short paragraphs.`

  const userPrompt = `Generate client notes for:
Client: ${sanitizeForPrompt(context.clientName)}
${context.industry ? `Industry: ${sanitizeForPrompt(context.industry)}` : ""}
${context.status ? `Status: ${sanitizeForPrompt(context.status)}` : ""}
${context.contactName ? `Primary contact: ${sanitizeForPrompt(context.contactName)}` : ""}
${context.contactEmail ? `Contact email: ${sanitizeForPrompt(context.contactEmail)}` : ""}
${context.location ? `Location: ${sanitizeForPrompt(context.location)}` : ""}
${context.website ? `Website: ${sanitizeForPrompt(context.website)}` : ""}

Write a brief client summary covering:
1. Client overview and relationship context
2. Key focus areas or expectations
3. Any relevant notes for the team

Return plain text only. No HTML or markdown.`

  const result = await generateText(userPrompt, systemPrompt, { temperature: 0.5 })

  if (result.error) {
    return { error: result.error }
  }

  let text = result.data!.text.trim()
  if (text.startsWith("```")) text = text.slice(3)
  if (text.endsWith("```")) text = text.slice(0, -3)

  return { data: text.trim() }
}

// Generate file/asset description
export async function generateFileDescription(
  context: FileDescriptionContext
): Promise<ActionResult<string>> {
  const systemPrompt = `You are a project management assistant. Generate short, descriptive asset descriptions. Output clean HTML using <p> tags. Keep it to 1-2 sentences. Do NOT use markdown.`

  const userPrompt = `Generate a short description for this project asset:
Asset name: ${sanitizeForPrompt(context.fileName)}
${context.projectName ? `Project: ${sanitizeForPrompt(context.projectName)}` : ""}

Write 1-2 sentences describing what this asset likely contains and its purpose in the project. Return HTML.`

  const result = await generateText(userPrompt, systemPrompt, { temperature: 0.4 })

  if (result.error) {
    return { error: result.error }
  }

  let text = result.data!.text.trim()
  if (text.startsWith("```html")) text = text.slice(7)
  else if (text.startsWith("```")) text = text.slice(3)
  if (text.endsWith("```")) text = text.slice(0, -3)

  return { data: text.trim() }
}

// Test AI connection
export async function testAIConnection(): Promise<ActionResult<{ success: boolean; model: string }>> {
  const configResult = await verifyAIConfig()
  if (configResult.error) {
    return { error: configResult.error }
  }

  const result = await generateText(
    "Say 'Connection successful!' in exactly those words.",
    "You are a test assistant. Follow instructions exactly.",
    { maxTokens: 50 }
  )

  if (result.error) {
    return { error: result.error }
  }

  return {
    data: {
      success: result.data!.text.toLowerCase().includes("connection successful"),
      model: result.data!.model,
    },
  }
}
