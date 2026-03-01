type PrimitiveRecord = Record<string, unknown>

export type DoDCheckType =
  | "required_fields"
  | "reviewer_approved"
  | "tests_passing"
  | "pr_merged"
  | "documentation_updated"

export interface RequiredFieldsCheck {
  type: "required_fields"
  fields: string[]
}

export interface ReviewerApprovedCheck {
  type: "reviewer_approved"
}

export interface TestsPassingCheck {
  type: "tests_passing"
}

export interface PrMergedCheck {
  type: "pr_merged"
}

export interface DocumentationUpdatedCheck {
  type: "documentation_updated"
}

export type DoDCheckConfig =
  | RequiredFieldsCheck
  | ReviewerApprovedCheck
  | TestsPassingCheck
  | PrMergedCheck
  | DocumentationUpdatedCheck

export interface DoDCheckResult {
  checkName: DoDCheckType
  passed: boolean
  message: string
  metadata?: PrimitiveRecord
}

export function runRequiredFieldsCheck(
  taskLike: PrimitiveRecord,
  fields: string[]
): DoDCheckResult {
  const missing = fields.filter((field) => {
    const value = taskLike[field]
    if (value === null || value === undefined) return true
    if (typeof value === "string" && value.trim().length === 0) return true
    return false
  })

  if (missing.length === 0) {
    return {
      checkName: "required_fields",
      passed: true,
      message: "All required fields are present.",
    }
  }

  return {
    checkName: "required_fields",
    passed: false,
    message: `Missing required fields: ${missing.join(", ")}`,
    metadata: { missing },
  }
}

export function runReviewerApprovedCheck(
  approved: boolean
): DoDCheckResult {
  return approved
    ? {
        checkName: "reviewer_approved",
        passed: true,
        message: "Reviewer approval found.",
      }
    : {
        checkName: "reviewer_approved",
        passed: false,
        message: "Reviewer approval is required before marking done.",
      }
}

export function runTestsPassingCheck(
  taskLike: PrimitiveRecord
): DoDCheckResult {
  const metadata = taskLike.metadata as PrimitiveRecord | null | undefined
  const testsStatus = metadata?.tests_status as string | undefined
  const passed = testsStatus === "passing"

  return {
    checkName: "tests_passing",
    passed,
    message: passed
      ? "Tests are passing."
      : "Tests must be passing before marking done.",
    metadata: testsStatus ? { tests_status: testsStatus } : undefined,
  }
}

export function runPrMergedCheck(
  taskLike: PrimitiveRecord
): DoDCheckResult {
  const metadata = taskLike.metadata as PrimitiveRecord | null | undefined
  const prUrl = metadata?.pr_url as string | undefined
  const prMerged = metadata?.pr_merged === true

  if (!prUrl) {
    return {
      checkName: "pr_merged",
      passed: false,
      message: "A linked PR is required before marking done.",
    }
  }

  return {
    checkName: "pr_merged",
    passed: prMerged,
    message: prMerged
      ? "Linked PR has been merged."
      : "Linked PR must be merged before marking done.",
    metadata: { pr_url: prUrl, pr_merged: prMerged },
  }
}

export function runDocumentationUpdatedCheck(
  taskLike: PrimitiveRecord
): DoDCheckResult {
  const description = (taskLike.description as string) ?? ""
  const metadata = taskLike.metadata as PrimitiveRecord | null | undefined
  const docsUpdated = metadata?.docs_updated === true

  const descMentionsDocs =
    /\b(docs?|documentation|readme|changelog)\b/i.test(description)

  const passed = docsUpdated || descMentionsDocs

  return {
    checkName: "documentation_updated",
    passed,
    message: passed
      ? "Documentation has been updated."
      : "Documentation must be updated before marking done.",
  }
}
