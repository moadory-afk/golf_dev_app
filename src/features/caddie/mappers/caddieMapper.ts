import { createAICaddieAdvice } from '../engine'
import type { AICaddieInput, RiskLevel, UserDistanceProfile } from '../types/caddie'
import type {
  CaddieBindingInput,
  CaddieDistanceProfileRow,
  CaddieHoleGuideRow,
  CaddieUserPreferencesRow,
  HomeAICaddiePreview,
  MappedCaddieProfile,
  UserPreferenceTee,
} from '../types/caddieData'

function numberOrUndefined(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

export function mapDistanceProfile(row?: CaddieDistanceProfileRow | null): UserDistanceProfile {
  if (!row) return {}
  return {
    userId: row.user_id,
    driver: numberOrUndefined(row.driver_m),
    wood3: numberOrUndefined(row.wood3_m),
    wood5: numberOrUndefined(row.wood5_m),
    hybrid4: numberOrUndefined(row.hybrid4_m),
    hybrid5: numberOrUndefined(row.hybrid5_m),
    iron5: numberOrUndefined(row.iron5_m),
    iron6: numberOrUndefined(row.iron6_m),
    iron7: numberOrUndefined(row.iron7_m),
    iron8: numberOrUndefined(row.iron8_m),
    iron9: numberOrUndefined(row.iron9_m),
    pw: numberOrUndefined(row.pw_m),
    aw: numberOrUndefined(row.aw_m),
    sw: numberOrUndefined(row.sw_m),
    putterNote: row.putter_note ?? undefined,
  }
}

function normalizeTee(value?: string | null): UserPreferenceTee {
  if (value === 'blue' || value === 'red' || value === 'white') return value
  return 'white'
}

export function mapCaddieProfile(raw: { distanceProfile?: CaddieDistanceProfileRow | null; preferences?: CaddieUserPreferencesRow | null }): MappedCaddieProfile {
  const defaultTee = normalizeTee(raw.preferences?.default_tee)
  return {
    distanceProfile: mapDistanceProfile(raw.distanceProfile),
    preferences: {
      userId: raw.preferences?.user_id ?? raw.distanceProfile?.user_id ?? '',
      defaultTee,
      distanceUnit: raw.preferences?.distance_unit === 'yd' ? 'yd' : 'm',
      showAiCaddie: raw.preferences?.show_ai_caddie ?? true,
    },
  }
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

function fallbackPreview(input: CaddieBindingInput): HomeAICaddiePreview {
  return {
    title: input.courseName ? `${input.courseName} 공략 준비중` : 'AI 캐디 준비중',
    message: `최근 평균 ${input.fallbackAverageScore}타 기준으로 다음 라운드 전략을 준비하고 있어요.`,
    primaryChip: input.dday || '준비중',
    secondaryChip: `${input.fallbackAverageScore}타 평균`,
    hasLiveAdvice: false,
  }
}

export function mapHomeAICaddiePreview(input: CaddieBindingInput): HomeAICaddiePreview {
  const { distanceProfile, preferences } = mapCaddieProfile(input.raw)
  const guide = input.raw.holeGuide
  if (!guide || !preferences.showAiCaddie) return fallbackPreview(input)

  const remainingDistanceM = distanceByTee(guide, preferences.defaultTee) ?? 150
  const adviceInput: AICaddieInput = {
    environment: {
      remainingDistanceM,
      lie: 'tee',
      intent: 'safe',
    },
    distanceProfile,
    holeGuide: guide,
  }
  const advice = createAICaddieAdvice(adviceInput)
  const clubLabel = advice.recommendation?.clubLabel ?? '안전한 클럽'
  const holeTitle = guide.title?.trim() || `${guide.hole_no}번홀`
  const risk = riskLabel(advice.risk.level)

  return {
    title: `${clubLabel} 추천 · ${holeTitle}`,
    message: advice.strategy.message || advice.shotPlan.primaryAction,
    primaryChip: `${advice.effectiveDistance.effectiveDistanceM}m 기준`,
    secondaryChip: risk,
    hasLiveAdvice: true,
    recommendedClub: clubLabel,
    riskLabel: risk,
    advice,
  }
}
