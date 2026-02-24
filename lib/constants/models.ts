// Model types and constants — shared between server actions and client components

export type ModelTier = "Free" | "Standard" | "Premium"

export const AVAILABLE_MODELS = [
  { value: "anthropic/claude-opus-4-6", label: "Claude Opus 4", tier: "Premium" as ModelTier },
  { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4", tier: "Standard" as ModelTier },
  { value: "groq/llama-3.1-8b-instant", label: "Llama 3.1 8B", tier: "Free" as ModelTier },
  { value: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B", tier: "Free" as ModelTier },
  { value: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash", tier: "Standard" as ModelTier },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "Standard" as ModelTier },
  { value: "openai/gpt-4o", label: "GPT-4o", tier: "Premium" as ModelTier },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini", tier: "Standard" as ModelTier },
] as const

export function getModelTier(model: string | null): ModelTier {
  if (!model) return "Standard"
  const found = AVAILABLE_MODELS.find((m) => m.value === model)
  return found?.tier ?? "Standard"
}
