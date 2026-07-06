import type { ClubKey, ClubRecommendation, ShotIntent, UserDistanceProfile } from '../types/caddie'

export const CLUB_LABELS: Record<ClubKey, string> = {
  driver: 'Driver',
  wood3: '3W',
  wood5: '5W',
  hybrid4: '4H',
  hybrid5: '5H',
  iron5: '5I',
  iron6: '6I',
  iron7: '7I',
  iron8: '8I',
  iron9: '9I',
  pw: 'PW',
  aw: 'AW',
  sw: 'SW',
}

const CLUB_ORDER: ClubKey[] = [
  'driver',
  'wood3',
  'wood5',
  'hybrid4',
  'hybrid5',
  'iron5',
  'iron6',
  'iron7',
  'iron8',
  'iron9',
  'pw',
  'aw',
  'sw',
]

export const DEFAULT_DISTANCE_PROFILE: Required<Pick<UserDistanceProfile, ClubKey>> = {
  driver: 200,
  wood3: 180,
  wood5: 170,
  hybrid4: 160,
  hybrid5: 150,
  iron5: 150,
  iron6: 140,
  iron7: 130,
  iron8: 120,
  iron9: 110,
  pw: 100,
  aw: 85,
  sw: 70,
}

function normalizeProfile(profile: UserDistanceProfile) {
  return CLUB_ORDER.map((club) => ({
    club,
    distance: profile[club] ?? DEFAULT_DISTANCE_PROFILE[club],
  })).filter((item) => Number.isFinite(item.distance) && item.distance > 0)
}

function confidenceFromGap(gapM: number, targetDistanceM: number) {
  const tolerance = Math.max(6, targetDistanceM * 0.08)
  const raw = 100 - (Math.abs(gapM) / tolerance) * 28
  return Math.max(45, Math.min(98, Math.round(raw)))
}

function confidenceLabel(confidence: number) {
  if (confidence >= 90) return '매우 높음'
  if (confidence >= 78) return '높음'
  if (confidence >= 64) return '보통'
  return '주의 필요'
}

function intentPenalty(club: ClubKey, intent: ShotIntent) {
  if (intent === 'safe' || intent === 'layup') {
    if (club === 'driver') return 18
    if (club === 'wood3') return 7
  }
  if (intent === 'recovery') {
    if (club === 'driver' || club === 'wood3') return 30
    if (club === 'wood5') return 18
  }
  return 0
}

function reasonFor(club: ClubKey, gapM: number, targetDistanceM: number, intent: ShotIntent) {
  const label = CLUB_LABELS[club]
  const absGap = Math.abs(gapM)
  const direction = gapM >= 0 ? '여유' : '부족'
  const base = `${label}는 목표 ${targetDistanceM}m와 ${absGap}m ${direction} 차이입니다.`
  if (intent === 'safe') return `${base} 안정적인 공략을 우선했습니다.`
  if (intent === 'layup') return `${base} 다음 샷이 편한 거리로 남기는 선택입니다.`
  if (intent === 'recovery') return `${base} 탈출과 방향성을 우선했습니다.`
  return `${base} 그린 공략 가능성을 우선했습니다.`
}

export function recommendClub(
  targetDistanceM: number,
  profile: UserDistanceProfile,
  intent: ShotIntent = 'attack',
): ClubRecommendation | null {
  if (!Number.isFinite(targetDistanceM) || targetDistanceM <= 0) return null

  const candidates = normalizeProfile(profile).map((item) => {
    const gapM = Math.round(item.distance - targetDistanceM)
    const score = Math.abs(gapM) + intentPenalty(item.club, intent) + (gapM < -12 ? 10 : 0)
    return { ...item, gapM, score }
  })

  const sorted = candidates.sort((a, b) => a.score - b.score || Math.abs(a.gapM) - Math.abs(b.gapM))
  const best = sorted[0]
  if (!best) return null

  const confidence = Math.max(45, confidenceFromGap(best.gapM, targetDistanceM) - intentPenalty(best.club, intent))
  const alternatives = sorted.slice(1, 4).map((item) => ({
    club: item.club,
    clubLabel: CLUB_LABELS[item.club],
    expectedCarryM: item.distance,
    gapM: item.gapM,
  }))

  return {
    club: best.club,
    clubLabel: CLUB_LABELS[best.club],
    expectedCarryM: best.distance,
    targetDistanceM: Math.round(targetDistanceM),
    gapM: best.gapM,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    reason: reasonFor(best.club, best.gapM, Math.round(targetDistanceM), intent),
    alternatives,
  }
}
