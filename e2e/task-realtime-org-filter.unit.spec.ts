import { expect, test } from "@playwright/test"
import {
  buildTaskProjectRealtimeFilters,
  countTasksVisibleToProjects,
} from "@/lib/realtime/task-org-filter"

test.describe("task realtime org filter", () => {
  test("builds a single in-filter for <= 10 project ids", async () => {
    const filters = buildTaskProjectRealtimeFilters([
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10",
    ])

    expect(filters).toEqual([
      "project_id=in.(p1,p2,p3,p4,p5,p6,p7,p8,p9,p10)",
    ])
  })

  test("chunks filters when project ids exceed supabase in-clause limit", async () => {
    const filters = buildTaskProjectRealtimeFilters([
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12",
    ])

    expect(filters).toEqual([
      "project_id=in.(p1,p2,p3,p4,p5,p6,p7,p8,p9,p10)",
      "project_id=in.(p11,p12)",
    ])
  })

  test("keeps org-specific project scopes isolated", async () => {
    const orgA = buildTaskProjectRealtimeFilters(["org-a-1", "org-a-2"])
    const orgB = buildTaskProjectRealtimeFilters(["org-b-1", "org-b-2"])

    expect(orgA.join(",")).not.toContain("org-b-1")
    expect(orgA.join(",")).not.toContain("org-b-2")
    expect(orgB.join(",")).not.toContain("org-a-1")
    expect(orgB.join(",")).not.toContain("org-a-2")
  })

  test("reduces event volume versus unfiltered baseline", async () => {
    const taskProjectIds = [
      "org-a-1", "org-a-2", "org-b-1", "org-b-2",
      "org-a-1", "org-b-2", "org-a-2", "org-b-1",
    ]

    const baselineUnfilteredVolume = taskProjectIds.length
    const orgAScopedVolume = countTasksVisibleToProjects(taskProjectIds, ["org-a-1", "org-a-2"])

    expect(orgAScopedVolume).toBe(4)
    expect(orgAScopedVolume).toBeLessThan(baselineUnfilteredVolume)
  })
})
