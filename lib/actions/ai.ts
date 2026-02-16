// =============================================================================
// AI Module - Re-exports from modular structure
// =============================================================================
// This file has been refactored into smaller modules under lib/actions/ai/
// All exports are re-exported here for backwards compatibility.
//
// Module structure:
// - ai/types.ts       - Type definitions
// - ai/config.ts      - Configuration and verification
// - ai/providers.ts   - Single-turn provider API calls
// - ai/chat-providers.ts - Multi-turn chat provider API calls
// - ai/generation.ts  - Text generation functions
// - ai/chat.ts        - Chat completion logic
// - ai/index.ts       - Main exports
// =============================================================================

// Note: Types are NOT re-exported here to avoid bundler issues with "use server"
// Import them directly from "@/lib/actions/ai-types" instead

// Re-export all public API from the modular structure
export {
  // Types
  type ProjectContext,
  type GenerationOptions,
  type AIGenerationResult,
  type ChatMessage,
  type ChatResponse,
  type TaskDescriptionContext,
  type WorkstreamDescriptionContext,
  type ClientNotesContext,
  type FileDescriptionContext,
  // Config
  verifyAIConfig,
  getDefaultModel,
  // Generation
  generateText,
  generateProjectDescription,
  generateTaskDescription,
  generateWorkstreamDescription,
  generateClientNotes,
  generateFileDescription,
  generateTasks,
  generateWorkstreams,
  summarizeNotes,
  enhanceTranscription,
  enhanceNoteContent,
  testAIConnection,
  // Chat
  sendChatMessage,
} from "./ai/index"
