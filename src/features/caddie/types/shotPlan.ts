import type { ClubKey, RecommendationMode, UserDistanceProfile } from './caddie'
import type { HoleGuideRiskSource } from './caddie'

export type ShotPlanStepKind = 'tee' | 'approach' | 'wedge' | 'green'

export type AIShotPlanStep = {
  order: number
  kind: ShotPlanStepKind
  label: string
  club?: ClubKey
  clubLabel: string
  plannedDistanceM: number
  remainingAfterM: number
  note: string
}

export type ScoreProbability = {
  label: 'Birdie' | 'Par' | 'Bogey' | 'Double+'
  value: number
}

export type AIShotPlan = {
  mode: RecommendationMode
  modeLabel: string
  difficultyLabel: 'EASY' | 'NORMAL' | 'HARD'
  riskLabel: 'SAFE' | 'RISK' | 'DANGER'
  targetScoreLabel: 'Birdie Chance' | 'Par' | 'Par ~ Bogey' | 'Bogey Save'
  expectedStrokes: number
  expectedScoreText: string
  parProbability: number
  bogeyProbability: number
  doubleProbability: number
  probabilities: ScoreProbability[]
  summary: string
  shortSummary: string
  mission: string
  reason: string
  steps: AIShotPlanStep[]
}

export type AIShotPlanInput = {
  holeNo: number
  par?: number | null
  teeDistanceM?: number | null
  mode?: RecommendationMode
  distanceProfile: UserDistanceProfile
  holeGuide?: HoleGuideRiskSource | null
}

export type AIShotPlanRoundSummary = {
  totalExpectedScore: number
  parCount: number
  bogeyCount: number
  doubleCount: number
  missionScore: number
  missionText: string
  holes: Array<{
    holeNo: number
    par?: number | null
    shortSummary: string
    expectedStrokes: number
    mode: RecommendationMode
    riskLabel: AIShotPlan['riskLabel']
  }>
}
