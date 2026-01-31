import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  verifyAIConfig,
  buildChatSystemPrompt,
  type ChatContext,
  type ChatMessage,
} from "@/lib/actions/ai"
import { rateLimiters, checkRateLimit } from "@/lib/rate-limit/limiter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
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

            // Handle Google's different format (JSON array streaming)
            if (provider === "google") {
              try {
                // Google streams JSON objects directly
                const cleanLine = line.replace(/^\[|\]$/g, "").replace(/^,/, "")
                if (!cleanLine.trim()) continue
                const json = JSON.parse(cleanLine)
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
    // Verify authentication
    const supabase = await createClient()
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

    // Verify AI configuration
    const configResult = await verifyAIConfig()
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
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
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
