import type { ActionResult } from "../types"
import type { AIGenerationResult } from "./types"

// Multi-turn chat function for OpenAI
export async function callOpenAIChat(
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
export async function callAnthropicChat(
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
export async function callGeminiChat(
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
export async function callGroqChat(
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
export async function callMistralChat(
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
export async function callXAIChat(
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
export async function callDeepSeekChat(
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
export async function callOpenRouterChat(
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
