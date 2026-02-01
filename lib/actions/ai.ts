"use server"

import { createClient } from "@/lib/supabase/server"
import { getDecryptedApiKey, getAISettings } from "./user-settings"
import { rateLimiters, checkRateLimit, rateLimitError } from "@/lib/rate-limit/limiter"
import type { ActionResult } from "./types"
import { buildChatSystemPrompt } from "./ai-helpers"
import type {
  ChatContext,
  WorkloadInsights,
  ProposedAction,
  SuggestedAction,
} from "./ai-types"

// Note: Types are NOT re-exported here to avoid bundler issues with "use server"
// Import them directly from "@/lib/actions/ai-types" instead


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

// Verify AI is configured (exported for streaming API route)
export async function verifyAIConfig(): Promise<
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
      return "gemini-2.5-flash"
    case "groq":
      return "llama-3.3-70b-versatile"
    case "mistral":
      return "mistral-small-latest"
    case "xai":
      return "grok-2-latest"
    case "deepseek":
      return "deepseek-chat"
    case "openrouter":
      return "openrouter/auto"
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

// Make API call to Groq (OpenAI-compatible API)
async function callGroq(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
      return { error: error.error?.message || "Groq API error" }
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
    return { error: `Failed to call Groq: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

// Make API call to Mistral
async function callMistral(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
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
      return { error: error.error?.message || "Mistral API error" }
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
    return { error: `Failed to call Mistral: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

// Make API call to xAI (Grok) - OpenAI-compatible API
async function callXAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
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
      return { error: error.error?.message || "xAI API error" }
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
    return { error: `Failed to call xAI: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

// Make API call to DeepSeek - OpenAI-compatible API
async function callDeepSeek(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
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
      return { error: error.error?.message || "DeepSeek API error" }
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
    return { error: `Failed to call DeepSeek: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

// Make API call to OpenRouter - OpenAI-compatible API with many models
async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "Project Dashboard",
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
      return { error: error.error?.message || "OpenRouter API error" }
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
    return { error: `Failed to call OpenRouter: ${error instanceof Error ? error.message : "Unknown error"}` }
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

${context?.title ? `Title: ${context.title}` : ""}
${context?.projectName ? `Project: ${context.projectName}` : ""}
${noteTypeContext}

ROUGH NOTES:
"""
${content}
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
  role: "user" | "assistant"
  content: string
}

export interface ChatResponse {
  content: string
  action?: ProposedAction
  actions?: ProposedAction[]  // Multiple actions support
  suggestedActions?: SuggestedAction[]  // Follow-up suggestions
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
    role: m.role as "user" | "assistant",
    content: m.content
  }))

  const { apiKey, provider, model } = configResult.data!

  let result: ActionResult<AIGenerationResult>

  switch (provider) {
    case "openai":
      result = await callOpenAIChat(apiKey, model, systemPrompt, userMessages)
      break
    case "anthropic":
      result = await callAnthropicChat(apiKey, model, systemPrompt, userMessages)
      break
    case "google":
      result = await callGeminiChat(apiKey, model, systemPrompt, userMessages)
      break
    case "groq":
      result = await callGroqChat(apiKey, model, systemPrompt, userMessages)
      break
    case "mistral":
      result = await callMistralChat(apiKey, model, systemPrompt, userMessages)
      break
    case "xai":
      result = await callXAIChat(apiKey, model, systemPrompt, userMessages)
      break
    case "deepseek":
      result = await callDeepSeekChat(apiKey, model, systemPrompt, userMessages)
      break
    case "openrouter":
      result = await callOpenRouterChat(apiKey, model, systemPrompt, userMessages)
      break
    default:
      return { error: `Unsupported AI provider: ${provider}` }
  }

  if (result.error) {
    return { error: result.error }
  }

  return parseChatResponse(result.data!.text)
}

function parseChatResponse(text: string): ActionResult<ChatResponse> {
  let content = text
  let actions: ProposedAction[] | undefined
  let action: ProposedAction | undefined
  let suggestedActions: SuggestedAction[] | undefined

  // Try to match suggested actions (SUGGESTED_ACTIONS: [...])
  const suggestionsMatch = content.match(/SUGGESTED_ACTIONS:\s*(\[[\s\S]*?\])(?=\s*$|\s*\n|$)/m)
  if (suggestionsMatch) {
    try {
      suggestedActions = JSON.parse(suggestionsMatch[1]) as SuggestedAction[]
      content = content.replace(/SUGGESTED_ACTIONS:\s*\[[\s\S]*?\](?=\s*$|\s*\n|$)/m, "").trim()
    } catch {
      // Ignore parse errors for suggestions
    }
  }

  // Try to match multiple actions first (ACTIONS_JSON: [...])
  const actionsMatch = content.match(/ACTIONS_JSON:\s*(\[[\s\S]*?\])(?=\s*$|\s*\n|$)/m)
  if (actionsMatch) {
    try {
      actions = JSON.parse(actionsMatch[1]) as ProposedAction[]
      content = content.replace(/ACTIONS_JSON:\s*\[[\s\S]*?\](?=\s*$|\s*\n|$)/m, "").trim()
      return { data: { content, actions, suggestedActions } }
    } catch {
      // Fall through to single action check
    }
  }

  // Try to match single action (ACTION_JSON: {...})
  const actionMatch = content.match(/ACTION_JSON:\s*(\{[\s\S]*?\})(?=\s*$|\s*\n|$)/m)
  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]) as ProposedAction
      content = content.replace(/ACTION_JSON:\s*\{[\s\S]*?\}(?=\s*$|\s*\n|$)/m, "").trim()
      return { data: { content, action, suggestedActions } }
    } catch {
      return { data: { content, suggestedActions } }
    }
  }

  return { data: { content, suggestedActions } }
}

// Multi-turn chat function for OpenAI
async function callOpenAIChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
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
          ...messages
        ],
        max_tokens: 8192,
        temperature: 0.7,
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

// Multi-turn chat function for Anthropic
async function callAnthropicChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
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
        max_tokens: 8192,
        system: systemPrompt,
        messages,
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

// Multi-turn chat function for Google Gemini
async function callGeminiChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const geminiMessages = messages.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
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

// Multi-turn chat function for Groq (OpenAI-compatible)
async function callGroqChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        max_tokens: 8192,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || "Groq API error" }
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
    return { error: `Failed to call Groq: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

// Multi-turn chat function for Mistral
async function callMistralChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        max_tokens: 8192,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || "Mistral API error" }
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
    return { error: `Failed to call Mistral: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

// Multi-turn chat function for xAI (Grok)
async function callXAIChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        max_tokens: 8192,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || "xAI API error" }
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
    return { error: `Failed to call xAI: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

// Multi-turn chat function for DeepSeek
async function callDeepSeekChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        max_tokens: 8192,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || "DeepSeek API error" }
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
    return { error: `Failed to call DeepSeek: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}

// Multi-turn chat function for OpenRouter
async function callOpenRouterChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "Project Dashboard",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        max_tokens: 8192,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error?.message || "OpenRouter API error" }
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
    return { error: `Failed to call OpenRouter: ${error instanceof Error ? error.message : "Unknown error"}` }
  }
}
