import type { ActionResult } from "../types"
import type { AIGenerationResult, GenerationOptions } from "./types"

// Make API call to OpenAI
export async function callOpenAI(
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
export async function callAnthropic(
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
export async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerationOptions = {}
): Promise<ActionResult<AIGenerationResult>> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
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
export async function callGroq(
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
export async function callMistral(
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
export async function callXAI(
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
export async function callDeepSeek(
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
export async function callOpenRouter(
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
