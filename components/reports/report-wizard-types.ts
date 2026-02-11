import type {
  ReportPeriodType,
  ReportProjectStatus,
  ClientSatisfaction,
  RiskType,
  RiskSeverity,
  RiskStatus,
} from "@/lib/supabase/types"

export type ReportWizardData = {
  // Step 1: Scope & status
  title: string
  periodType: ReportPeriodType
  periodStart: string // ISO date
  periodEnd: string
  selectedProjectId: string | null

  // Flat project fields (shown when project selected)
  status: ReportProjectStatus
  previousStatus: ReportProjectStatus | null
  clientSatisfaction: ClientSatisfaction
  previousSatisfaction: ClientSatisfaction | null
  progressPercent: number
  previousProgress: number | null
  narrative: string
  financialNotes: string

  // Step 2: Risks
  risks: RiskEntry[]

  // Step 3: Highlights & Decisions
  highlights: HighlightEntry[]
  decisions: DecisionEntry[]
}

export type RiskEntry = {
  id: string
  type: RiskType
  description: string
  severity: RiskSeverity
  status: RiskStatus
  mitigationNotes: string
  originatedReportId: string | null
  isCarriedOver: boolean
}

export type HighlightEntry = {
  id: string
  description: string
}

export type DecisionEntry = {
  id: string
  description: string
}
