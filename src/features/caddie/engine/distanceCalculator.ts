import type { EffectiveDistanceResult, LieCondition, ShotEnvironment, SlopeDirection, WindDirection } from '../types/caddie'

const WIND_MULTIPLIER_M: Record<WindDirection, number> = {
  hurting: 1.4,
  helping: -0.8,
  leftToRight: 0.35,
  rightToLeft: 0.35,
  calm: 0,
}

const LIE_MULTIPLIER: Record<LieCondition, number> = {
  tee: 0,
  fairway: 0,
  rough: 0.06,
  bunker: 0.12,
  recovery: 0.08,
}

function normalizeSlope(direction?: SlopeDirection) {
  return direction ?? 'flat'
}

export function calculateWindAdjustmentM(windSpeedMps = 0, direction: WindDirection = 'calm') {
  if (!Number.isFinite(windSpeedMps) || windSpeedMps <= 0) return 0
  return Math.round(windSpeedMps * WIND_MULTIPLIER_M[direction])
}

export function calculateElevationAdjustmentM(elevationM = 0, direction?: SlopeDirection) {
  if (!Number.isFinite(elevationM) || elevationM === 0) return 0
  const slope = normalizeSlope(direction)
  const normalizedElevation = Math.abs(elevationM)
  if (slope === 'uphill') return Math.round(normalizedElevation * 1.1)
  if (slope === 'downhill') return -Math.round(normalizedElevation * 0.75)
  return 0
}

export function calculateLieAdjustmentM(baseDistanceM: number, lie: LieCondition = 'fairway') {
  if (!Number.isFinite(baseDistanceM) || baseDistanceM <= 0) return 0
  return Math.round(baseDistanceM * LIE_MULTIPLIER[lie])
}

export function calculateEffectiveDistance(environment: ShotEnvironment): EffectiveDistanceResult {
  const baseDistanceM = Math.max(0, Math.round(environment.remainingDistanceM || 0))
  const windAdjustmentM = calculateWindAdjustmentM(environment.windSpeedMps, environment.windDirection)
  const elevationAdjustmentM = calculateElevationAdjustmentM(environment.elevationM, environment.slopeDirection)
  const lieAdjustmentM = calculateLieAdjustmentM(baseDistanceM, environment.lie)
  const effectiveDistanceM = Math.max(0, baseDistanceM + windAdjustmentM + elevationAdjustmentM + lieAdjustmentM)

  const notes: string[] = []
  if (windAdjustmentM > 0) notes.push(`맞바람 보정 +${windAdjustmentM}m`)
  if (windAdjustmentM < 0) notes.push(`뒷바람 보정 ${windAdjustmentM}m`)
  if (elevationAdjustmentM > 0) notes.push(`오르막 보정 +${elevationAdjustmentM}m`)
  if (elevationAdjustmentM < 0) notes.push(`내리막 보정 ${elevationAdjustmentM}m`)
  if (lieAdjustmentM > 0) notes.push(`라이 보정 +${lieAdjustmentM}m`)
  if (notes.length === 0) notes.push('기본 거리 기준')

  return {
    baseDistanceM,
    windAdjustmentM,
    elevationAdjustmentM,
    lieAdjustmentM,
    effectiveDistanceM,
    notes,
  }
}
