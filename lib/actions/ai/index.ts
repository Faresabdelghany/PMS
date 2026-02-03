// Re-export types
export type {
  ProjectContext,
  GenerationOptions,
  AIGenerationResult,
  ChatMessage,
  ChatResponse,
} from "./types"

// Re-export config functions
export { verifyAIConfig } from "./config"
export { getDefaultModel } from "./utils"

// Re-export generation functions
export {
  generateText,
  generateProjectDescription,
  generateTasks,
  generateWorkstreams,
  summarizeNotes,
  enhanceTranscription,
  enhanceNoteContent,
  testAIConnection,
} from "./generation"

// Re-export chat functions
export { sendChatMessage } from "./chat"
