import { test, expect } from "@playwright/test"
import { runRequiredFieldsCheck, runReviewerApprovedCheck } from "@/lib/mission-control/dod-runner"

test.describe("dod-runner unit", () => {
  test("fails when required fields are missing", async () => {
    const result = runRequiredFieldsCheck(
      {
        name: "Task Alpha",
        description: "",
        assignee_id: null,
      },
      ["name", "description", "assignee_id"]
    )

    expect(result.passed).toBeFalsy()
    expect(result.message).toContain("description")
    expect(result.message).toContain("assignee_id")
  })

  test("passes when required fields are present", async () => {
    const result = runRequiredFieldsCheck(
      {
        name: "Task Alpha",
        description: "Ready for done",
        assignee_id: "user-1",
      },
      ["name", "description", "assignee_id"]
    )

    expect(result.passed).toBeTruthy()
  })

  test("reviewer check reflects approval state", async () => {
    expect(runReviewerApprovedCheck(true).passed).toBeTruthy()
    expect(runReviewerApprovedCheck(false).passed).toBeFalsy()
  })
})

