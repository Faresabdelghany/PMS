import type {
  ReportPeriodType,
  ReportProjectStatus,
  ClientSatisfaction,
  RiskType,
  RiskSeverity,
  RiskStatus,
  TeamContributionEntry,
} from "@/lib/supabase/types"

export type ReportWizardData = {
  // Step 1: Scope
  title: string
  periodType: ReportPeriodType
  periodStart: string // ISO date
  periodEnd: string
  selectedProjectIds: string[]

  // Step 2: Project status (keyed by project ID)
  projectData: Record<string, ProjectReportData>

  // Step 4: Risks
  risks: RiskEntry[]

  // Step 5: Highlights & Decisions
  highlights: HighlightEntry[]
  decisions: DecisionEntry[]
}

export type ProjectReportData = {
  status: ReportProjectStatus
  previousStatus: ReportProjectStatus | null
  clientSatisfaction: ClientSatisfaction
  previousSatisfaction: ClientSatisfaction | null
  progressPercent: number
  previousProgress: number | null
  narrative: string
  teamContributions: TeamContributionEntry[]
  financialNotes: string
}

export type RiskEntry = {
  id: string
  projectId: string | null
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
  projectId: string | null
  description: string
}

export type DecisionEntry = {
  id: string
  projectId: string | null
  description: string
}
