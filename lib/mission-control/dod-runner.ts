type PrimitiveRecord = Record<string, unknown>

export type DoDCheckType = "required_fields" | "reviewer_approved"

export interface RequiredFieldsCheck {
  type: "required_fields"
  fields: string[]
}

export interface ReviewerApprovedCheck {
  type: "reviewer_approved"
}

export type DoDCheckConfig = RequiredFieldsCheck | ReviewerApprovedCheck

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

