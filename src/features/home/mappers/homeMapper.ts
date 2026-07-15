import { computeHandicaps, playerTotal, totalPar, type SavedRound } from '../../../lib/store'
import type { PremiumRecentStatItem } from '../components'
import type { HomeCourseRow, HomeDashboardRawData, HomeLayoutRow, HomeScheduleGroupMemberRow, HomeScheduleGroupRow, HomeScheduleRow } from '../api/homeRepository'
import { buildHomeFeedEvents, buildRoundFeedEvents, selectPrimaryHomeFeedEvent } from '../engine'
import type { HomeDashboard, HomeHeroRound, HomeRecentRound, HomeRoundStatus, HomeUpcomingRound } from '../types/home'


function normalizeHomeDashboardRawData(raw: HomeDashboardRawData): HomeDashboardRawData {
  return {
    ...raw,
    schedules: Array.isArray(raw.schedules) ? raw.schedules : [],
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    members: Array.isArray(raw.members) ? raw.members : [],
    courses: Array.isArray(raw.courses) ? raw.courses : [],
    layouts: Array.isArray(raw.layouts) ? raw.layouts : [],
    courseSeasonImages: Array.isArray(raw.courseSeasonImages) ? raw.courseSeasonImages : [],
    attendances: Array.isArray(raw.attendances) ? raw.attendances : [],
    rounds: Array.isArray(raw.rounds) ? raw.rounds : [],
    weatherByScheduleId: raw.weatherByScheduleId ?? {},
    weatherByCourseId: raw.weatherByCourseId ?? {},
  }
}

function formatRoundDate(date?: string) {
  if (!date) return '일정 미정'
  const normalized = date.includes('T') ? date.slice(0, 10) : date
  const target = new Date(normalized)
  if (Number.isNaN(target.getTime())) return normalized
  return target.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function formatDday(date?: string) {
  if (!date || date.length < 10) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date.slice(0, 10))
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'D-DAY'
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`
}

function statusLabel(status?: HomeRoundStatus | null) {
  if (status === 'recruiting') return '모집중'
  if (status === 'closed') return '마감'
  if (status === 'finished') return '완료'
  return '예정'
}

function ddayNumber(date?: string) {
  if (!date || date.length < 10) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date.slice(0, 10))
  target.setHours(0, 0, 0, 0)
  if (Number.isNaN(target.getTime())) return null
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function urgencyTone(date?: string): HomeHeroRound['urgencyTone'] {
  const diff = ddayNumber(date)
  if (diff === null) return 'calm'
  if (diff <= 0) return 'today'
  if (diff <= 1) return 'urgent'
  if (diff <= 3) return 'soon'
  return 'calm'
}

function seasonForDate(date?: string): 'spring' | 'summer' | 'autumn' | 'winter' {
  const month = Number(date?.slice(5, 7))
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function resolveHeroImageUrl(raw: HomeDashboardRawData, course?: HomeCourseRow, date?: string) {
  if (!course?.id) return course?.hero_image_url ?? null

  const season = seasonForDate(date)
  const seasonImage = raw.courseSeasonImages.find((item) =>
    item.golf_course_id === course.id && item.season === season && item.image_url
  )

  return seasonImage?.image_url ?? course.hero_image_url ?? null
}

function routeTimeText() {
  return '이동시간 준비중'
}

function departureTimeText() {
  return '출발 추천 준비중'
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function scoreDisplay(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '-'
  return `${Math.ceil(value)}`
}

function statText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '-'
  return `${Math.ceil(value)}`
}

function handicapDisplay(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '-'
  const rounded = Math.ceil(value)
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

function normalizePlayerName(name?: string | null) {
  return (name ?? '').trim().replace(/\s+/g, '').toLowerCase()
}

function decodeGogoParEmailName(value?: string | null) {
  const email = (value ?? '').trim()
  const match = email.match(/^([0-9a-f]{4,})@gogopar\.app$/i)
  if (!match) return ''
  const hex = match[1]
  try {
    const chars: string[] = []
    for (let i = 0; i < hex.length; i += 4) {
      const code = Number.parseInt(hex.slice(i, i + 4), 16)
      if (!Number.isFinite(code)) return ''
      chars.push(String.fromCharCode(code))
    }
    return chars.join('').trim()
  } catch {
    return ''
  }
}

function roundTotalForUser(round: SavedRound, userName?: string | null) {
  const candidates = [userName, decodeGogoParEmailName(userName)]
    .filter((value): value is string => !!value?.trim())

  for (const candidate of candidates) {
    const exact = round.players.find((item) => item.name === candidate)
    if (exact) return playerTotal(exact.strokes)

    const normalized = normalizePlayerName(candidate)
    const normalizedMatch = round.players.find((item) => normalizePlayerName(item.name) === normalized)
    if (normalizedMatch) return playerTotal(normalizedMatch.strokes)
  }

  // 사용자와 일치하지 않는 다른 플레이어 기록을 개인 기록으로 표시하지 않는다.
  return null
}

function currentMonthRoundCount(rounds: SavedRound[]) {
  const now = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return rounds.filter((round) => round.date?.startsWith(prefix)).length
}

function recentTrendFromScores(scores: number[]): PremiumRecentStatItem['trend'] {
  if (scores.length < 2) return ['flat', 'flat', 'flat', 'flat', 'flat']
  return scores.slice(0, 5).map((score, index, list) => {
    const next = list[index + 1]
    if (typeof next !== 'number') return 'flat'
    if (score < next) return 'up'
    if (score > next) return 'down'
    return 'flat'
  })
}

function firstTeeTime(schedule: HomeScheduleRow, groups: HomeScheduleGroupRow[]) {
  const groupTime = groups.map((group) => group.tee_time?.trim()).find(Boolean)
  return groupTime ?? schedule.tee_time?.trim() ?? '시간 미정'
}

function resolveCourseName(schedule: HomeScheduleRow, course?: HomeCourseRow) {
  // Home Hero는 실제 DB에 저장된 golf_courses 값을 우선 표시한다.
  // schedule.course_name은 과거 입력/캐시값이므로 course_id 조회가 실패할 때만 fallback으로 사용한다.
  return course?.name || schedule.course_name?.trim() || '다음 라운드'
}

function resolveLayoutName(schedule: HomeScheduleRow, layout?: HomeLayoutRow) {
  // 코스 정보도 실제 course_layouts 값을 우선 표시한다.
  return layout?.name || schedule.layout_name?.trim() || undefined
}

function resolveCourseLine(groups: HomeScheduleGroupRow[], fallbackLayoutName?: string) {
  const names = groups
    .flatMap((group) => [group.front_layout_name, group.back_layout_name])
    .map((name) => name?.trim())
    .filter((name): name is string => !!name)

  const extraName = fallbackLayoutName?.trim()
  if (extraName && !names.includes(extraName)) names.push(extraName)

  const uniqueNames = Array.from(new Set(names))
  if (uniqueNames.length > 0) return `${uniqueNames.join(' / ')} 코스`
  return fallbackLayoutName ? `${fallbackLayoutName} 코스` : '코스 미정'
}

function countMembers(groups: HomeScheduleGroupRow[], members: HomeScheduleGroupMemberRow[]) {
  if (members.length > 0) return members.length
  return 0
}

function sameGroupMemberNames(groups: HomeScheduleGroupRow[], members: HomeScheduleGroupMemberRow[], userId?: string | null) {
  if (members.length === 0) return []

  const myMember = userId
    ? members.find((member) => member.member_user_id === userId)
    : undefined

  const targetGroupId = myMember?.group_id ?? groups[0]?.id
  if (!targetGroupId) return members.map((member) => member.member_name).filter(Boolean)

  return members
    .filter((member) => member.group_id === targetGroupId)
    .map((member) => member.member_name)
    .filter(Boolean)
}

function mapScheduleRound(raw: HomeDashboardRawData, schedule: HomeScheduleRow, userId?: string | null): HomeHeroRound {
  const groups = raw.groups.filter((group) => group.schedule_id === schedule.id)
  const members = raw.members.filter((member) => member.schedule_id === schedule.id)
  const course = raw.courses.find((item) => item.id === schedule.course_id)
  const layout = raw.layouts.find((item) => item.id === schedule.layout_id)
  const courseName = resolveCourseName(schedule, course)
  const layoutName = resolveLayoutName(schedule, layout)
  const courseLine = resolveCourseLine(groups, layoutName)
  const teeTime = firstTeeTime(schedule, groups)
  const locationParts = [course?.region, layoutName ? `${layoutName} 코스` : undefined].filter(Boolean)

  const weather = raw.weatherByScheduleId[schedule.id] ?? (course?.id ? raw.weatherByCourseId[course.id] : undefined)
  const scheduleAttendances = raw.attendances.filter((item) => item.scheduleId === schedule.id)
  const assignedParticipant = !!raw.currentUserId && members.some((member) => member.member_user_id === raw.currentUserId)
  const savedAttendanceStatus = scheduleAttendances.find((item) => item.userId === raw.currentUserId)?.status
  // 조편성에 실제 배정된 회원은 별도 참석 응답이 누락되어도 참가자로 판단한다.
  const attendanceStatus = savedAttendanceStatus ?? (assignedParticipant ? "참석" : "미정")
  const attendingIds = scheduleAttendances
    .filter((item) => item.status === "참석")
    .map((item) => item.userId)
    .filter(Boolean)
  const assignedIds = members
    .map((member) => member.member_user_id || member.member_name)
    .filter(Boolean)
  const attendingCount = new Set([...attendingIds, ...assignedIds]).size
  const assignedCount = countMembers(groups, members)
  const groupingComplete = schedule.status === 'closed' || schedule.status === 'finished'
  // 기본 layout_id가 비어 있어도 조별 전반/후반 코스가 저장되어 있으면 코스 등록 완료로 본다.
  const hasGroupLayout = groups.some((group) =>
    !!group.front_layout_name?.trim() || !!group.back_layout_name?.trim()
  )
  const courseRegistered = !!(schedule.course_id ?? course?.id) && !!((schedule.layout_id ?? layout?.id) || hasGroupLayout)
  const memberCount = groupingComplete ? assignedCount : attendingCount
  const lottoPurchased = raw.lottoEntries.some((item) => item.scheduleId === schedule.id)
  const lottoDraw = raw.lottoDraws.find((item) => item.scheduleId === schedule.id)
  const savedRound = raw.rounds.find((item) => item.scheduleId === schedule.id)
  const awardItems = schedule.award_config?.items ?? []
  const awardPlanReady = Number(schedule.award_config?.count ?? 0) > 0 || awardItems.some((item) => !!item?.trim())

  return {
    id: schedule.id,
    courseName,
    layoutName,
    courseLine,
    date: schedule.round_date,
    dateLabel: formatRoundDate(schedule.round_date),
    teeTime,
    dday: formatDday(schedule.round_date) || 'D-DAY',
    status: schedule.status ?? 'planned',
    statusLabel: statusLabel(schedule.status),
    memberCount,
    groupCount: groups.length,
    memberNames: sameGroupMemberNames(groups, members, userId),
    attendanceStatus,
    groupingComplete,
    courseRegistered,
    assignedParticipant,
    note: schedule.note ?? undefined,
    weatherText: weather?.weatherText ?? '날씨 준비중',
    temperature: weather?.temperature ?? '--°',
    windText: weather?.windText ?? '풍속 준비중',
    fiveHourWeatherSummary: weather?.fiveHourSummary,
    fiveHourWeatherDetail: weather?.fiveHourDetail,
    fiveHourWeatherHours: weather?.fiveHourHours,
    courseId: schedule.course_id ?? course?.id,
    courseLatitude: course?.latitude ?? null,
    courseLongitude: course?.longitude ?? null,
    layoutId: schedule.layout_id ?? layout?.id,
    heroImageUrl: resolveHeroImageUrl(raw, course, schedule.round_date),
    locationLabel: locationParts.join(' · ') || '골프장 위치 준비중',
    routeTimeText: routeTimeText(),
    departureTimeText: departureTimeText(),
    awardPlanReady,
    lottoPurchased,
    lottoDrawStatus: lottoDraw?.drawStatus ?? null,
    lottoDrafterUserId: lottoDraw?.drafterUserId ?? null,
    isLottoDrafter: !!raw.currentUserId && lottoDraw?.drafterUserId === raw.currentUserId,
    resultSaved: !!savedRound,
    resultComplete: !!savedRound?.isComplete,
    urgencyTone: urgencyTone(schedule.round_date),
  }
}

function mapHeroRounds(raw: HomeDashboardRawData, userId?: string | null): HomeHeroRound[] {
  return raw.schedules.map((schedule) => mapScheduleRound(raw, schedule, userId))
}

function mapUpcomingRound(raw: HomeDashboardRawData, userId?: string | null): HomeUpcomingRound | null {
  const [firstRound] = mapHeroRounds(raw, userId)
  if (!firstRound) return null
  const { locationLabel: _locationLabel, routeTimeText: _routeTimeText, departureTimeText: _departureTimeText, urgencyTone: _urgencyTone, ...round } = firstRound
  return round
}

function mapRecentRounds(rounds: SavedRound[], userName?: string | null): HomeRecentRound[] {
  return rounds.slice(0, 3).map((round) => {
    const total = roundTotalForUser(round, userName)
    const par = totalPar(round.pars)
    const diff = total === null ? '-' : total - par > 0 ? `+${total - par}` : `${total - par}`
    return {
      id: round.id,
      courseName: round.courseName,
      dateLabel: formatRoundDate(round.date),
      date: round.date,
      total,
      diff,
    }
  })
}

function mapStats(rounds: SavedRound[], userName?: string | null): HomeDashboard['stats'] {
  const handicaps = computeHandicaps(rounds, 5)
  const myHandicap = userName ? handicaps.get(userName) ?? null : null
  const myTotals = rounds
    .map((round) => roundTotalForUser(round, userName))
    .filter((value): value is number => typeof value === 'number')
  const myAverage = average(myTotals.slice(0, 10))
  const recentScore = myTotals[0] ?? null
  const bestScore = myTotals.length ? Math.min(...myTotals) : null
  const monthRoundCount = currentMonthRoundCount(rounds)

  const items: PremiumRecentStatItem[] = [
    {
      key: 'handicap',
      icon: '⭐',
      label: '핸디캡',
      value: handicapDisplay(myHandicap),
      caption: myTotals.length ? '최근 5경기 기준' : '기록 등록 필요',
      tone: 'primary',
      trend: recentTrendFromScores(myTotals),
    },
    {
      key: 'average',
      icon: '📈',
      label: '평균 스코어',
      value: scoreDisplay(myAverage),
      caption: myTotals.length ? '전체 경기 평균' : '첫 라운드를 기록하세요',
      tone: 'info',
      trend: recentTrendFromScores(myTotals.slice(0, 5)),
    },
    {
      key: 'recent',
      icon: '⛳',
      label: '최근 라운드',
      value: scoreDisplay(recentScore),
      caption: rounds[0]?.date ? formatRoundDate(rounds[0].date) : '최근 기록 없음',
      tone: 'success',
      trend: recentTrendFromScores(myTotals.slice(0, 5)),
    },
    {
      key: 'best',
      icon: '🏆',
      label: '베스트 스코어',
      value: scoreDisplay(bestScore),
      caption: monthRoundCount ? `이번 달 ${monthRoundCount}R` : '도전 기록 대기',
      tone: 'gold',
      trend: recentTrendFromScores([...myTotals].sort((a, b) => a - b).slice(0, 5)),
    },
  ]

  return {
    averageScore: statText(myAverage),
    items,
    recentRounds: mapRecentRounds(rounds, userName),
  }
}

export function createEmptyHomeDashboard(): HomeDashboard {
  const stats = {
    averageScore: '-',
    items: [],
    recentRounds: [],
  }
  const feedEvents = buildHomeFeedEvents({ upcomingRound: null, recentRounds: [], stats: [] })

  return {
    hero: {
      courseName: 'GogoPar',
      address: '다음 라운드를 등록하면 홈에서 바로 확인할 수 있어요',
      weatherText: '준비중',
      temperature: '--°',
      dday: 'READY',
      roundDate: '예정 라운드 없음',
      teeTime: '--:--',
      totalCount: 1,
      rounds: [],
    },
    upcomingRound: null,
    aiCaddie: {
      averageScore: '-',
      hasUpcomingRound: false,
    },
    feed: selectPrimaryHomeFeedEvent(feedEvents),
    feedEvents,
    feedEventsByRoundId: {},
    stats,
  }
}

export function mapHomeDashboard(raw: HomeDashboardRawData, userName?: string | null, userId?: string | null): HomeDashboard {
  const safeRaw = normalizeHomeDashboardRawData(raw)
  const heroRounds = mapHeroRounds(safeRaw, userId)
  const upcomingRound = mapUpcomingRound(safeRaw, userId)
  const stats = mapStats(safeRaw.rounds, userName)
  const firstHeroRound = heroRounds[0]

  const feedEventsByRoundId = heroRounds.reduce<Record<string, ReturnType<typeof buildRoundFeedEvents>>>((acc, round) => {
    acc[round.id] = buildRoundFeedEvents(round, stats.recentRounds)
    return acc
  }, {})
  const feedEvents = upcomingRound
    ? (feedEventsByRoundId[upcomingRound.id] ?? buildRoundFeedEvents(upcomingRound, stats.recentRounds))
    : buildHomeFeedEvents({
        upcomingRound: null,
        recentRounds: stats.recentRounds,
        stats: stats.items,
      })

  return {
    hero: {
      courseName: firstHeroRound?.courseName || 'GogoPar',
      address: firstHeroRound?.locationLabel || '다음 라운드를 등록하면 홈에서 바로 확인할 수 있어요',
      weatherText: firstHeroRound?.weatherText || '준비중',
      temperature: firstHeroRound?.temperature || '--°',
      dday: firstHeroRound?.dday || 'READY',
      roundDate: firstHeroRound?.dateLabel || '예정 라운드 없음',
      teeTime: firstHeroRound?.teeTime || '--:--',
      totalCount: Math.max(1, heroRounds.length || 1),
      rounds: heroRounds,
    },
    upcomingRound,
    aiCaddie: {
      courseName: upcomingRound?.courseName,
      teeTime: upcomingRound?.teeTime,
      dday: upcomingRound?.dday,
      averageScore: stats.averageScore,
      hasUpcomingRound: !!upcomingRound,
    },
    feed: selectPrimaryHomeFeedEvent(feedEvents),
    feedEvents,
    feedEventsByRoundId,
    stats,
  }
}
