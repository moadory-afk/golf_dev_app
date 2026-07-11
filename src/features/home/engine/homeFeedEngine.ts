import type { HomeUpcomingRound, HomeRecentRound } from '../types/home'
import type { PremiumRecentStatItem } from '../components'

export type HomeFeedEventType =
  | 'round_preparation'
  | 'attendance'
  | 'attendance_request'
  | 'grouping'
  | 'weather_route'
  | 'ai_caddiebook'
  | 'lotto'
  | 'round_result'
  | 'round_analysis'
  | 'memory'
  | 'notice'
  | 'empty'

export type HomeFeedActionType =
  | 'open_caddie_map'
  | 'open_groups'
  | 'open_lotto'
  | 'open_result'
  | 'open_notice'
  | 'create_round'

export type HomeFeedEvent = {
  id: string
  type: HomeFeedEventType
  priority: number
  icon: string
  label: string
  title: string
  message: string
  ctaLabel: string
  actionType: HomeFeedActionType
  tone?: 'green' | 'gold' | 'blue' | 'neutral'
}

type BuildHomeFeedInput = {
  upcomingRound: HomeUpcomingRound | null
  recentRounds: HomeRecentRound[]
  stats: PremiumRecentStatItem[]
}

function normalizeDday(dday?: string) {
  if (!dday) return null
  if (dday === 'D-DAY') return 0
  const match = dday.match(/^D-([0-9]+)$/)
  if (match) return Number(match[1])
  return null
}

function findStat(stats: PremiumRecentStatItem[], key: string) {
  return stats.find((item) => item.key === key)?.value
}

function aiFeed(params: Omit<HomeFeedEvent, 'icon' | 'label' | 'title'> & { icon?: string }): HomeFeedEvent {
  return {
    icon: params.icon ?? '🏌️',
    label: 'AI 캐디',
    title: '🏌️ AI 캐디',
    ...params,
  }
}

export function buildHomeFeedEvents({ upcomingRound, recentRounds, stats }: BuildHomeFeedInput): HomeFeedEvent[] {
  const events: HomeFeedEvent[] = []

  if (upcomingRound) {
    const dday = normalizeDday(upcomingRound.dday)
    const isToday = dday === 0
    const isSoon = typeof dday === 'number' && dday >= 1 && dday <= 3
    const hasGroups = upcomingRound.groupCount > 0

    if (upcomingRound.status === 'planned') {
      events.push(aiFeed({
        id: `round-registered-${upcomingRound.id}`,
        type: 'attendance_request',
        priority: 130,
        message: '새로운 라운드가 등록되었습니다.\n\n참석 여부를 선택해 주세요.',
        ctaLabel: '참석 등록',
        actionType: 'open_groups',
        tone: 'green',
      }))
    }

    if (upcomingRound.status === 'recruiting') {
      events.push(aiFeed({
        id: `attendance-${upcomingRound.id}`,
        type: 'attendance_request',
        priority: 128,
        message: `현재 참석\n\n${upcomingRound.memberCount}명\n\n참석 여부를 등록해 주세요.`,
        ctaLabel: '참석 등록',
        actionType: 'open_groups',
        tone: 'green',
      }))
    }

    if (upcomingRound.status === 'closed' && !hasGroups) {
      events.push(aiFeed({
        id: `attendance-closed-${upcomingRound.id}`,
        type: 'grouping',
        priority: 126,
        message: '참석 접수가 완료되었습니다.\n\n조편성을 진행해 주세요.',
        ctaLabel: '조편성',
        actionType: 'open_groups',
        tone: 'blue',
      }))
    }

    if (hasGroups) {
      events.push(aiFeed({
        id: `groups-${upcomingRound.id}`,
        type: 'attendance',
        priority: 124,
        icon: '👥',
        message: '조편성이 완료되었습니다.\n\n같은 조를 확인하고\n캐디북을 미리 살펴보세요.',
        ctaLabel: '조편성 보기',
        actionType: 'open_groups',
        tone: 'blue',
      }))
    }

    events.push(aiFeed({
      id: `round-${upcomingRound.id}`,
      type: 'round_preparation',
      priority: isToday ? 122 : isSoon ? 118 : 90,
      icon: isToday ? '🏌️' : '📍',
      message: isToday
        ? '오늘 라운드가 준비됐어요.\n\nAI 공략을 확인해 보세요.'
        : `${upcomingRound.dday} 캐디북을 미리 확인해 보세요.`,
      ctaLabel: 'AI 캐디북',
      actionType: 'open_caddie_map',
      tone: 'green',
    }))

    if (isSoon) {
      events.push(aiFeed({
        id: `weather-route-${upcomingRound.id}`,
        type: 'weather_route',
        priority: 112,
        icon: '🌤️',
        message: `라운드까지 ${dday}일 남았습니다.\n\n날씨와 이동시간을\n미리 확인하세요.`,
        ctaLabel: '날씨·길찾기',
        actionType: 'open_caddie_map',
        tone: 'gold',
      }))
    }

    events.push(aiFeed({
      id: `lotto-${upcomingRound.id}`,
      type: 'lotto',
      priority: isToday ? 88 : 76,
      icon: '🎱',
      message: 'Lotto 6/18 구매가 가능합니다.\n\n행운에도 도전해 보세요.',
      ctaLabel: '번호 선택',
      actionType: 'open_lotto',
      tone: 'gold',
    }))
  }

  const [recentRound] = recentRounds
  if (recentRound) {
    events.push(aiFeed({
      id: `result-${recentRound.id}`,
      type: 'round_result',
      priority: upcomingRound ? 62 : 92,
      icon: '🏆',
      message: '라운드가 종료되었습니다.\n\n결과를 등록하면\n순위와 시상이 계산됩니다.',
      ctaLabel: '결과 보기',
      actionType: 'open_result',
      tone: 'gold',
    }))

    events.push(aiFeed({
      id: `analysis-${recentRound.id}`,
      type: 'round_analysis',
      priority: upcomingRound ? 40 : 70,
      icon: '📊',
      message: '이번 라운드 분석이\n완료되었습니다.\n\n다음 라운드를 위한\n개선 포인트를 확인하세요.',
      ctaLabel: 'AI 분석',
      actionType: 'open_result',
      tone: 'neutral',
    }))
  }

  const bestScore = findStat(stats, 'best')
  if (bestScore && bestScore !== '-') {
    events.push(aiFeed({
      id: 'memory-best-score',
      type: 'memory',
      priority: upcomingRound ? 42 : 74,
      icon: '📸',
      message: `다음 라운드를 준비해 볼까요?\n\n퍼팅 연습을 추천합니다.`,
      ctaLabel: '훈련 보기',
      actionType: 'open_result',
      tone: 'neutral',
    }))
  }

  if (events.length === 0) {
    events.push(aiFeed({
      id: 'empty-home-feed',
      type: 'empty',
      priority: 10,
      icon: '⛳',
      message: '예정된 라운드가 없습니다.\n\n새로운 라운드를 등록하거나\n참가해 보세요.',
      ctaLabel: '라운드 등록',
      actionType: 'create_round',
      tone: 'green',
    }))
  }

  return events.sort((a, b) => b.priority - a.priority)
}

export function selectPrimaryHomeFeedEvent(events: HomeFeedEvent[]) {
  return events[0]
}
