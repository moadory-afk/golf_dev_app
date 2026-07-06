import type { ClubRecommendation, RiskAnalysis, ShotIntent, ShotPlan } from '../types/caddie'

function chooseIntent(risk: RiskAnalysis, recommendation: ClubRecommendation | null): ShotIntent {
  if (risk.level === 'high') return 'safe'
  if (!recommendation) return 'safe'
  if (recommendation.confidence < 62) return 'layup'
  return 'attack'
}

export function createShotPlan(risk: RiskAnalysis, recommendation: ClubRecommendation | null): ShotPlan {
  const intent = chooseIntent(risk, recommendation)
  const clubLabel = recommendation?.clubLabel ?? '안전한 클럽'

  if (intent === 'safe') {
    return {
      intent,
      headline: '안전 공략 추천',
      primaryAction: `${clubLabel}로 페어웨이 중앙을 우선 공략하세요.`,
      checkpoints: ['방향성 우선', '위험 구역 반대편 조준', '무리한 비거리 욕심 금지'],
      warning: risk.signals[0]?.label,
    }
  }

  if (intent === 'layup') {
    return {
      intent,
      headline: '레이업 추천',
      primaryAction: `${clubLabel}로 다음 샷이 편한 거리를 남기세요.`,
      checkpoints: ['가장 넓은 랜딩 지점 확인', '핀보다 다음 샷 각도 우선', '짧아도 안전한 선택'],
      warning: '추천 신뢰도가 높지 않습니다.',
    }
  }

  return {
    intent,
    headline: '그린 공략 가능',
    primaryAction: `${clubLabel}로 목표 지점을 직접 공략할 수 있습니다.`,
    checkpoints: ['스윙 템포 유지', '핀 위치보다 안전한 중앙 우선', '미스 방향을 먼저 정하기'],
  }
}
