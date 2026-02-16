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

// AI generation context for tasks
export type TaskDescriptionContext = {
  taskName: string
  projectName?: string
  priority?: string
  status?: string
  existingDescription?: string
}

// AI generation context for workstreams
export type WorkstreamDescriptionContext = {
  workstreamName: string
  projectName?: string
}

// AI generation context for client notes
export type ClientNotesContext = {
  clientName: string
  industry?: string
  status?: string
  contactName?: string
  contactEmail?: string
  location?: string
  website?: string
}

// AI generation context for file descriptions
export type FileDescriptionContext = {
  fileName: string
  projectName?: string
}

// Chat message types
export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface ChatResponse {
  content: string
  action?: import("../ai-types").ProposedAction
  actions?: import("../ai-types").ProposedAction[]
  suggestedActions?: import("../ai-types").SuggestedAction[]
}
