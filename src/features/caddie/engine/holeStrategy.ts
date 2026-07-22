import type {
  ClubRecommendation,
  EffectiveDistanceResult,
  HoleGuideRiskSource,
  HoleStrategy,
  RecommendationMode,
  RiskAnalysis,
  ShotPlan,
  StrategyScore,
} from '../types/caddie'

function firstText(...values: Array<string | null | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean)
}

function textFromUnknown(value: unknown): string {
  if (value === null || typeof value === 'undefined') return ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(textFromUnknown).filter(Boolean).join(' ')
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(textFromUnknown).filter(Boolean).join(' ')
  }
  return String(value).trim()
}

function compactSentence(value?: string | null, maxLength = 96) {
  const text = value?.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trim()}...`
}

function stars(value: number) {
  const normalized = Math.max(0, Math.min(100, value))
  const filled = Math.max(1, Math.min(5, Math.round(normalized / 20)))
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`
}

function modeFrom(risk: RiskAnalysis, recommendation: ClubRecommendation | null, shotPlan: ShotPlan): RecommendationMode {
  if (risk.level === 'high' || shotPlan.intent === 'safe' || shotPlan.intent === 'layup') return 'SAFE'
  if (!recommendation || recommendation.confidence < 78 || risk.level === 'medium') return 'BALANCED'
  return 'ATTACK'
}

function confidenceFrom(risk: RiskAnalysis, recommendation: ClubRecommendation | null) {
  const base = recommendation?.confidence ?? 62
  const riskPenalty = risk.level === 'high' ? 14 : risk.level === 'medium' ? 7 : 0
  const signalPenalty = Math.min(8, risk.signals.length * 2)
  return Math.max(45, Math.min(96, Math.round(base - riskPenalty - signalPenalty)))
}

function confidenceLabel(value: number) {
  if (value >= 88) return '매우 높음'
  if (value >= 76) return '높음'
  if (value >= 64) return '보통'
  return '주의 필요'
}

function buildScores(params: {
  recommendation: ClubRecommendation | null
  risk: RiskAnalysis
  effectiveDistance: EffectiveDistanceResult
}): StrategyScore[] {
  const distanceFit = params.recommendation
    ? Math.max(45, Math.min(100, 100 - Math.abs(params.recommendation.gapM) * 4))
    : 55
  const riskAvoidance = Math.max(45, 100 - params.risk.score)
  const strategyFit = Math.round((distanceFit + riskAvoidance + (params.recommendation?.confidence ?? 62)) / 3)

  return [
    { label: '거리 적합', value: distanceFit, stars: stars(distanceFit) },
    { label: '위험 회피', value: riskAvoidance, stars: stars(riskAvoidance) },
    { label: '공략 적합', value: strategyFit, stars: stars(strategyFit) },
  ]
}

function buildTeeShotMessage(
  recommendation: ClubRecommendation | null,
  risk: RiskAnalysis,
  effectiveDistance: EffectiveDistanceResult,
  guide?: HoleGuideRiskSource | null,
) {
  const clubLabel = recommendation?.clubLabel ?? '가장 자신 있는 클럽'
  const base = `${clubLabel} 기준 유효거리 ${effectiveDistance.effectiveDistanceM}m를 보고 티샷을 설계하세요.`
  const guideText = compactSentence(firstText(guide?.tee_strategy ? textFromUnknown(guide.tee_strategy) : '', guide?.strategy), 110)
  const riskText = risk.signals[0]
    ? `${risk.signals[0].label} 요소가 있어 위험 구역 반대편을 우선 조준하는 것이 좋습니다.`
    : '큰 위험 신호가 낮으므로 페어웨이 중앙을 기준으로 시작해도 좋습니다.'
  return [base, guideText, riskText].filter(Boolean).join(' ')
}

function buildSecondShotMessage(recommendation: ClubRecommendation | null, guide?: HoleGuideRiskSource | null) {
  const shotPlan = compactSentence(guide?.shot_plan ? textFromUnknown(guide.shot_plan) : '', 120)
  if (shotPlan) return shotPlan
  if (!recommendation) return '세컨드 샷은 다음 샷이 편한 거리와 각도를 남기는 선택을 우선하세요.'
  const remain = Math.max(0, Math.round(recommendation.targetDistanceM - recommendation.expectedCarryM))
  if (remain > 0) return `${recommendation.clubLabel} 선택 시 약 ${remain}m가 남을 수 있습니다. 다음 샷 각도가 편한 랜딩 구역을 우선하세요.`
  return `${recommendation.clubLabel}는 목표 거리와 잘 맞습니다. 무리한 핀 공략보다 그린 중앙을 기준으로 안정적으로 접근하세요.`
}

function buildGreenMessage(guide?: HoleGuideRiskSource | null, risk?: RiskAnalysis) {
  const greenText = compactSentence(guide?.green_info ? textFromUnknown(guide.green_info) : '', 120)
  if (greenText) return greenText
  const greenSignal = risk?.signals.find((signal) => signal.key === 'green')
  if (greenSignal) return '그린 경사와 라이 변화가 있을 수 있으므로 핀보다 안전한 중앙 지점을 먼저 확인하세요.'
  return '그린 공략은 핀 위치보다 안전한 중앙 지점을 기준으로 잡으면 스코어 손실을 줄일 수 있습니다.'
}

function buildMainMessage(params: {
  guide?: HoleGuideRiskSource | null
  recommendation: ClubRecommendation | null
  risk: RiskAnalysis
  shotPlan: ShotPlan
  effectiveDistance: EffectiveDistanceResult
}) {
  const clubLabel = params.recommendation?.clubLabel ?? '안전 클럽'
  const guideMessage = compactSentence(firstText(params.guide?.caution, params.guide?.strategy, params.guide?.summary), 90)
  const riskLead = params.risk.level === 'high'
    ? '이 홀은 위험요소가 뚜렷해 안전 공략이 우선입니다.'
    : params.risk.level === 'medium'
      ? '주의 요소를 피하면 충분히 좋은 흐름을 만들 수 있습니다.'
      : '기본 루틴대로 자신 있게 공략할 수 있는 홀입니다.'
  const distanceReason = params.recommendation
    ? `${clubLabel}는 목표 ${params.recommendation.targetDistanceM}m와 ${Math.abs(params.recommendation.gapM)}m 차이로 거리 적합도가 좋습니다.`
    : `유효거리 ${params.effectiveDistance.effectiveDistanceM}m 기준으로 가장 안정적인 클럽을 선택하세요.`

  return [riskLead, distanceReason, guideMessage].filter(Boolean).join(' ')
}

export function createHoleStrategy(
  guide: HoleGuideRiskSource | null | undefined,
  recommendation: ClubRecommendation | null,
  risk: RiskAnalysis,
  shotPlan: ShotPlan,
  effectiveDistance: EffectiveDistanceResult,
): HoleStrategy {
  const mode = modeFrom(risk, recommendation, shotPlan)
  const confidence = confidenceFrom(risk, recommendation)
  const title = recommendation ? `${recommendation.clubLabel} ${mode === 'SAFE' ? '안전 공략' : mode === 'ATTACK' ? '공격 공략' : '균형 공략'}` : 'AI 공략 준비'
  const message = buildMainMessage({ guide, recommendation, risk, shotPlan, effectiveDistance })
  const scores = buildScores({ recommendation, risk, effectiveDistance })
  const sections = [
    { title: '티샷', message: buildTeeShotMessage(recommendation, risk, effectiveDistance, guide) },
    { title: '세컨드', message: buildSecondShotMessage(recommendation, guide) },
    { title: '그린 공략', message: buildGreenMessage(guide, risk) },
  ]
  const bullets = [
    recommendation?.reason,
    risk.summary,
    ...effectiveDistance.notes,
    ...shotPlan.checkpoints.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 5)

  return {
    title,
    message,
    bullets,
    mode,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    scores,
    sections,
    warning: shotPlan.warning ?? risk.signals.find((signal) => signal.level === 'high')?.label,
  }
}
