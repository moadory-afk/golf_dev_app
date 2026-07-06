import { createAICaddieAdvice, createAIShotPlan, summarizeAIShotPlans } from '../engine'
import type { AICaddieInput, RiskLevel } from '../types/caddie'
import type { CaddieBookData, CaddieBookHole, CaddieBookRawData } from '../types/caddieBook'
import type { CaddieHoleGuideRow, UserPreferenceTee } from '../types/caddieData'
import { mapCaddieProfile } from './caddieMapper'

function numberOrUndefined(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function distanceByTee(guide: CaddieHoleGuideRow, tee: UserPreferenceTee) {
  if (tee === 'blue') return numberOrUndefined(guide.blue_tee_m) ?? numberOrUndefined(guide.white_tee_m) ?? numberOrUndefined(guide.red_tee_m)
  if (tee === 'red') return numberOrUndefined(guide.red_tee_m) ?? numberOrUndefined(guide.white_tee_m) ?? numberOrUndefined(guide.blue_tee_m)
  return numberOrUndefined(guide.white_tee_m) ?? numberOrUndefined(guide.blue_tee_m) ?? numberOrUndefined(guide.red_tee_m)
}

function riskLabel(level: RiskLevel) {
  if (level === 'high') return '위험 높음'
  if (level === 'medium') return '주의 필요'
  return '안정 구간'
}

function holeTitle(guide: CaddieHoleGuideRow) {
  return guide.title?.trim() || `${guide.hole_no}번홀`
}

export function mapCaddieBookData(params: {
  raw: CaddieBookRawData
  courseName?: string | null
  layoutName?: string | null
}): CaddieBookData {
  const { distanceProfile, preferences } = mapCaddieProfile(params.raw)
  const holes: CaddieBookHole[] = params.raw.holeGuides.map((guide) => {
    const teeDistanceM = distanceByTee(guide, preferences.defaultTee)
    const input: AICaddieInput = {
      environment: {
        remainingDistanceM: teeDistanceM ?? 150,
        lie: 'tee',
        intent: 'safe',
      },
      distanceProfile,
      holeGuide: guide,
    }
    const advice = createAICaddieAdvice(input)
    const shotPlan = createAIShotPlan({
      holeNo: guide.hole_no,
      par: guide.par,
      teeDistanceM,
      mode: advice.strategy.mode,
      distanceProfile,
      holeGuide: guide,
    })

    return {
      id: guide.id,
      holeNo: guide.hole_no,
      par: guide.par,
      title: holeTitle(guide),
      summary: guide.summary,
      strategy: guide.strategy,
      caution: guide.caution,
      teeDistanceM,
      recommendedClub: advice.recommendation?.clubLabel,
      effectiveDistanceM: advice.effectiveDistance.effectiveDistanceM,
      riskLabel: riskLabel(advice.risk.level),
      planHeadline: advice.shotPlan.headline,
      planMessage: advice.strategy.message || advice.shotPlan.primaryAction,
      aiStrategyMessage: advice.strategy.message || advice.shotPlan.primaryAction,
      checkpoints: advice.shotPlan.checkpoints,
      advice,
      shotPlan,
    }
  })

  const shotPlanSummary = summarizeAIShotPlans(holes.map((hole) => ({ holeNo: hole.holeNo, par: hole.par, plan: hole.shotPlan })))

  return {
    courseName: params.courseName || '캐디북',
    layoutName: params.layoutName,
    holes,
    primaryHole: holes[0],
    hasLiveGuide: holes.length > 0 && preferences.showAiCaddie,
    shotPlanSummary,
  }
}
