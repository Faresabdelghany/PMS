// Edge Function: check-deadlines
// Runs daily via pg_cron to send notifications for approaching and overdue tasks
//
// Setup:
// 1. Deploy: supabase functions deploy check-deadlines
// 2. Schedule via Supabase Dashboard > Database > Extensions > pg_cron
//    Or run: SELECT cron.schedule('check-deadlines-daily', '0 8 * * *', ...)

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface Task {
  id: string
  name: string
  assignee_id: string
  project_id: string
  organization_id: string
  due_date: string
  metadata: Record<string, unknown> | null
}

interface TaskWithProject {
  id: string
  name: string
  assignee_id: string
  project_id: string
  end_date: string
  metadata: Record<string, unknown> | null
  project: {
    organization_id: string
  }
}

Deno.serve(async (req) => {
  try {
    // Verify request is authorized (service role or cron)
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Tasks due within 24 hours (using end_date field)
    const { data: approachingTasks, error: approachingError } = await supabase
      .from("tasks")
      .select(`
        id,
        name,
        assignee_id,
        project_id,
        end_date,
        metadata,
        project:projects(organization_id)
      `)
      .gte("end_date", now.toISOString())
      .lte("end_date", tomorrow.toISOString())
      .not("assignee_id", "is", null)
      .neq("status", "done")
      .neq("status", "cancelled")

    if (approachingError) {
      console.error("Error fetching approaching tasks:", approachingError)
    }

    // Tasks overdue
    const { data: overdueTasks, error: overdueError } = await supabase
      .from("tasks")
      .select(`
        id,
        name,
        assignee_id,
        project_id,
        end_date,
        metadata,
        project:projects(organization_id)
      `)
      .lt("end_date", now.toISOString())
      .not("assignee_id", "is", null)
      .neq("status", "done")
      .neq("status", "cancelled")

    if (overdueError) {
      console.error("Error fetching overdue tasks:", overdueError)
    }

    // Filter out already notified tasks and create notifications
    const approachingToNotify = ((approachingTasks as TaskWithProject[]) ?? []).filter(
      (t) => !t.metadata?.deadline_notified
    )

    const overdueToNotify = ((overdueTasks as TaskWithProject[]) ?? []).filter(
      (t) => !t.metadata?.overdue_notified
    )

    let approachingCount = 0
    let overdueCount = 0

    // Create notifications for approaching deadlines
    for (const task of approachingToNotify) {
      const orgId = task.project?.organization_id
      if (!orgId || !task.assignee_id) continue

      const { error: insertError } = await supabase.from("inbox_items").insert({
        organization_id: orgId,
        user_id: task.assignee_id,
        actor_id: null, // system notification
        item_type: "task_update",
        title: `"${task.name}" is due tomorrow`,
        project_id: task.project_id,
        task_id: task.id,
      })

      if (!insertError) {
        // Mark as notified
        await supabase
          .from("tasks")
          .update({
            metadata: { ...(task.metadata ?? {}), deadline_notified: true },
          })
          .eq("id", task.id)
        approachingCount++
      }
    }

    // Create notifications for overdue tasks
    for (const task of overdueToNotify) {
      const orgId = task.project?.organization_id
      if (!orgId || !task.assignee_id) continue

      const { error: insertError } = await supabase.from("inbox_items").insert({
        organization_id: orgId,
        user_id: task.assignee_id,
        actor_id: null, // system notification
        item_type: "task_update",
        title: `"${task.name}" is overdue`,
        project_id: task.project_id,
        task_id: task.id,
      })

      if (!insertError) {
        // Mark as notified
        await supabase
          .from("tasks")
          .update({
            metadata: { ...(task.metadata ?? {}), overdue_notified: true },
          })
          .eq("id", task.id)
        overdueCount++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        approaching: approachingCount,
        overdue: overdueCount,
        timestamp: now.toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("Check-deadlines error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
})
