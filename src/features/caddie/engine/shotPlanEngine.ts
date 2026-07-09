import type { AIShotPlanHole, AIShotPlanProbability, AIShotPlanStep, AIShotPlanStepType, AIShotPlanSummary, ClubKey, RecommendationMode, UserDistanceProfile } from '../types/caddie'
import { CLUB_LABELS, DEFAULT_DISTANCE_PROFILE, recommendClub } from './clubRecommendation'

function distanceFor(profile: UserDistanceProfile, club: ClubKey) {
  const d = profile[club]
  return (d == null || d <= 0) ? 0 : d
}

function pickTeeClub(mode: RecommendationMode, par: number, distanceM: number, profile: UserDistanceProfile): ClubKey {
  if (par <= 3) return recommendClub(distanceM, profile, 'attack')?.club ?? 'iron7'
  if (mode === 'SAFE') {
    if (par >= 5) return 'driver'
    const driver = Math.max(0,distanceFor(profile,'driver'))
    const wood3 = Math.max(0,distanceFor(profile,'wood3'))
    if (driver > 215 && distanceM < 350) return 'wood3'
    if(driver>0){return wood3>=170&&distanceM<330?'wood3':'driver'}
      return wood3>0?'wood3':'iron5'
  }
  return 'driver'
}

function pickSecondClub(mode: RecommendationMode, remainingM: number, profile: UserDistanceProfile) {
  const allowed: ClubKey[] = mode === 'SAFE'
    ? ['wood5', 'hybrid4', 'hybrid5', 'iron5', 'iron6']
    : ['wood3', 'wood5', 'hybrid4', 'hybrid5', 'iron5']
  return allowed.filter(c=>distanceFor(profile,c)>0).find((club)=>distanceFor(profile, club)<=remainingM-80) ?? allowed.filter(c=>distanceFor(profile,c)>0).slice(-1)[0] ?? 'pw'
}

function createStep(type: AIShotPlanStepType, label: string, club: ClubKey, remainingBeforeM: number, profile: UserDistanceProfile): AIShotPlanStep {
  const carryM = Math.max(0, Math.round(distanceFor(profile, club)))
  return {
    type,
    label,
    clubLabel: CLUB_LABELS[club],
    carryM,
    remainingAfterM: Math.max(0, Math.round(remainingBeforeM - carryM)),
  }
}

function expectedStrokesFor(params: {
  par: number
  mode: RecommendationMode
  remainingAfterPlanM: number
  distanceM: number
  stepCount: number
}) {
  const { par, mode, remainingAfterPlanM, distanceM, stepCount } = params
  const distancePenalty = Math.max(0, (distanceM - par * 110) / 260)
  const remainPenalty = Math.min(0.6, remainingAfterPlanM / 120)
  const stepPenalty = Math.max(0, stepCount - Math.max(1, par - 2)) * 0.25
  const modeAdjustment = mode === 'ATTACK' ? -0.12 : mode === 'SAFE' ? 0.08 : 0
  return Number((par + 0.28 + distancePenalty + remainPenalty + stepPenalty + modeAdjustment).toFixed(1))
}

function probabilityFor(expectedStrokes: number, par: number): AIShotPlanProbability {
  const overPar = expectedStrokes - par
  const parProb = Math.max(18, Math.min(78, Math.round(76 - overPar * 34)))
  const doubleProb = Math.max(4, Math.min(32, Math.round(6 + overPar * 15)))
  const bogeyProb = Math.max(10, Math.min(70, 100 - parProb - doubleProb))
  return { par: parProb, bogey: bogeyProb, double: Math.max(0, 100 - parProb - bogeyProb) }
}

function difficultyFor(expectedStrokes: number, par: number) {
  const overPar = expectedStrokes - par
  if (overPar >= 0.75) return { difficulty: 'HARD' as const, label: '🔴 HARD' }
  if (overPar >= 0.38) return { difficulty: 'NORMAL' as const, label: '🟡 NORMAL' }
  return { difficulty: 'EASY' as const, label: '🟢 EASY' }
}

function modeLabel(mode: RecommendationMode) {
  if (mode === 'SAFE') return '🟢 SAFE'
  if (mode === 'ATTACK') return '🔴 ATTACK'
  return '🟡 BALANCED'
}

function scoreLabel(expectedStrokes: number, par: number) {
  if (expectedStrokes <= par + 0.35) return 'Par 중심'
  if (expectedStrokes <= par + 0.85) return 'Par ~ Bogey'
  return 'Bogey 관리'
}

export function createAIShotPlanHole(params: {
  holeNo: number
  par?: number | null
  distanceM?: number | null
  mode?: RecommendationMode
  distanceProfile: UserDistanceProfile
  riskLabel?: string
}): AIShotPlanHole | null {
  const distanceM = Math.round(params.distanceM ?? 0)
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null

  const par = params.par ?? (distanceM <= 190 ? 3 : distanceM >= 450 ? 5 : 4)
  const mode = params.mode ?? 'SAFE'
  const steps: AIShotPlanStep[] = []
  let remaining = distanceM

  if (par <= 3) {
    const club = recommendClub(remaining, params.distanceProfile, mode === 'SAFE' ? 'safe' : 'attack')?.club ?? 'iron7'
    const step = createStep('tee', 'Tee Shot', club, remaining, params.distanceProfile)
    steps.push(step)
    remaining = step.remainingAfterM
  } else {
    const teeClub = pickTeeClub(mode, par, distanceM, params.distanceProfile)
    const teeStep = createStep('tee', 'Tee Shot', teeClub, remaining, params.distanceProfile)
    steps.push(teeStep)
    remaining = teeStep.remainingAfterM

    if (par >= 5 && remaining > 190) {
      const secondClub = pickSecondClub(mode, remaining, params.distanceProfile)
      const secondStep = createStep('second', 'Second Shot', secondClub, remaining, params.distanceProfile)
      steps.push(secondStep)
      remaining = secondStep.remainingAfterM
    }

    if (remaining > 25) {
      const approachClub = recommendClub(remaining, params.distanceProfile, mode === 'ATTACK' ? 'attack' : 'safe')?.club ?? 'pw'
      const approachStep = createStep('approach', 'Approach', approachClub, remaining, params.distanceProfile)
      steps.push(approachStep)
      remaining = approachStep.remainingAfterM
    }
  }

  const expectedStrokes = expectedStrokesFor({ par, mode, remainingAfterPlanM: remaining, distanceM, stepCount: steps.length })
  const probability = probabilityFor(expectedStrokes, par)
  const difficulty = difficultyFor(expectedStrokes, par)
  const compact = steps.map((step) => step.clubLabel).join(' → ')
  const confidence = Math.max(58, Math.min(94, Math.round(96 - Math.abs(expectedStrokes - par) * 18 - Math.max(0, remaining / 8))))
  const first = steps[0]
  const last = steps[steps.length - 1]
  const riskText = params.riskLabel && params.riskLabel !== '안정 구간' ? `${params.riskLabel} 구간을 고려했습니다.` : '큰 위험보다 거리 관리에 집중했습니다.'

  return {
    holeNo: params.holeNo,
    par,
    distanceM,
    mode,
    modeLabel: modeLabel(mode),
    difficulty: difficulty.difficulty,
    difficultyLabel: difficulty.label,
    expectedStrokes,
    expectedScoreLabel: scoreLabel(expectedStrokes, par),
    probability,
    steps,
    compact,
    mission: `${params.holeNo}번홀 목표는 ${scoreLabel(expectedStrokes, par)}입니다.`,
    reason: `${first?.clubLabel ?? '추천 클럽'}로 ${first?.carryM ?? 0}m를 보낸 뒤 ${last?.clubLabel ?? '웨지'}로 그린을 노리는 플랜입니다. ${riskText}`,
    confidence,
  }
}

export function createAIShotPlanSummary(holes: Array<AIShotPlanHole | null | undefined>): AIShotPlanSummary {
  const validHoles = holes.filter((hole): hole is AIShotPlanHole => Boolean(hole))
  const expectedScore = Math.round(validHoles.reduce((sum, hole) => sum + hole.expectedStrokes, 0))
  const counts = validHoles.reduce(
    (acc, hole) => {
      const diff = hole.expectedStrokes - hole.par
      if (diff <= 0.4) acc.parCount += 1
      else if (diff <= 1.15) acc.bogeyCount += 1
      else acc.doubleCount += 1
      return acc
    },
    { parCount: 0, bogeyCount: 0, doubleCount: 0 },
  )

  return {
    expectedScore,
    missionScore: Math.max(72, expectedScore - 2),
    ...counts,
    compactRows: validHoles.map((hole) => ({
      holeNo: hole.holeNo,
      compact: hole.compact,
      expectedStrokes: hole.expectedStrokes,
      difficultyLabel: hole.difficultyLabel,
    })),
  }
}
