import { CLUB_LABELS, DEFAULT_DISTANCE_PROFILE, recommendClub } from './clubRecommendation'
import { analyzeHoleRisk } from './riskAnalyzer'
import type { AIShotPlan, AIShotPlanInput, AIShotPlanRoundSummary, AIShotPlanStep } from '../types/shotPlan'
import type { ClubKey, RecommendationMode, RiskLevel, UserDistanceProfile } from '../types/caddie'

const MODE_LABELS: Record<RecommendationMode, string> = {
  SAFE: '안정 공략',
  BALANCED: '균형 공략',
  ATTACK: '공격 공략',
}

const TEE_CANDIDATES: Record<RecommendationMode, ClubKey[]> = {
  SAFE: ['wood3', 'wood5', 'hybrid4', 'driver'],
  BALANCED: ['driver', 'wood3', 'wood5', 'hybrid4'],
  ATTACK: ['driver', 'wood3', 'wood5'],
}

function getDistance(profile: UserDistanceProfile, club: ClubKey) {
  return profile[club] ?? DEFAULT_DISTANCE_PROFILE[club]
}

function roundDistance(value: number) {
  return Math.max(0, Math.round(value))
}

function intentForMode(mode: RecommendationMode) {
  if (mode === 'SAFE') return 'safe'
  if (mode === 'ATTACK') return 'attack'
  return 'layup'
}

function riskScore(level: RiskLevel) {
  if (level === 'high') return 2
  if (level === 'medium') return 1
  return 0
}

function riskLabel(level: RiskLevel): AIShotPlan['riskLabel'] {
  if (level === 'high') return 'DANGER'
  if (level === 'medium') return 'RISK'
  return 'SAFE'
}

function difficultyLabel(par: number, distanceM: number, level: RiskLevel): AIShotPlan['difficultyLabel'] {
  const distancePressure = par <= 3 ? distanceM > 165 : par === 4 ? distanceM > 380 : distanceM > 520
  if (level === 'high' || distancePressure) return 'HARD'
  if (level === 'medium') return 'NORMAL'
  return 'EASY'
}

function selectTeeClub(params: {
  par: number
  distanceM: number
  mode: RecommendationMode
  profile: UserDistanceProfile
  riskLevel: RiskLevel
}) {
  const { par, distanceM, mode, profile, riskLevel } = params
  if (par <= 3) return null

  const candidates = TEE_CANDIDATES[mode]
  let selected = candidates[0]
  if (mode === 'SAFE' && riskLevel === 'high') selected = candidates[0]
  if (mode === 'BALANCED' && riskLevel === 'high') selected = 'wood3'
  if (mode === 'ATTACK') selected = 'driver'

  if (distanceM <= 310 && mode !== 'ATTACK') selected = riskLevel === 'high' ? 'hybrid4' : 'wood3'
  return selected
}

function createStep(order: number, kind: AIShotPlanStep['kind'], club: ClubKey | undefined, clubLabel: string, plannedDistanceM: number, remainingAfterM: number, note: string): AIShotPlanStep {
  return {
    order,
    kind,
    club,
    clubLabel,
    label: kind === 'tee' ? 'Tee Shot' : kind === 'approach' ? 'Approach' : kind === 'wedge' ? 'Short Game' : 'Green',
    plannedDistanceM: roundDistance(plannedDistanceM),
    remainingAfterM: roundDistance(remainingAfterM),
    note,
  }
}

function scoreFromPlan(params: {
  par: number
  shotCountToGreen: number
  remainingM: number
  riskLevel: RiskLevel
  mode: RecommendationMode
}) {
  const { par, shotCountToGreen, remainingM, riskLevel, mode } = params
  const risk = riskScore(riskLevel)
  const shortGamePenalty = remainingM > 0 && remainingM <= 45 ? 0.28 : remainingM > 45 ? 0.55 : 0
  const putts = 1.95 + risk * 0.12 + (mode === 'ATTACK' ? 0.08 : mode === 'SAFE' ? -0.04 : 0)
  const expected = Math.max(par - 0.25, shotCountToGreen + shortGamePenalty + putts)
  return Math.round(expected * 10) / 10
}

function probabilityFromExpected(par: number, expected: number, riskLevel: RiskLevel) {
  const delta = expected - par
  const risk = riskScore(riskLevel)
  const parProbability = Math.max(18, Math.min(82, Math.round(72 - delta * 28 - risk * 8)))
  const doubleProbability = Math.max(3, Math.min(35, Math.round(6 + delta * 12 + risk * 8)))
  const bogeyProbability = Math.max(8, Math.min(65, 100 - parProbability - doubleProbability))
  const birdieProbability = Math.max(1, Math.min(18, Math.round(8 - delta * 5 - risk * 2)))
  const adjustedPar = Math.max(5, parProbability - Math.round(birdieProbability / 2))
  return {
    parProbability: adjustedPar,
    bogeyProbability,
    doubleProbability,
    probabilities: [
      { label: 'Birdie' as const, value: birdieProbability },
      { label: 'Par' as const, value: adjustedPar },
      { label: 'Bogey' as const, value: bogeyProbability },
      { label: 'Double+' as const, value: doubleProbability },
    ],
  }
}

function targetScoreLabel(par: number, expected: number): AIShotPlan['targetScoreLabel'] {
  const delta = expected - par
  if (delta <= -0.1) return 'Birdie Chance'
  if (delta <= 0.35) return 'Par'
  if (delta <= 0.85) return 'Par ~ Bogey'
  return 'Bogey Save'
}

export function createAIShotPlan(input: AIShotPlanInput): AIShotPlan {
  const par = input.par ?? 4
  const mode = input.mode ?? 'SAFE'
  const distanceM = input.teeDistanceM && input.teeDistanceM > 0 ? input.teeDistanceM : par === 3 ? 150 : par === 5 ? 500 : 360
  const profile = input.distanceProfile
  const risk = analyzeHoleRisk(input.holeGuide)
  const steps: AIShotPlanStep[] = []

  let remaining = distanceM
  let order = 1

  if (par <= 3) {
    const recommendation = recommendClub(distanceM, profile, intentForMode(mode))
    if (recommendation) {
      remaining = Math.max(0, distanceM - recommendation.expectedCarryM)
      steps.push(createStep(order++, 'approach', recommendation.club, recommendation.clubLabel, recommendation.expectedCarryM, remaining, `${distanceM}m Par3 기준 공략 클럽입니다.`))
    }
  } else {
    const teeClub = selectTeeClub({ par, distanceM, mode, profile, riskLevel: risk.level })
    if (teeClub) {
      const teeDistance = getDistance(profile, teeClub)
      remaining = Math.max(0, distanceM - teeDistance)
      steps.push(createStep(order++, 'tee', teeClub, CLUB_LABELS[teeClub], teeDistance, remaining, mode === 'SAFE' ? '페어웨이 안착을 우선합니다.' : mode === 'ATTACK' ? '가능한 전진 거리를 확보합니다.' : '거리와 안정성을 함께 봅니다.'))
    }

    while (remaining > 45 && steps.length < 3) {
      const recommendation = recommendClub(remaining, profile, intentForMode(mode))
      if (!recommendation) break
      const after = Math.max(0, remaining - recommendation.expectedCarryM)
      steps.push(createStep(order++, 'approach', recommendation.club, recommendation.clubLabel, recommendation.expectedCarryM, after, `${roundDistance(remaining)}m 남은 거리 기준 추천입니다.`))
      remaining = after
      if (after === 0) break
    }
  }

  if (remaining > 0 && remaining <= 45) {
    steps.push(createStep(order++, 'wedge', undefined, 'Approach', remaining, 0, `${roundDistance(remaining)}m는 짧은 어프로치로 마무리합니다.`))
    remaining = 0
  }

  if (steps.length === 0) {
    steps.push(createStep(1, 'approach', 'iron7', CLUB_LABELS.iron7, getDistance(profile, 'iron7'), Math.max(0, distanceM - getDistance(profile, 'iron7')), '기본 거리 프로필 기준 임시 공략입니다.'))
  }

  const shotCountToGreen = steps.filter((step) => step.kind !== 'green').length
  const expectedStrokes = scoreFromPlan({ par, shotCountToGreen, remainingM: remaining, riskLevel: risk.level, mode })
  const probabilities = probabilityFromExpected(par, expectedStrokes, risk.level)
  const shortSummary = steps.map((step) => step.clubLabel).join(' → ')
  const riskText = risk.signals[0]?.label ?? '큰 위험 신호 없음'
  const expectedScoreText = `${expectedStrokes.toFixed(1)}타`
  const targetLabel = targetScoreLabel(par, expectedStrokes)

  return {
    mode,
    modeLabel: MODE_LABELS[mode],
    difficultyLabel: difficultyLabel(par, distanceM, risk.level),
    riskLabel: riskLabel(risk.level),
    targetScoreLabel: targetLabel,
    expectedStrokes,
    expectedScoreText,
    parProbability: probabilities.parProbability,
    bogeyProbability: probabilities.bogeyProbability,
    doubleProbability: probabilities.doubleProbability,
    probabilities: probabilities.probabilities,
    summary: `${shortSummary} 플랜으로 ${targetLabel} 구간을 목표로 합니다.`,
    shortSummary,
    mission: `${targetLabel} 목표 · 예상 ${expectedScoreText}`,
    reason: `${riskText}을 고려해 ${MODE_LABELS[mode]} 기준으로 남은 거리가 편한 순서를 만들었습니다.`,
    steps,
  }
}

export function summarizeAIShotPlans(plans: Array<{ holeNo: number; par?: number | null; plan: AIShotPlan }>): AIShotPlanRoundSummary {
  const totalExpectedScore = Math.round(plans.reduce((sum, item) => sum + item.plan.expectedStrokes, 0))
  const parCount = plans.filter((item) => item.plan.expectedStrokes - (item.par ?? 4) <= 0.35).length
  const bogeyCount = plans.filter((item) => {
    const diff = item.plan.expectedStrokes - (item.par ?? 4)
    return diff > 0.35 && diff <= 1.15
  }).length
  const doubleCount = Math.max(0, plans.length - parCount - bogeyCount)
  const missionScore = Math.max(totalExpectedScore - 1, plans.reduce((sum, item) => sum + (item.par ?? 4), 0))

  return {
    totalExpectedScore,
    parCount,
    bogeyCount,
    doubleCount,
    missionScore,
    missionText: `오늘 목표 ${missionScore}타 · Par ${parCount}개 / Bogey ${bogeyCount}개`,
    holes: plans.map((item) => ({
      holeNo: item.holeNo,
      par: item.par,
      shortSummary: item.plan.shortSummary,
      expectedStrokes: item.plan.expectedStrokes,
      mode: item.plan.mode,
      riskLabel: item.plan.riskLabel,
    })),
  }
}
