// Non-async utility functions for AI module
// These don't need "use server" as they're pure helper functions

// Get default model for provider
export function getDefaultModel(provider: string): string {
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
