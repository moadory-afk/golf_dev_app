import { computeHandicaps, playerTotal, totalPar, type SavedRound } from '../../../lib/store'
import type { PremiumRecentStatItem } from '../components'
import type { HomeCourseRow, HomeDashboardRawData, HomeLayoutRow, HomeScheduleGroupMemberRow, HomeScheduleGroupRow, HomeScheduleRow } from '../api/homeRepository'
import type { HomeDashboard, HomeHeroRound, HomeRecentRound, HomeRoundStatus, HomeUpcomingRound } from '../types/home'

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

function routeTimeText() {
  return '48분'
}

function departureTimeText(teeTime?: string | null) {
  const match = teeTime?.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return '10:55'
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '10:55'
  const totalMinutes = hour * 60 + minute - 77
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const departureHour = Math.floor(normalized / 60)
  const departureMinute = normalized % 60
  return `${String(departureHour).padStart(2, '0')}:${String(departureMinute).padStart(2, '0')}`
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function scoreDisplay(value: number | null, suffix = '타') {
  if (value === null || !Number.isFinite(value)) return '-'
  return `${Math.round(value)}${suffix}`
}

function statText(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return '-'
  return value.toFixed(digits)
}

function handicapDisplay(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '-'
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)
}

function roundTotalForUser(round: SavedRound, userName?: string | null) {
  const player = round.players.find((item) => item.name === userName) ?? round.players[0]
  if (!player) return null
  return playerTotal(player.strokes)
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
  return schedule.course_name?.trim() || course?.name || '다음 라운드'
}

function resolveLayoutName(schedule: HomeScheduleRow, layout?: HomeLayoutRow) {
  return schedule.layout_name?.trim() || layout?.name || undefined
}

function countMembers(groups: HomeScheduleGroupRow[], members: HomeScheduleGroupMemberRow[]) {
  if (members.length > 0) return members.length
  return groups.length > 0 ? groups.length * 4 : 0
}

function mapScheduleRound(raw: HomeDashboardRawData, schedule: HomeScheduleRow): HomeHeroRound {
  const groups = raw.groups.filter((group) => group.schedule_id === schedule.id)
  const members = raw.members.filter((member) => member.schedule_id === schedule.id)
  const course = raw.courses.find((item) => item.id === schedule.course_id)
  const layout = raw.layouts.find((item) => item.id === schedule.layout_id)
  const courseName = resolveCourseName(schedule, course)
  const layoutName = resolveLayoutName(schedule, layout)
  const teeTime = firstTeeTime(schedule, groups)
  const locationParts = [course?.region, layoutName ? `${layoutName} 코스` : undefined].filter(Boolean)

  return {
    id: schedule.id,
    courseName,
    layoutName,
    date: schedule.round_date,
    dateLabel: formatRoundDate(schedule.round_date),
    teeTime,
    dday: formatDday(schedule.round_date) || 'D-DAY',
    status: schedule.status ?? 'planned',
    statusLabel: statusLabel(schedule.status),
    memberCount: countMembers(groups, members),
    groupCount: groups.length,
    note: schedule.note ?? undefined,
    weatherText: '맑음',
    temperature: '24°',
    windText: '2m/s',
    courseId: schedule.course_id ?? course?.id,
    layoutId: schedule.layout_id ?? layout?.id,
    locationLabel: locationParts.join(' · ') || '골프장 위치 준비중',
    routeTimeText: routeTimeText(),
    departureTimeText: departureTimeText(teeTime),
    urgencyTone: urgencyTone(schedule.round_date),
  }
}

function mapHeroRounds(raw: HomeDashboardRawData): HomeHeroRound[] {
  return raw.schedules.map((schedule) => mapScheduleRound(raw, schedule))
}

function mapUpcomingRound(raw: HomeDashboardRawData): HomeUpcomingRound | null {
  const [firstRound] = mapHeroRounds(raw)
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
    averageScore: statText(myAverage, 1),
    items,
    recentRounds: mapRecentRounds(rounds, userName),
  }
}

export function createEmptyHomeDashboard(): HomeDashboard {
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
    stats: {
      averageScore: '-',
      items: [],
      recentRounds: [],
    },
  }
}

export function mapHomeDashboard(raw: HomeDashboardRawData, userName?: string | null): HomeDashboard {
  const heroRounds = mapHeroRounds(raw)
  const upcomingRound = mapUpcomingRound(raw)
  const stats = mapStats(raw.rounds, userName)
  const firstHeroRound = heroRounds[0]

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
    stats,
  }
}
