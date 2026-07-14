import type { HomeUpcomingRound, HomeRecentRound } from '../types/home'
import type { PremiumRecentStatItem } from '../components'

export type HomeFeedEventType =
  | 'round_preparation'
  | 'attendance_request'
  | 'grouping'
  | 'weather_route'
  | 'lotto'
  | 'score_entry'
  | 'round_result'
  | 'round_analysis'
  | 'notice'
  | 'empty'

export type HomeFeedActionType =
  | 'set_attendance'
  | 'open_caddie_map'
  | 'open_groups'
  | 'open_lotto'
  | 'open_score_entry'
  | 'open_result'
  | 'open_notice'
  | 'open_round_info'
  | 'create_round'

export type HomeFeedAction = {
  id: string
  label: string
  actionType: HomeFeedActionType
  attendanceStatus?: '참석' | '불참' | '미정'
}

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
  actions?: HomeFeedAction[]
  tone?: 'green' | 'gold' | 'blue' | 'neutral'
  scheduleId?: string
  courseName?: string
  dday?: string
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

function roundStartTime(round: HomeUpcomingRound) {
  const timeMatch = round.teeTime?.match(/(\d{1,2}):(\d{2})/)
  if (!timeMatch || !round.date) return null
  const target = new Date(`${round.date.slice(0, 10)}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`)
  return Number.isNaN(target.getTime()) ? null : target
}

function aiFeed(
  round: HomeUpcomingRound | null,
  params: Omit<HomeFeedEvent, 'icon' | 'label' | 'title' | 'scheduleId' | 'courseName' | 'dday'> & { icon?: string },
): HomeFeedEvent {
  return {
    icon: params.icon ?? '🏌️',
    label: 'AI 캐디',
    title: '🏌️ AI 캐디',
    scheduleId: round?.id,
    courseName: round?.courseName,
    dday: round?.dday,
    ...params,
  }
}

/**
 * 예정 라운드 한 건에 대한 캐디 메시지를 생성한다.
 * 메시지는 같은 라운드 안에서 우선순위 순으로 스와이프된다.
 */
export function buildRoundFeedEvents(round: HomeUpcomingRound): HomeFeedEvent[] {
  const events: HomeFeedEvent[] = []
  const dday = normalizeDday(round.dday)
  const isToday = dday === 0
  const isSoon = typeof dday === 'number' && dday >= 1 && dday <= 3
  const isTomorrow = dday === 1
  // 조편성 완료 여부는 조/회원 배정 데이터가 아니라
  // 라운드 일정 수정 모달에서 저장한 일정 상태(closed/finished)를 기준으로 판단한다.
  const groupingComplete = round.status === 'closed' || round.status === 'finished'
  const startAt = roundStartTime(round)
  const minutesToStart = startAt ? Math.round((startAt.getTime() - Date.now()) / 60000) : null
  const startsWithinHour = isToday && minutesToStart !== null && minutesToStart >= 0 && minutesToStart <= 60
  const appearsFinished = round.status === 'finished' || (isToday && minutesToStart !== null && minutesToStart < -300)

  if (!groupingComplete && (round.status === 'planned' || round.status === 'recruiting') && round.attendanceStatus === '미정') {
    events.push(aiFeed(round, {
      id: `attendance-${round.id}`,
      type: 'attendance_request',
      priority: 100,
      message: round.status === 'planned'
        ? '새로운 라운드가 등록되었습니다.\n\n참석 여부를 선택해 주세요.'
        : `현재 ${round.memberCount}명이 참가 예정입니다.\n\n참석 여부를 등록해 주세요.`,
      ctaLabel: '참석 여부 선택',
      actionType: 'set_attendance',
      actions: [
        { id: 'attending', label: '참석', actionType: 'set_attendance', attendanceStatus: '참석' },
        { id: 'absent', label: '불참', actionType: 'set_attendance', attendanceStatus: '불참' },
        { id: 'pending', label: '미정', actionType: 'set_attendance', attendanceStatus: '미정' },
      ],
      tone: 'green',
    }))
  }

  if (groupingComplete) {
    const memberLine = round.memberNames?.length
      ? `함께 플레이할 팀원은\n${round.memberNames.slice(0, 4).join(' · ')}입니다.`
      : '함께 플레이할 팀원과\nTee-Off 시간을 확인해 보세요.'
    events.push(aiFeed(round, {
      id: `groups-${round.id}`,
      type: 'grouping',
      priority: 82,
      icon: '👥',
      message: `조편성이 완료되었습니다.\n\n${memberLine}`,
      ctaLabel: '내 조 확인',
      actionType: 'open_groups',
      tone: 'blue',
    }))
  }

  if (!appearsFinished) {
    events.push(aiFeed(round, {
      id: `caddiebook-${round.id}`,
      type: 'round_preparation',
      priority: isToday ? 76 : 70,
      icon: '📖',
      message: '코스 공략이 준비되었습니다.\n\n추천 클럽과 홀별 전략을\n미리 확인해 보세요.',
      ctaLabel: '코스 공략 보기',
      actionType: 'open_caddie_map',
      tone: 'green',
    }))
  }

  if (isSoon && !appearsFinished) {
    events.push(aiFeed(round, {
      id: `weather-${round.id}`,
      type: 'weather_route',
      priority: 64,
      icon: '🌤️',
      message: `${round.weatherText || '예상 날씨를 확인하고 있습니다.'}\n${round.temperature || '--°'}${round.windText ? ` · ${round.windText}` : ''}\n\n복장과 장비를 준비해 주세요.`,
      ctaLabel: '날씨 확인',
      actionType: 'open_round_info',
      tone: 'gold',
    }))
  }

  if (isTomorrow && !appearsFinished) {
    events.push(aiFeed(round, {
      id: `day-before-${round.id}`,
      type: 'round_preparation',
      priority: 68,
      icon: '🌙',
      message: '내일은 라운드입니다.\n\n클럽과 골프화, 장갑 등\n준비물을 다시 확인해 보세요.',
      ctaLabel: '라운드 정보 확인',
      actionType: 'open_round_info',
      tone: 'neutral',
    }))
  }

  if ((isSoon || isToday) && !appearsFinished && round.routeTimeText && !round.routeTimeText.includes('준비중')) {
    const departureLine = round.departureTimeText && !round.departureTimeText.includes('준비중')
      ? `\n추천 출발 시간은 ${round.departureTimeText.replace(/^출발 추천\s*/, '')}입니다.`
      : ''
    events.push(aiFeed(round, {
      id: `route-${round.id}`,
      type: 'weather_route',
      priority: isToday ? 72 : 58,
      icon: '🚗',
      message: `현재 예상 이동시간은 ${round.routeTimeText.replace(/\s*소요$/, '')}입니다.${departureLine}\n\n여유 있게 출발해 주세요.`,
      ctaLabel: '이동시간 확인',
      actionType: 'open_round_info',
      tone: 'blue',
    }))
  }

  if (isToday && !appearsFinished) {
    events.push(aiFeed(round, {
      id: `lotto-purchase-${round.id}`,
      type: 'lotto',
      priority: startsWithinHour ? 88 : 74,
      icon: '🎲',
      message: '오늘의 라운드 로또에\n아직 참여하지 않았다면\n시작 전에 구매해 보세요.',
      ctaLabel: '로또 구매',
      actionType: 'open_lotto',
      tone: 'gold',
    }))
  }

  if (startsWithinHour) {
    events.push(aiFeed(round, {
      id: `play-caddiebook-${round.id}`,
      type: 'score_entry',
      priority: 92,
      icon: '⛳',
      message: '곧 라운드가 시작됩니다.\n\n캐디북을 열어 공략을 확인하고\n드라이버와 퍼팅 기록을 입력해 주세요.',
      ctaLabel: '캐디북',
      actionType: 'open_caddie_map',
      tone: 'green',
    }))
  }

  return events.sort((a, b) => b.priority - a.priority)
}

/** 기존 단일 라운드 호출부 호환용 */
export function buildHomeFeedEvents({ upcomingRound, recentRounds }: BuildHomeFeedInput): HomeFeedEvent[] {
  if (upcomingRound) return buildRoundFeedEvents(upcomingRound)

  return [aiFeed(null, {
    id: 'empty-home-feed',
    type: 'empty',
    priority: 10,
    icon: '⛳',
    message: '예정된 라운드가 없습니다.\n\n새로운 라운드를 등록하거나\n일정을 확인해 보세요.',
    ctaLabel: '라운드 등록',
    actionType: 'create_round',
    tone: 'green',
  })]
}

export function selectPrimaryHomeFeedEvent(events: HomeFeedEvent[]) {
  return events[0]
}
