import type { AICaddieAdvice } from './caddie'
import type { AIShotPlan, AIShotPlanRoundSummary } from './shotPlan'
import type { CaddieDistanceProfileRow, CaddieHoleGuideRow, CaddieUserPreferencesRow } from './caddieData'

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
  recommendedClub?: string
  effectiveDistanceM?: number
  riskLabel: string
  planHeadline: string
  planMessage: string
  aiStrategyMessage: string
  checkpoints: string[]
  advice: AICaddieAdvice
  shotPlan: AIShotPlan
}


export type CaddieBookData = {
  courseName: string
  layoutName?: string | null
  holes: CaddieBookHole[]
  primaryHole?: CaddieBookHole
  hasLiveGuide: boolean
  shotPlanSummary?: AIShotPlanRoundSummary
}
