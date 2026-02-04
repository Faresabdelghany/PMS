import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type StatusUpdate = {
  taskId: string
  status: "todo" | "in-progress" | "done"
}

/**
 * Batch update multiple task statuses in a single request
 * Reduces network overhead and improves INP
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const updates = body.updates as StatusUpdate[]

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Batch update all tasks
    const success: string[] = []
    const errors: Record<string, string> = {}

    await Promise.all(
      updates.map(async (update) => {
        try {
          const { error } = await supabase
            .from("tasks")
            .update({ status: update.status, updated_at: new Date().toISOString() })
            .eq("id", update.taskId)

          if (error) {
            errors[update.taskId] = error.message
          } else {
            success.push(update.taskId)
          }
        } catch (err) {
          errors[update.taskId] = err instanceof Error ? err.message : "Unknown error"
        }
      })
    )

    return NextResponse.json({ success, errors })
  } catch (error) {
    console.error("Batch update error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
