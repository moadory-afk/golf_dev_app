export * from './distanceCalculator'
export * from './clubRecommendation'
export * from './riskAnalyzer'
export * from './shotPlanner'
export * from './holeStrategy'
export * from './shotPlanEngine'

import type { AICaddieAdvice, AICaddieInput } from '../types/caddie'
import { calculateEffectiveDistance } from './distanceCalculator'
import { recommendClub } from './clubRecommendation'
import { analyzeHoleRisk } from './riskAnalyzer'
import { createShotPlan } from './shotPlanner'
import { createHoleStrategy } from './holeStrategy'

export function createAICaddieAdvice(input: AICaddieInput): AICaddieAdvice {
  const effectiveDistance = calculateEffectiveDistance(input.environment)
  const recommendation = recommendClub(
    effectiveDistance.effectiveDistanceM,
    input.distanceProfile,
    input.environment.intent ?? 'attack',
  )
  const risk = analyzeHoleRisk(input.holeGuide)
  const shotPlan = createShotPlan(risk, recommendation)
  const strategy = createHoleStrategy(input.holeGuide, recommendation, risk, shotPlan, effectiveDistance)

  return {
    effectiveDistance,
    recommendation,
    risk,
    strategy,
    shotPlan,
  }
}
