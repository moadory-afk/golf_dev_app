import type { AICaddieAdvice, AIShotPlanHole, AIShotPlanSummary } from './caddie'
import type { CaddieDistanceProfileRow, CaddieHoleGuideRow, CaddieUserPreferencesRow, UserPreferenceTee } from './caddieData'

export type CaddieBookRouteParams = {
  courseId?: string | null
  layoutId?: string | null
  courseName?: string | null
  layoutName?: string | null
  scheduleId?: string | null
}

export type CaddieBookRawData = {
  distanceProfile: CaddieDistanceProfileRow | null
  preferences: CaddieUserPreferencesRow | null
  holeGuides: CaddieHoleGuideRow[]
}

export type CaddieBookHole = {
  id: string
  holeNo: number
  par?: number | null
  title: string
  summary: string
  strategy?: string | null
  caution?: string | null
  teeDistanceM?: number
  blueTeeM?: number | null
  whiteTeeM?: number | null
  redTeeM?: number | null
  recommendedClub?: string
  effectiveDistanceM?: number
  riskLabel: string
  planHeadline: string
  planMessage: string
  aiStrategyMessage: string
  checkpoints: string[]
  advice: AICaddieAdvice
  shotPlan?: AIShotPlanHole | null
}

export type CaddieBookData = {
  courseName: string
  layoutName?: string | null
  defaultTee: UserPreferenceTee
  holes: CaddieBookHole[]
  primaryHole?: CaddieBookHole
  hasLiveGuide: boolean
  shotPlanSummary?: AIShotPlanSummary
}
