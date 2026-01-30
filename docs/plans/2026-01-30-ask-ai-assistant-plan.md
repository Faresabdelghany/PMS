# Ask AI Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full-application AI chat assistant with complete data access, file attachment support, and write capabilities across all pages.

**Architecture:** Right-side sheet chat panel using existing AI infrastructure. Server-side context fetching for full application data. Client-side file text extraction. Action confirmation flow for write operations.

**Tech Stack:** React 19, shadcn/ui Sheet, react-markdown, pdfjs-dist, mammoth

**Data Access:** Full read access to all application data (projects, tasks, clients, teams, settings, inbox, organization). Write access to create/update any entity with confirmation.

---

## Task 1: Create AI Chat Server Action

**Files:**
- Modify: `lib/actions/ai.ts`

**Step 1: Add chat types and function**

Add to `lib/actions/ai.ts`:

```typescript
// Chat message types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  pageType: 'projects_list' | 'project_detail' | 'my_tasks' | 'clients_list' | 'client_detail' | 'settings' | 'inbox' | 'other';
  projectId?: string;
  clientId?: string;
  filters?: Record<string, unknown>;
  // Full application data
  appData: {
    organization: { id: string; name: string };
    projects: { id: string; name: string; status: string; clientName?: string; dueDate?: string }[];
    clients: { id: string; name: string; status: string; projectCount: number }[];
    teams: { id: string; name: string; memberCount: number }[];
    members: { id: string; name: string; email: string; role: string }[];
    userTasks: { id: string; title: string; projectName: string; status: string; priority: string; dueDate?: string }[];
    inbox: { id: string; title: string; type: string; read: boolean; createdAt: string }[];
    // Detail data when on specific pages
    currentProject?: {
      id: string;
      name: string;
      description?: string;
      status: string;
      workstreams: { id: string; name: string }[];
      tasks: { id: string; title: string; status: string; priority: string; assignee?: string }[];
      notes: { id: string; title: string; content?: string }[];
      files: { id: string; name: string; type: string }[];
      members: { id: string; name: string; role: string }[];
    };
    currentClient?: {
      id: string;
      name: string;
      email?: string;
      phone?: string;
      status: string;
      projects: { id: string; name: string; status: string }[];
    };
  };
  attachments?: { name: string; content: string }[];
}

export interface ProposedAction {
  type:
    | 'create_task' | 'update_task' | 'delete_task' | 'assign_task'
    | 'create_project' | 'update_project'
    | 'create_workstream' | 'update_workstream'
    | 'create_client' | 'update_client'
    | 'create_note' | 'update_note'
    | 'add_project_member' | 'add_team_member';
  data: Record<string, unknown>;
}

export interface ChatResponse {
  content: string;
  action?: ProposedAction;
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
```

**Step 2: Add multi-turn chat functions for each provider**

Add these helper functions:

```typescript
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
```

**Step 3: Verify changes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add lib/actions/ai.ts
git commit -m "feat(ai): add chat completion with multi-turn support"
```

---

## Task 2: Create useAIChat Hook

**Files:**
- Create: `hooks/use-ai-chat.ts`

**Step 1: Create the hook file**

```typescript
"use client"

import { useState, useCallback } from 'react'
import { sendChatMessage, type ChatContext, type ProposedAction } from '@/lib/actions/ai'
import { createTask, updateTask, deleteTask, assignTask } from '@/lib/actions/tasks'
import { createWorkstream, updateWorkstream } from '@/lib/actions/workstreams'
import { createNote, updateNote } from '@/lib/actions/notes'
import { createProject, updateProject, addProjectMember } from '@/lib/actions/projects'
import { createClient, updateClient } from '@/lib/actions/clients'
import { addTeamMember } from '@/lib/actions/teams'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
  action?: ProposedAction & { status: 'pending' | 'confirmed' | 'executing' | 'success' | 'error'; error?: string }
  timestamp: Date
}

export interface Attachment {
  id: string
  name: string
  type: string
  extractedText?: string
}

interface UseAIChatReturn {
  messages: Message[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>
  confirmAction: (messageId: string) => Promise<void>
  clearChat: () => void
}

export function useAIChat(context: ChatContext): UseAIChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (content: string, attachments?: Attachment[]) => {
    setError(null)
    setIsLoading(true)

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      attachments,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])

    try {
      const chatMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const contextWithAttachments: ChatContext = {
        ...context,
        attachments: attachments?.filter(a => a.extractedText).map(a => ({
          name: a.name,
          content: a.extractedText!,
        })),
      }

      const result = await sendChatMessage(chatMessages, contextWithAttachments)

      if (result.error) {
        setError(result.error)
        return
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.data!.content,
        action: result.data!.action ? { ...result.data!.action, status: 'pending' } : undefined,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }, [messages, context])

  const confirmAction = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    if (!message?.action || message.action.status !== 'pending') return

    setMessages(prev => prev.map(m =>
      m.id === messageId && m.action
        ? { ...m, action: { ...m.action, status: 'executing' as const } }
        : m
    ))

    try {
      const { type, data } = message.action

      let result: { error?: string }

      switch (type) {
        case 'create_task':
          result = await createTask({
            title: data.title as string,
            description: data.description as string | undefined,
            priority: data.priority as 'low' | 'medium' | 'high',
            project_id: data.projectId as string,
            workstream_id: data.workstreamId as string | undefined,
          })
          break

        case 'update_task':
          result = await updateTask(data.taskId as string, {
            title: data.title as string | undefined,
            status: data.status as string | undefined,
            priority: data.priority as 'low' | 'medium' | 'high' | undefined,
          })
          break

        case 'delete_task':
          result = await deleteTask(data.taskId as string)
          break

        case 'assign_task':
          result = await assignTask(data.taskId as string, data.assigneeId as string)
          break

        case 'create_project':
          result = await createProject({
            name: data.name as string,
            client_id: data.clientId as string | undefined,
            description: data.description as string | undefined,
          })
          break

        case 'update_project':
          result = await updateProject(data.projectId as string, {
            name: data.name as string | undefined,
            status: data.status as string | undefined,
            description: data.description as string | undefined,
          })
          break

        case 'create_workstream':
          result = await createWorkstream({
            name: data.name as string,
            project_id: data.projectId as string,
          })
          break

        case 'update_workstream':
          result = await updateWorkstream(data.workstreamId as string, {
            name: data.name as string | undefined,
          })
          break

        case 'create_client':
          result = await createClient({
            name: data.name as string,
            email: data.email as string | undefined,
            phone: data.phone as string | undefined,
          })
          break

        case 'update_client':
          result = await updateClient(data.clientId as string, {
            name: data.name as string | undefined,
            email: data.email as string | undefined,
            phone: data.phone as string | undefined,
            status: data.status as string | undefined,
          })
          break

        case 'create_note':
          result = await createNote({
            title: data.title as string,
            content: data.content as string,
            project_id: data.projectId as string,
          })
          break

        case 'update_note':
          result = await updateNote(data.noteId as string, {
            title: data.title as string | undefined,
            content: data.content as string | undefined,
          })
          break

        case 'add_project_member':
          result = await addProjectMember(
            data.projectId as string,
            data.userId as string,
            data.role as string
          )
          break

        case 'add_team_member':
          result = await addTeamMember(data.teamId as string, data.userId as string)
          break

        default:
          result = { error: 'Unknown action type' }
      }

      if (result.error) {
        setMessages(prev => prev.map(m =>
          m.id === messageId && m.action
            ? { ...m, action: { ...m.action, status: 'error' as const, error: result.error } }
            : m
        ))
      } else {
        setMessages(prev => prev.map(m =>
          m.id === messageId && m.action
            ? { ...m, action: { ...m.action, status: 'success' as const } }
            : m
        ))
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === messageId && m.action
          ? { ...m, action: { ...m.action, status: 'error' as const, error: err instanceof Error ? err.message : 'Action failed' } }
          : m
      ))
    }
  }, [messages])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    confirmAction,
    clearChat,
  }
}
```

**Step 2: Verify changes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add hooks/use-ai-chat.ts
git commit -m "feat(ai): add useAIChat hook for chat state management"
```

---

## Task 3: Create AI Chat Message Component

**Files:**
- Create: `components/ai/ai-chat-message.tsx`

**Step 1: Create the component**

```typescript
"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Check, X, SpinnerGap, Warning, Paperclip } from "@phosphor-icons/react"
import type { Message } from "@/hooks/use-ai-chat"

interface AIChatMessageProps {
  message: Message
  onConfirmAction?: () => void
}

export function AIChatMessage({ message, onConfirmAction }: AIChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted border"
        )}
      >
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.attachments.map(att => (
              <div
                key={att.id}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded",
                  isUser ? "bg-primary-foreground/20" : "bg-background"
                )}
              >
                <Paperclip className="w-3 h-3" />
                <span className="truncate max-w-[150px]">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>

        {/* Action confirmation */}
        {message.action && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <ActionConfirmation
              action={message.action}
              onConfirm={onConfirmAction}
            />
          </div>
        )}
      </div>
    </div>
  )
}

interface ActionConfirmationProps {
  action: NonNullable<Message['action']>
  onConfirm?: () => void
}

function ActionConfirmation({ action, onConfirm }: ActionConfirmationProps) {
  const actionLabels: Record<string, string> = {
    create_task: 'Create Task',
    update_task: 'Update Task',
    delete_task: 'Delete Task',
    assign_task: 'Assign Task',
    create_project: 'Create Project',
    update_project: 'Update Project',
    create_workstream: 'Create Workstream',
    update_workstream: 'Update Workstream',
    create_client: 'Create Client',
    update_client: 'Update Client',
    create_note: 'Create Note',
    update_note: 'Update Note',
    add_project_member: 'Add Project Member',
    add_team_member: 'Add Team Member',
  }

  if (action.status === 'pending') {
    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Proposed action: {actionLabels[action.type] || action.type}
        </div>
        <div className="text-xs bg-background/50 rounded p-2 font-mono">
          {JSON.stringify(action.data, null, 2)}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm}>
            <Check className="w-4 h-4 mr-1" />
            Confirm
          </Button>
        </div>
      </div>
    )
  }

  if (action.status === 'executing') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <SpinnerGap className="w-4 h-4 animate-spin" />
        Executing...
      </div>
    )
  }

  if (action.status === 'success') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="w-4 h-4" />
        Action completed successfully
      </div>
    )
  }

  if (action.status === 'error') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Warning className="w-4 h-4" />
          {action.error || 'Action failed'}
        </div>
        <Button size="sm" variant="outline" onClick={onConfirm}>
          Retry
        </Button>
      </div>
    )
  }

  return null
}
```

**Step 2: Verify changes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add components/ai/ai-chat-message.tsx
git commit -m "feat(ai): add chat message component with action confirmation"
```

---

## Task 4: Create AI Chat Input Component

**Files:**
- Create: `components/ai/ai-chat-input.tsx`

**Step 1: Create the component**

```typescript
"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PaperPlaneRight, Paperclip, X } from "@phosphor-icons/react"
import type { Attachment } from "@/hooks/use-ai-chat"

interface AIChatInputProps {
  onSend: (message: string, attachments?: Attachment[]) => void
  disabled?: boolean
  placeholder?: string
}

export function AIChatInput({ onSend, disabled, placeholder = "Ask anything..." }: AIChatInputProps) {
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    if (!message.trim() && attachments.length === 0) return
    if (disabled || isProcessing) return

    onSend(message, attachments.length > 0 ? attachments : undefined)
    setMessage("")
    setAttachments([])
  }, [message, attachments, disabled, isProcessing, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsProcessing(true)

    try {
      const newAttachments: Attachment[] = []

      for (const file of Array.from(files)) {
        const extractedText = await extractFileText(file)

        newAttachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          extractedText,
        })
      }

      setAttachments(prev => [...prev, ...newAttachments])
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  return (
    <div className="space-y-2">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2">
          {attachments.map(att => (
            <div
              key={att.id}
              className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded"
            >
              <Paperclip className="w-3 h-3" />
              <span className="truncate max-w-[120px]">{att.name}</span>
              <button
                onClick={() => removeAttachment(att.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.txt,.md,.json,.csv,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.css,.html,.xml,.yaml,.yml"
        />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isProcessing}
          className="shrink-0"
        >
          <Paperclip className="w-5 h-5" />
        </Button>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isProcessing}
          className="min-h-[44px] max-h-[200px] resize-none"
          rows={1}
        />

        <Button
          onClick={handleSend}
          disabled={disabled || isProcessing || (!message.trim() && attachments.length === 0)}
          size="icon"
          className="shrink-0"
        >
          <PaperPlaneRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
}

// Text extraction helper
async function extractFileText(file: File): Promise<string | undefined> {
  const type = file.type
  const name = file.name.toLowerCase()

  // Text files - read directly
  if (
    type.startsWith('text/') ||
    name.endsWith('.md') ||
    name.endsWith('.json') ||
    name.endsWith('.csv') ||
    name.endsWith('.js') ||
    name.endsWith('.ts') ||
    name.endsWith('.jsx') ||
    name.endsWith('.tsx') ||
    name.endsWith('.py') ||
    name.endsWith('.java') ||
    name.endsWith('.c') ||
    name.endsWith('.cpp') ||
    name.endsWith('.h') ||
    name.endsWith('.css') ||
    name.endsWith('.html') ||
    name.endsWith('.xml') ||
    name.endsWith('.yaml') ||
    name.endsWith('.yml')
  ) {
    return file.text()
  }

  // PDF - would need pdfjs-dist, for now return placeholder
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return `[PDF file: ${file.name} - text extraction requires PDF.js library]`
  }

  // Word docs - would need mammoth, for now return placeholder
  if (type.includes('word') || name.endsWith('.docx') || name.endsWith('.doc')) {
    return `[Word document: ${file.name} - text extraction requires mammoth library]`
  }

  // Images - mark for vision processing
  if (type.startsWith('image/')) {
    return `[Image: ${file.name}]`
  }

  return `[File: ${file.name} - unsupported type]`
}
```

**Step 2: Verify changes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add components/ai/ai-chat-input.tsx
git commit -m "feat(ai): add chat input component with file attachments"
```

---

## Task 5: Create AI Chat Sheet Component

**Files:**
- Create: `components/ai/ai-chat-sheet.tsx`

**Step 1: Create the main sheet component**

```typescript
"use client"

import { useEffect, useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Trash, SpinnerGap } from "@phosphor-icons/react"
import { StarFour } from "@phosphor-icons/react/dist/ssr"
import { useAIChat, type Attachment } from "@/hooks/use-ai-chat"
import { useAIStatus } from "@/hooks/use-ai-status"
import { AIChatMessage } from "./ai-chat-message"
import { AIChatInput } from "./ai-chat-input"
import { AISetupPrompt } from "./ai-setup-prompt"
import type { ChatContext } from "@/lib/actions/ai"

interface AIChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ChatContext
}

export function AIChatSheet({ open, onOpenChange, context }: AIChatSheetProps) {
  const { isConfigured, isLoading: isCheckingAI } = useAIStatus()
  const { messages, isLoading, error, sendMessage, confirmAction, clearChat } = useAIChat(context)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (content: string, attachments?: Attachment[]) => {
    await sendMessage(content, attachments)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:w-[500px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <StarFour className="w-5 h-5 text-violet-500" weight="fill" />
              AI Assistant
            </SheetTitle>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-muted-foreground"
              >
                <Trash className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </SheetHeader>

        {isCheckingAI ? (
          <div className="flex-1 flex items-center justify-center">
            <SpinnerGap className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !isConfigured ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <AISetupPrompt
              onConfigured={() => {
                // Refresh AI status
              }}
            />
          </div>
        ) : (
          <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <StarFour className="w-12 h-12 mx-auto mb-4 text-violet-500/30" weight="fill" />
                  <p className="text-sm">Ask me anything about your projects and tasks.</p>
                  <p className="text-xs mt-1">I can help you find information, get insights, and take actions.</p>
                </div>
              ) : (
                messages.map(msg => (
                  <AIChatMessage
                    key={msg.id}
                    message={msg}
                    onConfirmAction={msg.action ? () => confirmAction(msg.id) : undefined}
                  />
                ))
              )}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="bg-muted border rounded-lg px-4 py-3">
                    <SpinnerGap className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="shrink-0 border-t p-4">
              <AIChatInput
                onSend={handleSend}
                disabled={isLoading}
                placeholder="Ask anything..."
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

**Step 2: Verify changes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add components/ai/ai-chat-sheet.tsx
git commit -m "feat(ai): add chat sheet component"
```

---

## Task 6: Wire Up Ask AI Button in Project Header

**Files:**
- Modify: `components/project-header.tsx`

**Step 1: Read current file**

Read the file to understand current structure.

**Step 2: Add state and AIChatSheet**

- Import AIChatSheet and useState
- Add state for sheet open/close
- Add onClick handler to Ask AI button
- Render AIChatSheet with appropriate context
- Build context from current projects data

**Step 3: Verify changes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add components/project-header.tsx
git commit -m "feat(ai): wire up Ask AI button in project header"
```

---

## Task 7: Wire Up Ask AI Button in My Tasks Page

**Files:**
- Modify: `components/tasks/MyTasksPage.tsx`

**Step 1: Read current file**

Read the file to understand current structure.

**Step 2: Add state and AIChatSheet**

- Import AIChatSheet and useState
- Add state for sheet open/close
- Add onClick handler to Ask AI button
- Render AIChatSheet with my_tasks context
- Build context from current tasks data

**Step 3: Verify changes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add components/tasks/MyTasksPage.tsx
git commit -m "feat(ai): wire up Ask AI button in my tasks page"
```

---

## Task 8: Add Ask AI to Project Detail Page

**Files:**
- Modify: `components/projects/ProjectPageHeader.tsx` or similar

**Step 1: Find project detail header**

Locate the component that renders the project detail page header.

**Step 2: Add Ask AI button**

- Add Ask AI button similar to other pages
- Build rich context with full project data (workstreams, tasks, notes)
- Wire up AIChatSheet

**Step 3: Verify changes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add <files>
git commit -m "feat(ai): add Ask AI button to project detail page"
```

---

## Task 9: Add Ask AI to Clients Page

**Files:**
- Modify: `components/clients/ClientsPage.tsx` or `components/clients/ClientsPageHeader.tsx`

**Step 1: Find clients page header**

Locate the component that renders the clients page header.

**Step 2: Add Ask AI button**

- Add Ask AI button similar to other pages
- Build context including all clients data
- Wire up AIChatSheet

**Step 3: Verify changes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add <files>
git commit -m "feat(ai): add Ask AI button to clients page"
```

---

## Task 10: Add Ask AI to Client Detail Page

**Files:**
- Modify: `components/clients/ClientDetailsHeader.tsx` or similar

**Step 1: Find client detail header**

Locate the component that renders the client detail page header.

**Step 2: Add Ask AI button**

- Add Ask AI button similar to other pages
- Build context with full client data (projects, contacts)
- Wire up AIChatSheet

**Step 3: Verify changes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add <files>
git commit -m "feat(ai): add Ask AI button to client detail page"
```

---

## Task 11: Test Full Flow

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test projects page**

- Navigate to projects page
- Click Ask AI button
- Verify sheet opens
- Test sending a message
- Verify response is received

**Step 3: Test my tasks page**

- Navigate to my tasks page
- Click Ask AI button
- Verify context includes tasks

**Step 4: Test project detail**

- Navigate to a project detail page
- Click Ask AI button
- Verify rich context (workstreams, tasks, notes)

**Step 5: Test action confirmation**

- Ask AI to create a task
- Verify confirmation UI appears
- Confirm action
- Verify task is created

**Step 6: Commit if any fixes needed**

```bash
git add .
git commit -m "fix(ai): polish chat assistant flow"
```

---

## Task 12: Final Build Verification

**Step 1: Run production build**

Run: `pnpm build`
Expected: Build succeeds with no errors

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No new errors (existing warnings OK)

**Step 3: Final commit if needed**

```bash
git add .
git commit -m "chore: final cleanup for AI chat assistant"
```
