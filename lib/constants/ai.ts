// AI Provider types
export type AIProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "mistral"
  | "xai"
  | "deepseek"
  | "openrouter"
  | null

// Provider display names and API key URLs
export const AI_PROVIDERS: Record<string, { name: string; keyUrl: string }> = {
  openai: {
    name: "OpenAI (GPT-4)",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    name: "Anthropic (Claude)",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  google: {
    name: "Google (Gemini)",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  groq: {
    name: "Groq (Fast Inference)",
    keyUrl: "https://console.groq.com/keys",
  },
  mistral: {
    name: "Mistral AI",
    keyUrl: "https://console.mistral.ai/api-keys",
  },
  xai: {
    name: "xAI (Grok)",
    keyUrl: "https://console.x.ai/",
  },
  deepseek: {
    name: "DeepSeek",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  openrouter: {
    name: "OpenRouter (100+ Models)",
    keyUrl: "https://openrouter.ai/keys",
  },
}

// AI Model options per provider
export const AI_MODELS: Record<string, { label: string; value: string }[]> = {
  openai: [
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "GPT-4o Mini", value: "gpt-4o-mini" },
    { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
    { label: "o1", value: "o1" },
    { label: "o1 Mini", value: "o1-mini" },
    { label: "o3 Mini", value: "o3-mini" },
  ],
  anthropic: [
    { label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-20241022" },
    { label: "Claude 3.5 Haiku", value: "claude-3-5-haiku-20241022" },
    { label: "Claude 3 Opus", value: "claude-3-opus-20240229" },
  ],
  google: [
    { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash-exp" },
    { label: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
    { label: "Gemini 1.5 Flash", value: "gemini-1.5-flash" },
  ],
  groq: [
    { label: "Llama 3.3 70B", value: "llama-3.3-70b-versatile" },
    { label: "Llama 3.1 8B Instant", value: "llama-3.1-8b-instant" },
    { label: "Llama 3 70B", value: "llama3-70b-8192" },
    { label: "Mixtral 8x7B", value: "mixtral-8x7b-32768" },
    { label: "Gemma 2 9B", value: "gemma2-9b-it" },
  ],
  mistral: [
    { label: "Mistral Large", value: "mistral-large-latest" },
    { label: "Mistral Medium", value: "mistral-medium-latest" },
    { label: "Mistral Small", value: "mistral-small-latest" },
    { label: "Codestral", value: "codestral-latest" },
    { label: "Pixtral Large", value: "pixtral-large-latest" },
  ],
  xai: [
    { label: "Grok 2", value: "grok-2-latest" },
    { label: "Grok 2 Vision", value: "grok-2-vision-latest" },
    { label: "Grok Beta", value: "grok-beta" },
  ],
  deepseek: [
    { label: "DeepSeek Chat", value: "deepseek-chat" },
    { label: "DeepSeek Coder", value: "deepseek-coder" },
    { label: "DeepSeek Reasoner", value: "deepseek-reasoner" },
  ],
  openrouter: [
    { label: "Auto (Best for prompt)", value: "openrouter/auto" },
    { label: "Claude 3.5 Sonnet", value: "anthropic/claude-3.5-sonnet" },
    { label: "GPT-4o", value: "openai/gpt-4o" },
    { label: "Llama 3.1 405B", value: "meta-llama/llama-3.1-405b-instruct" },
    { label: "Mistral Large", value: "mistralai/mistral-large" },
    { label: "Gemini Pro 1.5", value: "google/gemini-pro-1.5" },
    { label: "DeepSeek V3", value: "deepseek/deepseek-chat" },
    { label: "Qwen 2.5 72B", value: "qwen/qwen-2.5-72b-instruct" },
  ],
}
