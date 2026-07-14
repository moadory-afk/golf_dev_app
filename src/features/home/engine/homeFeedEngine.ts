import type { HomeUpcomingRound, HomeRecentRound } from '../types/home'
import type { PremiumRecentStatItem } from '../components'

export type HomeFeedEventType =
  | 'round_preparation' | 'attendance_request' | 'grouping' | 'weather_route'
  | 'award' | 'lotto' | 'score_entry' | 'round_result' | 'round_analysis'
  | 'notice' | 'empty'

export type HomeFeedActionType =
  | 'set_attendance' | 'open_attendance' | 'open_caddie_map' | 'open_groups'
  | 'open_award' | 'open_lotto' | 'open_score_entry' | 'open_result'
  | 'open_analysis' | 'open_notice' | 'open_round_info' | 'create_round'

export type HomeFeedAction = {
  id: string
  label: string
  actionType: HomeFeedActionType
  attendanceStatus?: '참석' | '불참' | '미정'
  selected?: boolean
  secondary?: boolean
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

type BuildHomeFeedInput = { upcomingRound: HomeUpcomingRound | null; recentRounds: HomeRecentRound[]; stats: PremiumRecentStatItem[] }

function normalizeDday(dday?: string) {
  if (!dday) return null
  if (dday === 'D-DAY') return 0
  const match = dday.match(/^D-([0-9]+)$/)
  return match ? Number(match[1]) : null
}

function roundStartTime(round: HomeUpcomingRound) {
  const timeMatch = round.teeTime?.match(/(\d{1,2}):(\d{2})/)
  if (!timeMatch || !round.date) return null
  const target = new Date(`${round.date.slice(0, 10)}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`)
  return Number.isNaN(target.getTime()) ? null : target
}

function aiFeed(round: HomeUpcomingRound | null, params: Omit<HomeFeedEvent, 'icon' | 'label' | 'title' | 'scheduleId' | 'courseName' | 'dday'> & { icon?: string }): HomeFeedEvent {
  return { icon: params.icon ?? '🏌️', label: 'AI 캐디', title: '🏌️ AI 캐디', scheduleId: round?.id, courseName: round?.courseName, dday: round?.dday, ...params }
}

/** 13단계 캐디 시스템: 조건에 맞는 카드만 생성하고 우선순위 순으로 스와이프한다. */
export function buildRoundFeedEvents(round: HomeUpcomingRound, recentRounds: HomeRecentRound[] = []): HomeFeedEvent[] {
  const events: HomeFeedEvent[] = []
  const dday = normalizeDday(round.dday)
  const isToday = dday === 0
  const isTomorrow = dday === 1
  const isSoon = typeof dday === 'number' && dday >= 1 && dday <= 3
  const groupingComplete = round.status === 'closed' || round.status === 'finished'
  const startAt = roundStartTime(round)
  const minutesToStart = startAt ? Math.round((startAt.getTime() - Date.now()) / 60000) : null
  const withinOneHour = isToday && minutesToStart !== null && minutesToStart >= 0 && minutesToStart <= 60
  const lottoReminderWindow = withinOneHour && minutesToStart! >= 30
  const lottoSaleOpen = (isTomorrow || isToday) && (minutesToStart === null || minutesToStart >= 30)
  const appearsFinished = round.status === 'finished' || round.resultSaved || (isToday && minutesToStart !== null && minutesToStart < -300)
  const courseRegistered = !!round.courseId && !!round.layoutId

  // 2. 참석/불참/미정 토글 + 참가자 현황 버튼 (조편성 완료 전까지 수정 가능)
  if (!groupingComplete && !appearsFinished) {
    const current = round.attendanceStatus ?? '미정'
    events.push(aiFeed(round, {
      id: `stage-02-attendance-${round.id}`,
      type: 'attendance_request', priority: 100,
      message: `현재 참석 ${round.memberCount}명입니다.\n\n참석 여부를 선택하고\n참가자 현황도 확인해 보세요.`,
      ctaLabel: '참가자 현황', actionType: 'open_attendance', tone: 'green',
      actions: [
        {
          id: 'attendance-toggle',
          label: `참석여부 : ${current}`,
          actionType: 'set_attendance',
          attendanceStatus: current === '참석' ? '불참' : current === '불참' ? '미정' : '참석',
          selected: current === '참석',
        },
        { id: 'attendance-overview', label: '참가자 현황', actionType: 'open_attendance', secondary: true },
      ],
    }))
  }

  // 3. 조편성 완료
  if (groupingComplete && !appearsFinished) {
    events.push(aiFeed(round, {
      id: `stage-03-groups-${round.id}`, type: 'grouping', priority: 88, icon: '👥',
      message: '조편성이 완료되었습니다.\n\n함께 플레이할 멤버와\n출발 조를 확인해 보세요.',
      ctaLabel: '조편성 보기', actionType: 'open_groups', tone: 'blue',
    }))
  }

  // 4. 코스 등록 완료 시 캐디북
  if (courseRegistered && !appearsFinished) {
    events.push(aiFeed(round, {
      id: `stage-04-caddiebook-${round.id}`, type: 'round_preparation', priority: 72, icon: '📖',
      message: '똥꾸 캐디가 준비한 캐디북을 확인해 보세요.\n\n홀별 추천 클럽과 공략 전략을\n미리 확인할 수 있어요.',
      ctaLabel: '캐디북 보기', actionType: 'open_caddie_map', tone: 'green',
    }))
  }

  // 5. 라운딩 전날 시상계획
  if (isTomorrow && round.awardPlanReady && !appearsFinished) {
    events.push(aiFeed(round, {
      id: `stage-05-award-${round.id}`, type: 'award', priority: 84, icon: '🏆',
      message: '내일 라운드의 시상계획이 준비되었습니다.\n\n시상 항목과 선정 기준을\n확인해 보세요.',
      ctaLabel: '시상계획 보기', actionType: 'open_award', tone: 'gold',
    }))
  }

  // 6. 로또 구매 전/후 통합 카드
  if (lottoSaleOpen && groupingComplete && round.attendanceStatus === '참석' && !appearsFinished) {
    events.push(aiFeed(round, {
      id: `stage-06-lotto-${round.id}-${round.lottoPurchased ? 'purchased' : 'open'}`,
      type: 'lotto', priority: round.lottoPurchased ? 63 : 78, icon: '🎲',
      message: round.lottoPurchased
        ? '로또 구매가 완료되었습니다.\n\n라운드 결과와 추첨 결과를\n기대해 주세요.'
        : 'Lotto 6/18 번호를 선택하고\n\n행운에 도전해 보세요.',
      ctaLabel: round.lottoPurchased ? '구매 번호 보기' : '로또 구매', actionType: 'open_lotto', tone: 'gold',
    }))
  }

  // 7. 티오프 1시간 전부터 30분 전까지 미구매 재안내
  if (lottoReminderWindow && groupingComplete && round.attendanceStatus === '참석' && !round.lottoPurchased && !appearsFinished) {
    events.push(aiFeed(round, {
      id: `stage-07-lotto-reminder-${round.id}`, type: 'lotto', priority: 96, icon: '⏰',
      message: '아직 Lotto 6/18을 구매하지 않았습니다.\n\n라운드 시작 30분 전까지\n번호를 선택해 주세요.',
      ctaLabel: '지금 구매', actionType: 'open_lotto', tone: 'gold',
    }))
  }

  // 8. 시작 1시간 전부터 기록 안내
  if (withinOneHour && !appearsFinished) {
    events.push(aiFeed(round, {
      id: `stage-08-play-${round.id}`, type: 'score_entry', priority: 92, icon: '⛳',
      message: '오늘의 라운드를 즐겨보세요.\n\n드라이버 거리와 퍼팅 수를 입력하면\n더욱 상세한 스코어 분석을 할 수 있어요.',
      ctaLabel: '캐디북 보기', actionType: 'open_caddie_map', tone: 'green',
    }))
  }

  // 9. 결과 저장 완료
  if (round.resultSaved) {
    events.push(aiFeed(round, {
      id: `stage-09-result-${round.id}-${round.resultComplete ? 'complete' : 'saved'}`,
      type: 'round_result', priority: 90, icon: '✅',
      message: '라운드 결과가 저장되었습니다.\n\n기록과 시상 결과를\n확인해 보세요.',
      ctaLabel: '라운드 결과 보기', actionType: 'open_result', tone: 'blue',
    }))
  }

  // 10. 기록 갱신 안내 (완료된 결과가 있을 때 확인 진입 제공)
  if (round.resultComplete) {
    events.push(aiFeed(round, {
      id: `stage-10-record-${round.id}`, type: 'round_result', priority: 86, icon: '🏅',
      message: '새로운 기록이 반영되었습니다.\n\n갱신된 개인·클럽 기록을\n확인해 보세요.',
      ctaLabel: '기네스북 보기', actionType: 'open_result', tone: 'gold',
    }))
  }

  // 11. 로또 추첨자 선정
  if (round.isLottoDrafter && round.lottoDrawStatus === 'PENDING') {
    events.push(aiFeed(round, {
      id: `stage-11-drafter-${round.id}`, type: 'lotto', priority: 98, icon: '🎯',
      message: '로또 추첨자로 선정되었습니다.\n\n추첨 버튼을 눌러\nLotto 6/18 결과를 확정해 주세요.',
      ctaLabel: '로또 추첨', actionType: 'open_lotto', tone: 'gold',
    }))
  }

  // 12. 로또 추첨 완료
  if (round.lottoDrawStatus === 'COMPLETED') {
    events.push(aiFeed(round, {
      id: `stage-12-draw-complete-${round.id}`, type: 'lotto', priority: 94, icon: '🎉',
      message: 'Lotto 6/18 추첨이 완료되었습니다.\n\n스크래치 카드를 긁어\n결과를 직접 확인해 보세요.',
      ctaLabel: '결과 확인', actionType: 'open_lotto', tone: 'gold',
    }))
  }

  // 13. 라운드 종료 다음 날 분석 카드
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)
  const analyzedRound = recentRounds.find((item) => item.date?.slice(0, 10) === yesterdayKey && item.total !== null)
  if (analyzedRound) {
    events.push(aiFeed(round, {
      id: `stage-13-analysis-${analyzedRound.id}`, type: 'round_analysis', priority: 80, icon: '📊',
      message: '똥꾸 캐디가 어제 라운드를 분석했습니다.\n\n잘된 점과 다음 라운드에서\n보완할 점을 확인해 보세요.',
      ctaLabel: '라운드 분석 보기', actionType: 'open_analysis', tone: 'blue',
    }))
  }

  // 일반 준비 보조 카드
  if (isSoon && !appearsFinished) {
    events.push(aiFeed(round, {
      id: `weather-${round.id}`, type: 'weather_route', priority: 55, icon: '🌤️',
      message: `${round.weatherText || '예상 날씨를 확인하고 있습니다.'}\n${round.temperature || '--°'}${round.windText ? ` · ${round.windText}` : ''}\n\n복장과 출발시간을 확인해 주세요.`,
      ctaLabel: '라운드 정보', actionType: 'open_round_info', tone: 'neutral',
    }))
  }

  return events.sort((a, b) => b.priority - a.priority)
}

export function buildHomeFeedEvents({ upcomingRound, recentRounds }: BuildHomeFeedInput): HomeFeedEvent[] {
  if (upcomingRound) return buildRoundFeedEvents(upcomingRound, recentRounds)
  return [aiFeed(null, {
    id: 'stage-01-empty-home-feed', type: 'empty', priority: 10, icon: '⛳',
    message: '예정된 라운드가 없습니다.\n\n새로운 라운드를 등록하거나\n일정을 확인해 보세요.',
    ctaLabel: '라운드 등록', actionType: 'create_round', tone: 'green',
  })]
}

export function selectPrimaryHomeFeedEvent(events: HomeFeedEvent[]) { return events[0] }
