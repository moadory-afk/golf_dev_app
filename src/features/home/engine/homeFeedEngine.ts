import type { HomeUpcomingRound, HomeRecentRound } from '../types/home'
import type { PremiumRecentStatItem } from '../components'

export type HomeFeedEventType =
  | 'round_preparation'
  | 'attendance'
  | 'attendance_request'
  | 'lotto'
  | 'round_result'
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

export function buildHomeFeedEvents({ upcomingRound, recentRounds, stats }: BuildHomeFeedInput): HomeFeedEvent[] {
  const events: HomeFeedEvent[] = []

  if (upcomingRound) {
    const dday = normalizeDday(upcomingRound.dday)
    const isToday = dday === 0
    const isSoon = typeof dday === 'number' && dday <= 1

    events.push({
      id: `round-${upcomingRound.id}`,
      type: 'round_preparation',
      priority: isToday ? 120 : isSoon ? 110 : 96,
      icon: isToday ? '🏌️' : '📍',
      label: isToday ? '오늘의 라운드' : '라운드 준비',
      title: isToday ? '오늘 라운드가 준비됐어요' : `${upcomingRound.dday} 라운드가 다가와요`,
      message: `${upcomingRound.dday} 캐디북을 미리 확인해 보세요.`,
      ctaLabel: isToday ? '캐디맵 열기' : '사전 공략 보기',
      actionType: 'open_caddie_map',
      tone: 'green',
    })

    events.push({
      id: `attendance-request-${upcomingRound.id}`,
      type: 'attendance_request',
      priority: isToday ? 98 : 86,
      icon: '📍',
      label: '참석 확인',
      title: '라운드 참석을 확인해 주세요',
      message: '참석 여부를 알려주세요.',
      ctaLabel: '참석 확인',
      actionType: 'open_groups',
      tone: 'green',
    })

    if (upcomingRound.memberCount > 0) {
      events.push({
        id: `groups-${upcomingRound.id}`,
        type: 'attendance',
        priority: isToday ? 95 : 82,
        icon: '👥',
        label: '조편성',
        title: `${upcomingRound.memberCount}명이 함께해요`,
        message: '조편성이 완료되었어요.',
        ctaLabel: '조편성 보기',
        actionType: 'open_groups',
        tone: 'blue',
      })
    }

    events.push({
      id: `lotto-${upcomingRound.id}`,
      type: 'lotto',
      priority: isToday ? 88 : 76,
      icon: '🎱',
      label: 'Lotto 6/18',
      title: '오늘의 행운을 준비해볼까요?',
      message: 'Lotto 6/18 구매와 결과를 홈에서 빠르게 확인할 수 있어요.',
      ctaLabel: '로또 구매',
      actionType: 'open_lotto',
      tone: 'gold',
    })
  }

  const [recentRound] = recentRounds
  if (recentRound) {
    events.push({
      id: `result-${recentRound.id}`,
      type: 'round_result',
      priority: upcomingRound ? 62 : 92,
      icon: '🏆',
      label: '경기 결과',
      title: '지난 라운드 기록을 확인해보세요',
      message: `${recentRound.courseName} · ${recentRound.total ?? '-'} 스코어 흐름을 정리했어요.`,
      ctaLabel: '결과 보기',
      actionType: 'open_result',
      tone: 'gold',
    })
  }

  const bestScore = findStat(stats, 'best')
  if (bestScore && bestScore !== '-') {
    events.push({
      id: 'memory-best-score',
      type: 'memory',
      priority: upcomingRound ? 42 : 74,
      icon: '📸',
      label: 'GOGO의 추억',
      title: '좋았던 라운드를 기억하고 있어요',
      message: `지금까지의 베스트 스코어는 ${bestScore}. 다음 라운드도 GOGO가 함께할게요.`,
      ctaLabel: '기록 보기',
      actionType: 'open_result',
      tone: 'neutral',
    })
  }

  if (events.length === 0) {
    events.push({
      id: 'empty-home-feed',
      type: 'empty',
      priority: 10,
      icon: '⛳',
      label: '오늘의 GOGO',
      title: '다음 골프 이야기를 준비해볼까요?',
      message: '라운드를 등록하면 참석, Lotto, 결과와 추억을 홈에서 알려드릴게요.',
      ctaLabel: '라운드 등록',
      actionType: 'create_round',
      tone: 'green',
    })
  }

  return events.sort((a, b) => b.priority - a.priority)
}

export function selectPrimaryHomeFeedEvent(events: HomeFeedEvent[]) {
  return events[0]
}
