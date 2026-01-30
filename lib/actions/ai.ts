"use server"

import { createClient } from "@/lib/supabase/server"
import { getDecryptedApiKey, getAISettings } from "./user-settings"
import { rateLimiters, checkRateLimit, rateLimitError } from "@/lib/rate-limit/limiter"
import type { ActionResult } from "./types"


// AI generation context for projects
export type ProjectContext = {
  name: string
  description?: string
  client?: string
  status?: string
  startDate?: string
  endDate?: string
  existingTasks?: { title: string; status: string }[]
  existingWorkstreams?: string[]
}

// AI generation options
export type GenerationOptions = {
  maxTokens?: number
  temperature?: number
}

// AI generation result
export type AIGenerationResult = {
  text: string
  model: string
  tokensUsed?: number
}

// Verify AI is configured
async function verifyAIConfig(): Promise<
  ActionResult<{ apiKey: string; provider: string; model: string }>
> {
  const settingsResult = await getAISettings()
  if (settingsResult.error) {
    return { error: settingsResult.error }
  }

  if (!settingsResult.data?.ai_provider) {
    return { error: "AI provider not configured. Please configure AI settings first." }
  }

  const apiKeyResult = await getDecryptedApiKey()
  if (apiKeyResult.error) {
    return { error: apiKeyResult.error }
  }

  if (!apiKeyResult.data) {
    return { error: "AI API key not configured. Please add your API key in settings." }
  }

  return {
    data: {
      apiKey: apiKeyResult.data,
      provider: settingsResult.data.ai_provider,
      model: settingsResult.data.ai_model_preference || getDefaultModel(settingsResult.data.ai_provider),
    },
  }
}

// Get default model for provider
function getDefaultModel(provider: string): string {
  switch (provider) {
    case "openai":
      return "gpt-4o-mini"
    case "anthropic":
      return "claude-3-5-haiku-20241022"
    case "google":
      return "gemini-1.5-flash"
    default:
      return "gpt-4o-mini"
  }
}

// Make API call to OpenAI
async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || "OpenAI API error" }
    }

    const data = await response.json()
    return {
      data: {
        text: data.choices[0]?.message?.content || "",
        model,
        tokensUsed: data.usage?.total_tokens,
      },
    }
  } catch (error) {
    return { error: `Failed to call OpenAI: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

// Make API call to Anthropic
async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens || 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || "Anthropic API error" }
    }

    const data = await response.json()
    return {
      data: {
        text: data.content[0]?.text || "",
        model,
        tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
      },
    }
  } catch (error) {
    return { error: `Failed to call Anthropic: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

// Make API call to Google Gemini
async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            maxOutputTokens: options.maxTokens || 2000,
            temperature: options.temperature || 0.7,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || "Gemini API error" }
    }

    const data = await response.json()
    return {
      data: {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        model,
        tokensUsed: data.usageMetadata?.totalTokenCount,
      },
    }
  } catch (error) {
    return { error: `Failed to call Gemini: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

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

  // Get user ID for rate limiting
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
Project Name: ${context.name}
Client: ${context.client || "Internal"}
${context.startDate ? `Timeline: ${context.startDate} to ${context.endDate || "ongoing"}` : ""}
${context.description ? `\nAdditional context: ${context.description}` : ""}

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
    ? `\nExisting tasks (avoid duplicates): ${context.existingTasks.map((t) => t.title).join(", ")}`
    : ""

  const workstreamsText = context.existingWorkstreams?.length
    ? `\nWorkstreams to consider: ${context.existingWorkstreams.join(", ")}`
    : ""

  const userPrompt = `Generate ${count} new tasks for this project:
Project: ${context.name}
${context.description ? `Description: ${context.description}` : ""}
Client: ${context.client || "Internal"}
Status: ${context.status || "active"}
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
Project: ${context.name}
${context.description ? `Description: ${context.description}` : ""}
Client: ${context.client || "Internal"}

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
    .map((n) => `## ${n.title}\n${n.content}`)
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
${context?.projectName ? `Project: ${context.projectName}` : ""}
${context?.meetingType ? `Meeting type: ${context.meetingType}` : ""}

Transcription:
${rawTranscription}

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

// =============================================================================
// Chat Completion Types and Functions
// =============================================================================

// Chat message types
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatContext {
  pageType: 'projects_list' | 'project_detail' | 'my_tasks' | 'clients_list' | 'client_detail' | 'settings' | 'inbox' | 'other'
  projectId?: string
  clientId?: string
  filters?: Record<string, unknown>
  // Full application data
  appData: {
    organization: { id: string; name: string }
    projects: { id: string; name: string; status: string; clientName?: string; dueDate?: string }[]
    clients: { id: string; name: string; status: string; projectCount: number }[]
    teams: { id: string; name: string; memberCount: number }[]
    members: { id: string; name: string; email: string; role: string }[]
    userTasks: { id: string; title: string; projectName: string; status: string; priority: string; dueDate?: string }[]
    inbox: { id: string; title: string; type: string; read: boolean; createdAt: string }[]
    // Detail data when on specific pages
    currentProject?: {
      id: string
      name: string
      description?: string
      status: string
      workstreams: { id: string; name: string }[]
      tasks: { id: string; title: string; status: string; priority: string; assignee?: string }[]
      notes: { id: string; title: string; content?: string }[]
      files: { id: string; name: string; type: string }[]
      members: { id: string; name: string; role: string }[]
    }
    currentClient?: {
      id: string
      name: string
      email?: string
      phone?: string
      status: string
      projects: { id: string; name: string; status: string }[]
    }
  }
  attachments?: { name: string; content: string }[]
}

export interface ProposedAction {
  type:
    | 'create_task' | 'update_task' | 'delete_task' | 'assign_task'
    | 'create_project' | 'update_project'
    | 'create_workstream' | 'update_workstream'
    | 'create_client' | 'update_client'
    | 'create_note' | 'update_note'
    | 'add_project_member' | 'add_team_member'
  data: Record<string, unknown>
}

export interface ChatResponse {
  content: string
  action?: ProposedAction
}

// Chat completion function
export async function sendChatMessage(
  messages: ChatMessage[],
  context: ChatContext
): Promise<ActionResult<ChatResponse>> {
  const configResult = await verifyAIConfig()
  if (configResult.error) {
    return { error: configResult.error }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const dailyLimit = await checkRateLimit(rateLimiters.ai, user.id)
    if (!dailyLimit.success) {
      return rateLimitError(dailyLimit.reset)
    }
    const concurrentLimit = await checkRateLimit(rateLimiters.aiConcurrent, user.id)
    if (!concurrentLimit.success) {
      return rateLimitError(concurrentLimit.reset)
    }
  }

  const systemPrompt = buildChatSystemPrompt(context)
  const userMessages = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content
  }))

  const { apiKey, provider, model } = configResult.data!

  let result: ActionResult<AIGenerationResult>

  switch (provider) {
    case 'openai':
      result = await callOpenAIChat(apiKey, model, systemPrompt, userMessages)
      break
    case 'anthropic':
      result = await callAnthropicChat(apiKey, model, systemPrompt, userMessages)
      break
    case 'google':
      result = await callGeminiChat(apiKey, model, systemPrompt, userMessages)
      break
    default:
      return { error: `Unsupported AI provider: ${provider}` }
  }

  if (result.error) {
    return { error: result.error }
  }

  return parseChatResponse(result.data!.text)
}

function buildChatSystemPrompt(context: ChatContext): string {
  const { appData } = context

  let prompt = `You are a project management AI assistant with FULL ACCESS to the user's application data.

## Current Context
- Page: ${context.pageType.replace('_', ' ')}
${context.filters ? `- Filters: ${JSON.stringify(context.filters)}` : ''}

## Organization
- Name: ${appData.organization.name}
- Members (${appData.members.length}): ${appData.members.slice(0, 10).map(m => `${m.name} (${m.role})`).join(', ')}${appData.members.length > 10 ? '...' : ''}
- Teams (${appData.teams.length}): ${appData.teams.map(t => t.name).join(', ') || 'None'}

## Projects (${appData.projects.length})
${appData.projects.slice(0, 20).map(p =>
  `- ${p.name} [${p.status}]${p.clientName ? ` - Client: ${p.clientName}` : ''}${p.dueDate ? ` - Due: ${p.dueDate}` : ''}`
).join('\n')}
${appData.projects.length > 20 ? `\n...and ${appData.projects.length - 20} more projects` : ''}

## Clients (${appData.clients.length})
${appData.clients.map(c => `- ${c.name} [${c.status}] (${c.projectCount} projects)`).join('\n') || 'None'}

## Your Tasks (${appData.userTasks.length})
${appData.userTasks.slice(0, 15).map(t =>
  `- ${t.title} [${t.status}] (${t.priority}) - ${t.projectName}${t.dueDate ? ` - Due: ${t.dueDate}` : ''}`
).join('\n')}
${appData.userTasks.length > 15 ? `\n...and ${appData.userTasks.length - 15} more tasks` : ''}

## Inbox (${appData.inbox.filter(i => !i.read).length} unread)
${appData.inbox.slice(0, 5).map(i => `- ${i.title} [${i.type}]${i.read ? '' : ' *NEW*'}`).join('\n') || 'No notifications'}`

  // Add current project detail if on project page
  if (appData.currentProject) {
    const p = appData.currentProject
    prompt += `

## Current Project Detail: ${p.name}
Status: ${p.status}
${p.description ? `Description: ${p.description}` : ''}
Members: ${p.members.map(m => `${m.name} (${m.role})`).join(', ') || 'None'}
Workstreams: ${p.workstreams.map(w => w.name).join(', ') || 'None'}
Files: ${p.files.map(f => f.name).join(', ') || 'None'}
Notes: ${p.notes.map(n => n.title).join(', ') || 'None'}

Tasks (${p.tasks.length}):
${p.tasks.map(t => `- ${t.title} [${t.status}] (${t.priority})${t.assignee ? ` - ${t.assignee}` : ''}`).join('\n')}`
  }

  // Add current client detail if on client page
  if (appData.currentClient) {
    const c = appData.currentClient
    prompt += `

## Current Client Detail: ${c.name}
Status: ${c.status}
${c.email ? `Email: ${c.email}` : ''}
${c.phone ? `Phone: ${c.phone}` : ''}
Projects: ${c.projects.map(p => `${p.name} [${p.status}]`).join(', ') || 'None'}`
  }

  // Add attachments
  if (context.attachments && context.attachments.length > 0) {
    prompt += `

## Attached Documents
${context.attachments.map(a =>
      `--- ${a.name} ---\n${a.content.slice(0, 5000)}${a.content.length > 5000 ? '\n[truncated]' : ''}`
    ).join('\n\n')}`
  }

  prompt += `

---

You can:
1. Answer questions about ANY data in the application
2. Provide insights, summaries, and analysis across projects, tasks, clients
3. Help find information, compare data, identify patterns
4. Propose actions when the user asks to do something

When proposing an action, include at the END of your response:
ACTION_JSON: {"type": "...", "data": {...}}

Available actions:
- create_task: {title, projectId, priority?, description?, workstreamId?}
- update_task: {taskId, title?, status?, priority?, assigneeId?}
- delete_task: {taskId}
- assign_task: {taskId, assigneeId}
- create_project: {name, clientId?, description?}
- update_project: {projectId, name?, status?, description?}
- create_workstream: {name, projectId}
- update_workstream: {workstreamId, name?}
- create_client: {name, email?, phone?}
- update_client: {clientId, name?, email?, phone?, status?}
- create_note: {title, content, projectId}
- add_project_member: {projectId, userId, role}
- add_team_member: {teamId, userId}

Keep responses concise and helpful. Only propose actions when the user explicitly asks to do something.`

  return prompt
}

function parseChatResponse(text: string): ActionResult<ChatResponse> {
  const actionMatch = text.match(/ACTION_JSON:\s*(\{[\s\S]*\})/)

  if (actionMatch) {
    try {
      const action = JSON.parse(actionMatch[1]) as ProposedAction
      const content = text.replace(/ACTION_JSON:\s*\{[\s\S]*\}/, '').trim()
      return { data: { content, action } }
    } catch {
      return { data: { content: text } }
    }
  }

  return { data: { content: text } }
}

// Multi-turn chat function for OpenAI
async function callOpenAIChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || 'OpenAI API error' }
    }

    const data = await response.json()
    return {
      data: {
        text: data.choices[0]?.message?.content || '',
        model,
        tokensUsed: data.usage?.total_tokens,
      },
    }
  } catch (error) {
    return { error: `Failed to call OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// Multi-turn chat function for Anthropic
async function callAnthropicChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens || 2000,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || 'Anthropic API error' }
    }

    const data = await response.json()
    return {
      data: {
        text: data.content[0]?.text || '',
        model,
        tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
      },
    }
  } catch (error) {
    return { error: `Failed to call Anthropic: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// Multi-turn chat function for Google Gemini
async function callGeminiChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const geminiMessages = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages,
          generationConfig: {
            maxOutputTokens: options.maxTokens || 2000,
            temperature: options.temperature || 0.7,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || 'Gemini API error' }
    }

    const data = await response.json()
    return {
      data: {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        model,
        tokensUsed: data.usageMetadata?.totalTokenCount,
      },
    }
  } catch (error) {
    return { error: `Failed to call Gemini: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}
