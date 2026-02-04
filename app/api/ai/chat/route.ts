import { NextRequest } from "next/server"
import { createApiRouteClient } from "@/lib/supabase/api-route"
import { rateLimiters, checkRateLimit } from "@/lib/rate-limit/limiter"
import { decrypt, isEncryptedFormat, migrateFromBase64 } from "@/lib/crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// AI Config Verification (inline to avoid using cookies() from next/headers)
// =============================================================================

async function verifyAIConfigForApiRoute(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data?: { apiKey: string; provider: string; model: string }; error?: string }> {
  // Get user settings directly from database
  const { data: settings, error: settingsError } = await (supabase as unknown as SupabaseClient)
    .from("user_settings")
    .select("ai_provider, ai_api_key_encrypted, ai_model_preference")
    .eq("user_id", userId)
    .single()

  if (settingsError) {
    if (settingsError.code === "PGRST116") {
      return { error: "AI provider not configured. Please configure AI settings first." }
    }
    return { error: settingsError.message }
  }

  if (!settings?.ai_provider) {
    return { error: "AI provider not configured. Please configure AI settings first." }
  }

  if (!settings.ai_api_key_encrypted) {
    return { error: "AI API key not configured. Please add your API key in settings." }
  }

  // Decrypt the API key
  let apiKey: string
  const storedValue = settings.ai_api_key_encrypted

  if (isEncryptedFormat(storedValue)) {
    try {
      apiKey = decrypt(storedValue)
    } catch (err) {
      console.error("Decryption error:", err)
      return { error: "Failed to decrypt API key" }
    }
  } else {
    // Legacy BASE64 format - try to migrate
    const migratedValue = migrateFromBase64(storedValue)
    if (migratedValue) {
      // Re-encrypt and save with new format (fire and forget)
      ;(supabase as unknown as SupabaseClient)
        .from("user_settings")
        .update({
          ai_api_key_encrypted: migratedValue,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)

      try {
        apiKey = decrypt(migratedValue)
      } catch (err) {
        console.error("Decryption error after migration:", err)
        return { error: "Failed to decrypt API key" }
      }
    } else {
      // Fallback: try BASE64 decode (for very old data)
      try {
        apiKey = Buffer.from(storedValue, "base64").toString("utf-8")
      } catch {
        return { error: "Failed to decode API key" }
      }
    }
  }

  // Default models by provider
  const defaultModels: Record<string, string> = {
    openai: "gpt-4o",
    anthropic: "claude-sonnet-4-20250514",
    google: "gemini-2.0-flash",
    groq: "llama-3.3-70b-versatile",
    mistral: "mistral-large-latest",
    xai: "grok-2-latest",
    deepseek: "deepseek-chat",
    openrouter: "anthropic/claude-sonnet-4",
  }

  const model = settings.ai_model_preference || defaultModels[settings.ai_provider] || "gpt-4o"

  return {
    data: {
      apiKey,
      provider: settings.ai_provider,
      model,
    },
  }
}

// =============================================================================
// Types - Inlined to avoid bundler issues with type imports from other modules
// =============================================================================

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface WorkloadInsights {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  dueToday: number
  dueThisWeek: number
  highPriorityTasks: number
  urgentTasks: number
  hasUrgentOverdue: boolean
  isOverloaded: boolean
  oldestOverdueDays?: number
}

interface ChatContext {
  pageType: string
  projectId?: string
  clientId?: string
  filters?: Record<string, unknown>
  appData: {
    organization: { id: string; name: string }
    projects: { id: string; name: string; status: string; clientName?: string; dueDate?: string }[]
    clients: { id: string; name: string; status: string; projectCount: number }[]
    teams: { id: string; name: string; memberCount: number }[]
    members: { id: string; name: string; email: string; role: string }[]
    userTasks: { id: string; title: string; projectName: string; status: string; priority: string; dueDate?: string }[]
    inbox: { id: string; title: string; type: string; read: boolean; createdAt: string }[]
    workloadInsights?: WorkloadInsights
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

// =============================================================================
// System Prompt Builder - Inlined to avoid bundler issues
// =============================================================================

function buildChatSystemPrompt(context: ChatContext): string {
  const { appData } = context

  const organization = appData.organization || { id: "", name: "Unknown" }
  const members = appData.members || []
  const teams = appData.teams || []
  const projects = appData.projects || []
  const clients = appData.clients || []
  const userTasks = appData.userTasks || []
  const inbox = appData.inbox || []

  let prompt = `You are a project management AI assistant with FULL ACCESS to the user's application data.

## Current Context
- Page: ${context.pageType.replace("_", " ")}
${context.filters ? `- Filters: ${JSON.stringify(context.filters)}` : ""}

## Organization
- Name: ${organization.name}
- Members (${members.length}): ${members.slice(0, 10).map(m => `${m.name} (${m.role})`).join(", ")}${members.length > 10 ? "..." : ""}
- Teams (${teams.length}): ${teams.map(t => t.name).join(", ") || "None"}

## Projects (${projects.length})
${projects.slice(0, 20).map(p =>
  `- ${p.name} [${p.status}]${p.clientName ? ` - Client: ${p.clientName}` : ""}${p.dueDate ? ` - Due: ${p.dueDate}` : ""}`
).join("\n")}
${projects.length > 20 ? `\n...and ${projects.length - 20} more projects` : ""}

## Clients (${clients.length})
${clients.map(c => `- ${c.name} [${c.status}] (${c.projectCount} projects)`).join("\n") || "None"}

## Your Tasks (${userTasks.length})
${userTasks.slice(0, 15).map(t =>
  `- ${t.title} [${t.status}] (${t.priority}) - ${t.projectName}${t.dueDate ? ` - Due: ${t.dueDate}` : ""}`
).join("\n")}
${userTasks.length > 15 ? `\n...and ${userTasks.length - 15} more tasks` : ""}

## Inbox (${inbox.filter(i => !i.read).length} unread)
${inbox.slice(0, 5).map(i => `- ${i.title} [${i.type}]${i.read ? "" : " *NEW*"}`).join("\n") || "No notifications"}`

  const insights = appData.workloadInsights
  if (insights) {
    prompt += `

## User's Workload Summary
- Total tasks: ${insights.totalTasks} (${insights.completedTasks} completed, ${insights.inProgressTasks} in progress)
- Overdue: ${insights.overdueTasks}${insights.hasUrgentOverdue ? ` ⚠️ Some are ${insights.oldestOverdueDays}+ days overdue!` : ""}
- Due today: ${insights.dueToday}
- Due this week: ${insights.dueThisWeek}
- High priority: ${insights.highPriorityTasks}${insights.urgentTasks > 0 ? ` (${insights.urgentTasks} urgent)` : ""}
${insights.isOverloaded ? `⚠️ User appears overloaded with ${insights.totalTasks - insights.completedTasks} active tasks - consider offering to help prioritize or reschedule` : ""}
${insights.overdueTasks > 0 ? `💡 User has overdue tasks - you might gently mention this and offer to help reschedule if they seem stressed` : ""}`
  }

  if (appData.currentProject) {
    const p = appData.currentProject
    const pMembers = p.members || []
    const pWorkstreams = p.workstreams || []
    const pFiles = p.files || []
    const pNotes = p.notes || []
    const pTasks = p.tasks || []
    prompt += `

## Current Project Detail: ${p.name}
Status: ${p.status}
${p.description ? `Description: ${p.description}` : ""}
Members: ${pMembers.map(m => `${m.name} (${m.role})`).join(", ") || "None"}
Workstreams: ${pWorkstreams.map(w => w.name).join(", ") || "None"}
Files: ${pFiles.map(f => f.name).join(", ") || "None"}
Notes: ${pNotes.map(n => n.title).join(", ") || "None"}

Tasks (${pTasks.length}):
${pTasks.map(t => `- ${t.title} [${t.status}] (${t.priority})${t.assignee ? ` - ${t.assignee}` : ""}`).join("\n")}`
  }

  if (appData.currentClient) {
    const c = appData.currentClient
    const cProjects = c.projects || []
    prompt += `

## Current Client Detail: ${c.name}
Status: ${c.status}
${c.email ? `Email: ${c.email}` : ""}
${c.phone ? `Phone: ${c.phone}` : ""}
Projects: ${cProjects.map(p => `${p.name} [${p.status}]`).join(", ") || "None"}`
  }

  if (context.attachments && context.attachments.length > 0) {
    prompt += `

## Attached Documents
${context.attachments.map(a =>
      `--- ${a.name} ---\n${a.content.slice(0, 5000)}${a.content.length > 5000 ? "\n[truncated]" : ""}`
    ).join("\n\n")}`
  }

  prompt += `

---

## Your Personality & Approach
You're a friendly, proactive project management assistant. Think of yourself as a helpful colleague who genuinely cares about helping the user succeed.

**How to communicate:**
- Be warm and conversational, not robotic or formal
- Use natural language, not bullet points for everything
- Show you understand the context before jumping to solutions
- Keep responses focused and concise - don't over-explain
- When you can help with an action, offer it naturally as part of your response

**Your capabilities:**
1. Answer questions about ANY data in the application
2. Provide insights, summaries, and analysis across projects, tasks, clients
3. Help find information, compare data, identify patterns
4. Proactively suggest and execute helpful actions

## When to Suggest Actions (Be Proactive!)

Look for opportunities to help. Don't wait to be explicitly asked if an action would clearly help:

- **User mentions being overwhelmed or behind** → Offer to help prioritize or reschedule tasks
- **User discusses a new initiative or idea** → Offer to create the project structure
- **User asks about status or progress** → Show summary AND offer relevant next steps
- **User mentions a problem or blocker** → Suggest concrete solutions with actions
- **User is brainstorming or planning** → Offer to capture decisions as tasks or notes
- **User has overdue tasks** → Gently mention them and offer to help reschedule
- **User asks "what should I do"** → Analyze their workload and suggest priorities

**Example of good proactive response:**
"That sounds like a solid plan for the website redesign! You've got three main phases clear - Design, Development, and Launch.

Would you like me to set this up as a project? I can create the workstreams and some initial tasks based on what you described."

## When NOT to Suggest Actions

Sometimes people just want to talk or think out loud. Don't propose actions when:

- User is asking a simple question (just answer it)
- User is thinking out loud or brainstorming early ideas
- User explicitly says they're not ready to create anything yet
- User just wants advice or your opinion
- The conversation is casual or a greeting

**Example of knowing when not to act:**
User: "I'm not sure if we should use React or Vue for this project"
Bad: Immediately proposing to create a project
Good: Discuss the trade-offs and ask clarifying questions first

## How to Propose Actions

When you do suggest actions, make them feel like helpful offers:

1. First, respond naturally to what the user said
2. Then, offer what you can do to help (don't just dump JSON)
3. Frame it as an offer, not a command ("Would you like me to..." or "I can...")
4. Give the user choice - they can modify or decline
5. Include the action at the END of your message

**CRITICAL - Action Language Rules:**
Actions are PROPOSALS that require user confirmation. The user must click "Execute" to run them.

✅ **CORRECT language** (actions are proposed, not done):
- "I can mark these 5 tasks as done. Here's what will be updated:"
- "Ready to update these tasks. Click Execute to confirm:"
- "Here's the plan - I'll update these when you confirm:"

❌ **WRONG language** (sounds like it's already done):
- "I'll mark all tasks as done now" ← NEVER say this
- "All 5 tasks have been marked as completed" ← NEVER say this
- "Done! I've updated the tasks" ← NEVER say this

Always make it clear that clicking "Execute" is required before anything changes.

## Action Rules

**MULTIPLE ACTIONS SUPPORTED**: You can propose multiple actions at once. The system will execute them in order.

**PLACEHOLDER REFERENCES**: When creating entities and then using them in subsequent actions, use these placeholders:
- \`$NEW_PROJECT_ID\` - References the ID of a project created in the same request
- \`$NEW_WORKSTREAM_ID\` - References the ID of a workstream created in the same request
- \`$NEW_TASK_ID\` - References the ID of a task created in the same request
- \`$NEW_CLIENT_ID\` - References the ID of a client created in the same request

The system will automatically replace these placeholders with the actual IDs after each action completes.

**Example multi-action request**: "Create a project, add a workstream, and add tasks"
Your response should include multiple actions:
ACTIONS_JSON: [
  {"type": "create_project", "data": {"name": "Project Name"}},
  {"type": "create_workstream", "data": {"name": "Phase 1", "projectId": "$NEW_PROJECT_ID"}},
  {"type": "create_task", "data": {"title": "Task 1", "projectId": "$NEW_PROJECT_ID", "workstreamId": "$NEW_WORKSTREAM_ID"}},
  {"type": "create_task", "data": {"title": "Task 2", "projectId": "$NEW_PROJECT_ID", "workstreamId": "$NEW_WORKSTREAM_ID"}}
]

For existing entities, ALWAYS use real UUIDs from the reference data below.

**CRITICAL - Action JSON Placement:**
When proposing actions, the JSON MUST be at the ABSOLUTE END of your message. NO text after the JSON.

✅ CORRECT format:
"I can create this project for you. Click Execute to confirm:

ACTION_JSON: {"type": "create_project", "data": {"name": "Test"}}"

❌ WRONG format (text after JSON):
"ACTION_JSON: {"type": "create_project", "data": {"name": "Test"}}

Would you like me to add tasks too?" ← NEVER put text after the JSON!

- For single action: ACTION_JSON: {"type": "...", "data": {...}}
- For multiple actions: ACTIONS_JSON: [{"type": "...", "data": {...}}, ...]

## Available Actions

| Action | Required Fields | Optional Fields | Notes |
|--------|----------------|-----------------|-------|
| create_task | title, projectId | workstreamId, assigneeId, priority, description | **IMPORTANT: Include assigneeId here to assign at creation** |
| update_task | taskId | title, status, priority, assigneeId | |
| delete_task | taskId | | |
| assign_task | taskId, assigneeId | | Only for existing tasks. assigneeId can be null to unassign |
| create_project | name | description, clientId | orgId auto-injected by system |
| update_project | projectId | name, status, description | |
| create_workstream | name, projectId | description | Use $NEW_PROJECT_ID or real UUID |
| update_workstream | workstreamId | name, description | **NO status field** - workstreams don't have status |
| create_client | name | email, phone | orgId auto-injected by system |
| update_client | clientId | name, email, phone, status | |
| create_note | title, projectId | content | Use $NEW_PROJECT_ID or real UUID |
| add_project_member | projectId, userId, role | | |
| add_team_member | teamId, userId | | |
| change_theme | theme | | theme must be "light", "dark", or "system" |

**CRITICAL - Valid Field Values (must be lowercase):**
- **priority**: "no-priority", "low", "medium", "high", "urgent" (NOT "High" or "Medium" - must be lowercase!)
- **status** (tasks): "todo", "in-progress", "done"
- **status** (projects): "active", "on-hold", "completed", "cancelled"

**NOTE: Workstreams do NOT have a status field.** You cannot mark a workstream as "done".
If user wants to complete/finish a workstream, you MUST update ALL tasks in that workstream to "done" status using multiple update_task actions. Example:
ACTIONS_JSON: [
  {"type": "update_task", "data": {"taskId": "task-uuid-1", "status": "done"}},
  {"type": "update_task", "data": {"taskId": "task-uuid-2", "status": "done"}},
  {"type": "update_task", "data": {"taskId": "task-uuid-3", "status": "done"}}
]

## CRITICAL: Task Assignment Best Practice
When creating multiple tasks that need to be assigned, **ALWAYS include the assigneeId directly in create_task**.
Do NOT use separate assign_task actions for newly created tasks because $NEW_TASK_ID only holds the LAST created task ID.

**CORRECT** - assign during creation:
\`\`\`json
ACTIONS_JSON: [
  {"type": "create_task", "data": {"title": "Task 1", "projectId": "$NEW_PROJECT_ID", "assigneeId": "user-uuid"}},
  {"type": "create_task", "data": {"title": "Task 2", "projectId": "$NEW_PROJECT_ID", "assigneeId": "user-uuid"}}
]
\`\`\`

**WRONG** - separate assign actions will only assign the last task:
\`\`\`json
ACTIONS_JSON: [
  {"type": "create_task", "data": {"title": "Task 1", "projectId": "$NEW_PROJECT_ID"}},
  {"type": "create_task", "data": {"title": "Task 2", "projectId": "$NEW_PROJECT_ID"}},
  {"type": "assign_task", "data": {"taskId": "$NEW_TASK_ID", "assigneeId": "user-uuid"}},
  {"type": "assign_task", "data": {"taskId": "$NEW_TASK_ID", "assigneeId": "user-uuid"}}
]
\`\`\`

## Reference Data
Organization ID: ${organization.id}
Current User ID: ${members.find(m => m.role === "admin")?.id || members[0]?.id || "unknown"}

Project IDs (use these exact UUIDs for existing projects):
${projects.length > 0 ? projects.map(p => `- "${p.name}": ${p.id}`).join("\n") : "No projects yet"}

Team Member IDs (for task assignment):
${members.length > 0 ? members.map(m => `- "${m.name}": ${m.id}`).join("\n") : "No members"}

Task IDs (use these exact UUIDs for existing tasks):
${userTasks.length > 0 ? userTasks.slice(0, 30).map(t => `- "${t.title}" [${t.status}]: ${t.id}`).join("\n") : "No tasks yet"}
${appData.currentProject?.tasks?.length ? `\nCurrent Project Tasks:\n${appData.currentProject.tasks.map(t => `- "${t.title}" [${t.status}]: ${t.id}`).join("\n")}` : ""}

Workstream IDs (use these exact UUIDs for existing workstreams):
${appData.currentProject?.workstreams?.length ? appData.currentProject.workstreams.map(w => `- "${w.name}": ${w.id}`).join("\n") : "No workstreams"}

## Suggesting Follow-up Actions

After answering a question or providing information, you may suggest 2-3 relevant follow-up actions the user might want to take. These appear as clickable chips, making it easy to continue the conversation.

**Format:** Add at the END of your response (after any ACTION_JSON/ACTIONS_JSON):
SUGGESTED_ACTIONS: [{"label": "Short label", "prompt": "Full prompt to send"}]

**Examples:**

After showing overdue tasks:
"You have 5 overdue tasks, mostly documentation-related..."

SUGGESTED_ACTIONS: [{"label": "Reschedule to next week", "prompt": "Reschedule all my overdue tasks to next week"}, {"label": "Show by project", "prompt": "Group these overdue tasks by project"}]

After discussing project status:
"The project is 60% complete with 3 tasks blocked..."

SUGGESTED_ACTIONS: [{"label": "Show blocked tasks", "prompt": "Tell me more about the blocked tasks"}, {"label": "Draft status update", "prompt": "Help me draft a status update for stakeholders"}]

**Rules:**
- Maximum 2-3 suggestions
- Keep labels short (2-4 words)
- Make suggestions relevant to what was just discussed
- Don't suggest for simple greetings or when you're proposing actions
- Good for: status summaries, task lists, project overviews, informational responses

## Final Reminders
- Be conversational and helpful, not robotic
- Proactively suggest actions when they'd genuinely help
- Keep responses concise but warm
- NEVER guess or make up IDs - use exact UUIDs from reference data above
- When uncertain about user intent, ask a clarifying question`

  return prompt
}

// =============================================================================
// Streaming Implementation
// =============================================================================

// Note: Route segment configs removed for cacheComponents compatibility
// API routes are inherently dynamic and don't need explicit config

// Provider-specific streaming implementations
async function streamOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 8192,
      temperature: 0.7,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "OpenAI API error")
  }

  return response.body!
}

async function streamAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
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
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Anthropic API error")
  }

  return response.body!
}

async function streamGoogle(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Google API error")
  }

  return response.body!
}

async function streamGroq(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 8192,
      temperature: 0.7,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Groq API error")
  }

  return response.body!
}

async function streamMistral(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 8192,
      temperature: 0.7,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Mistral API error")
  }

  return response.body!
}

async function streamXAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 8192,
      temperature: 0.7,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "xAI API error")
  }

  return response.body!
}

async function streamDeepSeek(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 8192,
      temperature: 0.7,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "DeepSeek API error")
  }

  return response.body!
}

async function streamOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 8192,
      temperature: 0.7,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "OpenRouter API error")
  }

  return response.body!
}

// Transform provider stream to unified SSE format
function createUnifiedStream(
  providerStream: ReadableStream,
  provider: string
): ReadableStream {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream({
    async start(controller) {
      const reader = providerStream.getReader()
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            controller.close()
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue

            // Handle Google's SSE format (with alt=sse parameter)
            if (provider === "google") {
              if (!line.startsWith("data: ")) continue
              const data = line.slice(6)
              if (data === "[DONE]") continue
              try {
                const json = JSON.parse(data)
                const text = json.candidates?.[0]?.content?.parts?.[0]?.text || ""
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                }
              } catch {
                // Skip malformed JSON
              }
              continue
            }

            // Handle Anthropic's format
            if (provider === "anthropic") {
              if (!line.startsWith("data: ")) continue
              const data = line.slice(6)
              if (data === "[DONE]") continue
              try {
                const json = JSON.parse(data)
                if (json.type === "content_block_delta") {
                  const text = json.delta?.text || ""
                  if (text) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                  }
                }
              } catch {
                // Skip malformed JSON
              }
              continue
            }

            // Handle OpenAI-compatible format (OpenAI, Groq, Mistral, xAI, DeepSeek, OpenRouter)
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") continue
              try {
                const json = JSON.parse(data)
                const text = json.choices?.[0]?.delta?.content || ""
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`)
        )
        controller.close()
      }
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication using request cookies directly
    const supabase = createApiRouteClient(req)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Check rate limits
    const dailyLimit = await checkRateLimit(rateLimiters.ai, user.id)
    if (!dailyLimit.success) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    }

    const concurrentLimit = await checkRateLimit(rateLimiters.aiConcurrent, user.id)
    if (!concurrentLimit.success) {
      return new Response(
        JSON.stringify({ error: "Too many concurrent requests. Please wait." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    }

    // Verify AI configuration using the same supabase client (no cookies() usage)
    const configResult = await verifyAIConfigForApiRoute(supabase, user.id)
    if (configResult.error) {
      return new Response(JSON.stringify({ error: configResult.error }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Parse request body
    const { messages, context } = (await req.json()) as {
      messages: ChatMessage[]
      context: ChatContext
    }

    if (!messages || !context) {
      return new Response(
        JSON.stringify({ error: "Missing messages or context" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const { apiKey, provider, model } = configResult.data!
    const systemPrompt = buildChatSystemPrompt(context)

    const userMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Get provider stream
    let providerStream: ReadableStream

    switch (provider) {
      case "openai":
        providerStream = await streamOpenAI(apiKey, model, systemPrompt, userMessages)
        break
      case "anthropic":
        providerStream = await streamAnthropic(apiKey, model, systemPrompt, userMessages)
        break
      case "google":
        providerStream = await streamGoogle(apiKey, model, systemPrompt, userMessages)
        break
      case "groq":
        providerStream = await streamGroq(apiKey, model, systemPrompt, userMessages)
        break
      case "mistral":
        providerStream = await streamMistral(apiKey, model, systemPrompt, userMessages)
        break
      case "xai":
        providerStream = await streamXAI(apiKey, model, systemPrompt, userMessages)
        break
      case "deepseek":
        providerStream = await streamDeepSeek(apiKey, model, systemPrompt, userMessages)
        break
      case "openrouter":
        providerStream = await streamOpenRouter(apiKey, model, systemPrompt, userMessages)
        break
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported provider: ${provider}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
    }

    // Create unified stream
    const unifiedStream = createUnifiedStream(providerStream, provider)

    return new Response(unifiedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx/proxy buffering
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (error) {
    console.error("Streaming error:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
