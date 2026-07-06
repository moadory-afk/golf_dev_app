import type { HoleGuideRiskSource, RiskAnalysis, RiskLevel, RiskSignal } from '../types/caddie'

const RISK_KEYWORDS: Array<{ key: string; label: string; level: RiskLevel; words: string[] }> = [
  { key: 'ob', label: 'OB 주의', level: 'high', words: ['ob', '오비', 'out of bounds'] },
  { key: 'hazard', label: '해저드 주의', level: 'high', words: ['해저드', 'hazard', '워터', 'water'] },
  { key: 'bunker', label: '벙커 주의', level: 'medium', words: ['벙커', 'bunker'] },
  { key: 'dogleg', label: '도그렉', level: 'medium', words: ['도그렉', 'dogleg', '우도그렉', '좌도그렉'] },
  { key: 'narrow', label: '좁은 페어웨이', level: 'medium', words: ['좁', '타이트', 'narrow'] },
  { key: 'slope', label: '고저차', level: 'medium', words: ['오르막', '내리막', '고저차', '업힐', '다운힐'] },
  { key: 'green', label: '그린 난도', level: 'low', words: ['그린', '라이', '경사'] },
]

function stringifyUnknown(value: unknown): string {
  if (value === null || typeof value === 'undefined') return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function collectGuideText(guide?: HoleGuideRiskSource | null) {
  if (!guide) return ''
  return [
    guide.summary,
    guide.strategy,
    guide.caution,
    stringifyUnknown(guide.tee_strategy),
    stringifyUnknown(guide.shot_plan),
    stringifyUnknown(guide.ob_info),
    stringifyUnknown(guide.bunker_info),
    stringifyUnknown(guide.hazard_info),
    stringifyUnknown(guide.green_info),
    stringifyUnknown(guide.course_features),
    stringifyUnknown(guide.difficulty_tags),
    stringifyUnknown(guide.difficulty_factors),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function levelScore(level: RiskLevel) {
  if (level === 'high') return 35
  if (level === 'medium') return 20
  return 10
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 55) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}

export function analyzeHoleRisk(guide?: HoleGuideRiskSource | null): RiskAnalysis {
  const text = collectGuideText(guide)
  const signals: RiskSignal[] = []

  for (const item of RISK_KEYWORDS) {
    const matched = item.words.find((word) => text.includes(word.toLowerCase()))
    if (!matched) continue
    signals.push({
      key: item.key,
      label: item.label,
      level: item.level,
      reason: `${item.label} 요소가 공략 정보에 포함되어 있습니다.`,
    })
  }

  const score = Math.min(100, signals.reduce((sum, signal) => sum + levelScore(signal.level), 0))
  const level = scoreToLevel(score)
  const summary =
    level === 'high'
      ? '리스크가 높은 홀입니다. 방향성과 안전 구간을 우선하세요.'
      : level === 'medium'
        ? '주의 요소가 있습니다. 무리한 공략보다 안정적인 클럽 선택이 좋습니다.'
        : '큰 위험 요소는 낮습니다. 기본 루틴대로 공략하세요.'

  return { level, score, signals, summary }
}
