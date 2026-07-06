import { computeHandicaps, playerTotal, totalPar, type SavedRound } from '../../../lib/store'
import type { PremiumRecentStatItem } from '../components'
import type { HomeCourseRow, HomeDashboardRawData, HomeLayoutRow, HomeScheduleGroupMemberRow, HomeScheduleGroupRow, HomeScheduleRow } from '../api/homeRepository'
import type { HomeDashboard, HomeRecentRound, HomeRoundStatus, HomeUpcomingRound } from '../types/home'

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

function mapUpcomingRound(raw: HomeDashboardRawData): HomeUpcomingRound | null {
  const schedule = raw.schedules[0]
  if (!schedule) return null

  const groups = raw.groups.filter((group) => group.schedule_id === schedule.id)
  const members = raw.members.filter((member) => member.schedule_id === schedule.id)
  const course = raw.courses.find((item) => item.id === schedule.course_id)
  const layout = raw.layouts.find((item) => item.id === schedule.layout_id)
  const courseName = resolveCourseName(schedule, course)
  const layoutName = resolveLayoutName(schedule, layout)
  const teeTime = firstTeeTime(schedule, groups)

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
    weatherText: '날씨 준비중',
    temperature: '--°',
    courseId: schedule.course_id ?? course?.id,
    layoutId: schedule.layout_id ?? layout?.id,
  }
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
  const upcomingRound = mapUpcomingRound(raw)
  const stats = mapStats(raw.rounds, userName)

  return {
    hero: {
      courseName: upcomingRound?.courseName || 'GogoPar',
      address: upcomingRound?.layoutName ? `${upcomingRound.layoutName} 코스` : '다음 라운드를 등록하면 홈에서 바로 확인할 수 있어요',
      weatherText: upcomingRound?.weatherText || '준비중',
      temperature: upcomingRound?.temperature || '--°',
      dday: upcomingRound?.dday || 'READY',
      roundDate: upcomingRound?.dateLabel || '예정 라운드 없음',
      teeTime: upcomingRound?.teeTime || '--:--',
      totalCount: Math.max(1, Math.min(3, raw.schedules.length || 1)),
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
