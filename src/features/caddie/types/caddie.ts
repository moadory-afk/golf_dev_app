export type ClubKey =
  | 'driver'
  | 'wood3'
  | 'wood5'
  | 'hybrid4'
  | 'hybrid5'
  | 'iron5'
  | 'iron6'
  | 'iron7'
  | 'iron8'
  | 'iron9'
  | 'pw'
  | 'aw'
  | 'sw'

export type LieCondition = 'tee' | 'fairway' | 'rough' | 'bunker' | 'recovery'
export type ShotIntent = 'attack' | 'safe' | 'layup' | 'recovery'
export type WindDirection = 'helping' | 'hurting' | 'leftToRight' | 'rightToLeft' | 'calm'
export type SlopeDirection = 'uphill' | 'downhill' | 'flat'
export type RiskLevel = 'low' | 'medium' | 'high'
export type RecommendationMode = 'SAFE' | 'BALANCED' | 'ATTACK'

export type UserDistanceProfile = Partial<Record<ClubKey, number>> & {
  userId?: string
  putterNote?: string
}

export type ShotEnvironment = {
  remainingDistanceM: number
  windSpeedMps?: number
  windDirection?: WindDirection
  elevationM?: number
  slopeDirection?: SlopeDirection
  lie?: LieCondition
  intent?: ShotIntent
}

export type EffectiveDistanceResult = {
  baseDistanceM: number
  windAdjustmentM: number
  elevationAdjustmentM: number
  lieAdjustmentM: number
  effectiveDistanceM: number
  notes: string[]
}

export type ClubRecommendation = {
  club: ClubKey
  clubLabel: string
  expectedCarryM: number
  targetDistanceM: number
  gapM: number
  confidence: number
  confidenceLabel: string
  reason: string
  alternatives: Array<{
    club: ClubKey
    clubLabel: string
    expectedCarryM: number
    gapM: number
  }>
}

export type HoleGuideRiskSource = {
  summary?: string | null
  strategy?: string | null
  caution?: string | null
  tee_strategy?: unknown
  shot_plan?: unknown
  ob_info?: unknown
  bunker_info?: unknown
  hazard_info?: unknown
  green_info?: unknown
  course_features?: unknown
  difficulty_tags?: unknown
  difficulty_factors?: unknown
}

export type RiskSignal = {
  key: string
  label: string
  level: RiskLevel
  reason: string
}

export type RiskAnalysis = {
  level: RiskLevel
  score: number
  signals: RiskSignal[]
  summary: string
}

export type ShotPlan = {
  intent: ShotIntent
  headline: string
  primaryAction: string
  checkpoints: string[]
  warning?: string
}

export type StrategyScore = {
  label: string
  value: number
  stars: string
}

export type HoleStrategySection = {
  title: string
  message: string
}

export type HoleStrategy = {
  title: string
  message: string
  bullets: string[]
  mode: RecommendationMode
  confidence: number
  confidenceLabel: string
  scores: StrategyScore[]
  sections: HoleStrategySection[]
  warning?: string
}

export type AICaddieInput = {
  environment: ShotEnvironment
  distanceProfile: UserDistanceProfile
  holeGuide?: HoleGuideRiskSource | null
}

export type AICaddieAdvice = {
  effectiveDistance: EffectiveDistanceResult
  recommendation: ClubRecommendation | null
  risk: RiskAnalysis
  strategy: HoleStrategy
  shotPlan: ShotPlan
}
