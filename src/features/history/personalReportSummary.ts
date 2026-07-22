import type { PersonalRoundFir, PersonalRoundHoleStat, SavedRound } from '../../lib/store'
import { firLabel, type PlayerRound } from './personalRoundStats'

export type PersonalReportModal = 'target' | 'trend' | 'hole' | 'score' | 'rank' | 'improve' | 'rounds' | 'shot'

type ScoreColors = {
  birdie: string
  par: string
  bogey: string
  doublePlus: string
}

export type PersonalReportCard = {
  key: PersonalReportModal
  icon: string
  title: string
  subtitle: string
  modal: PersonalReportModal
}

export function getPersonalReportModalTitle(modal: PersonalReportModal) {
  if (modal === 'target') return '목표 설정'
  if (modal === 'trend') return '추이 분석'
  if (modal === 'hole') return '홀 유형별 평균'
  if (modal === 'score') return '스코어 분포'
  if (modal === 'rank') return '클럽 내 순위'
  if (modal === 'improve') return '개선 리포트'
  if (modal === 'shot') return '샷·퍼팅 분석'
  return '라운드별 상세'
}

export function buildPersonalReportSummary({
  playerRounds,
  byName,
  personalPlayerName,
  rounds,
  handicapBasis,
  scheduleIds,
  personalStatsBySchedule,
  targetScore,
  scoreColors,
}: {
  playerRounds: PlayerRound[]
  byName: Map<string, PlayerRound[]>
  personalPlayerName: string
  rounds: SavedRound[]
  handicapBasis: number
  scheduleIds: string[]
  personalStatsBySchedule: Record<string, PersonalRoundHoleStat[]>
  targetScore: string
  scoreColors: ScoreColors
}) {
  if (playerRounds.length === 0) {
    const scoreTotals = { birdie: 0, par: 0, bogey: 0, double: 0, triplePlus: 0 }
    const target = Number(targetScore.replace(/[^0-9]/g, ''))
    return {
      avg: 0,
      best: 0,
      handicap: 0,
      recent5Avg: 0,
      trendText: '최근 흐름을 분석할 기록이 부족합니다.',
      avgParType: { 3: '-', 4: '-', 5: '-' },
      frontAvg: 0,
      backAvg: 0,
      strength: undefined,
      weakness: undefined,
      playerStats: [],
      rankSummary: { avg: 0, handicap: 0, birdie: 0 },
      totalPlayers: 0,
      target,
      targetGap: 0,
      firRate: null,
      girRate: null,
      obCount: 0,
      hazardCount: 0,
      avgPutts: '-',
      threePuttCount: 0,
      penaltyTotal: 0,
      mainMissText: '미입력',
      trendRounds: [],
      puttTrendData: [],
      obDistributionData: [
        { label: '좌 OB', value: 0 },
        { label: '우 OB', value: 0 },
        { label: '기타 OB', value: 0 },
        { label: '해저드', value: 0 },
      ],
      parRadarData: [],
      scoreTotals,
      scoreDistributionData: [
        { label: '버디', value: 0, color: scoreColors.birdie },
        { label: '파', value: 0, color: scoreColors.par },
        { label: '보기', value: 0, color: scoreColors.bogey },
        { label: '더블+', value: 0, color: scoreColors.doublePlus },
      ],
      scoreStackData: [],
      aiComments: ['최근 라운드 패턴을 더 쌓으면 맞춤 개선 포인트를 제안할게요.'],
      improvementItems: ['라운드 기록이 쌓이면 개선 리포트를 표시합니다.'],
      personalReportCards: [],
    }
  }

  const totals = playerRounds.map((round) => round.total)
  const avg = Math.ceil(totals.reduce((sum, total) => sum + total, 0) / totals.length)
  const best = Math.min(...totals)
  const lastN = [...playerRounds].sort((a, b) => a.date.localeCompare(b.date)).slice(-handicapBasis)
  const handicap = Math.ceil(lastN.reduce((sum, round) => sum + round.diff, 0) / lastN.length)
  const recent5 = playerRounds.slice(0, 5)
  const recent5Avg = Math.ceil(recent5.reduce((sum, round) => sum + round.total, 0) / recent5.length)
  const oldestRecent = recent5[recent5.length - 1]
  const latestRecent = recent5[0]
  const trendText = oldestRecent && latestRecent
    ? latestRecent.total < oldestRecent.total
      ? `최근 흐름은 ${oldestRecent.total - latestRecent.total}타 개선되었습니다.`
      : latestRecent.total > oldestRecent.total
        ? `최근 흐름은 ${latestRecent.total - oldestRecent.total}타 높아졌습니다.`
        : '최근 흐름은 안정적으로 유지되고 있습니다.'
    : '최근 흐름을 분석할 기록이 부족합니다.'

  const parType = { 3: { total: 0, count: 0 }, 4: { total: 0, count: 0 }, 5: { total: 0, count: 0 } }
  const scoreTotals = { birdie: 0, par: 0, bogey: 0, double: 0, triplePlus: 0 }
  let frontTotal = 0
  let backTotal = 0
  for (const round of playerRounds) {
    round.strokes.forEach((score, index) => {
      const par = round.pars[index] as 3 | 4 | 5
      if (parType[par]) {
        parType[par].total += score
        parType[par].count += 1
      }
    })
    scoreTotals.birdie += round.birdie
    scoreTotals.par += round.parCount
    scoreTotals.bogey += round.bogey
    scoreTotals.double += round.double
    scoreTotals.triplePlus += round.triplePlus
    frontTotal += round.front
    backTotal += round.back
  }

  const avgParType = {
    3: parType[3].count ? (parType[3].total / parType[3].count).toFixed(1) : '-',
    4: parType[4].count ? (parType[4].total / parType[4].count).toFixed(1) : '-',
    5: parType[5].count ? (parType[5].total / parType[5].count).toFixed(1) : '-',
  }
  const frontAvg = Math.round(frontTotal / playerRounds.length)
  const backAvg = Math.round(backTotal / playerRounds.length)
  const parAverages = ([3, 4, 5] as const)
    .map((par) => ({ label: `Par ${par}`, value: Number(avgParType[par]) }))
    .filter((item) => !Number.isNaN(item.value))
  const strength = [...parAverages].sort((a, b) => a.value - b.value)[0]
  const weakness = [...parAverages].sort((a, b) => b.value - a.value)[0]

  const playerStats = [...byName.entries()].map(([name, list]) => {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const playerTotals = sorted.map((round) => round.total)
    const playerLastN = sorted.slice(-handicapBasis)
    return {
      name,
      avg: Math.ceil(playerTotals.reduce((sum, total) => sum + total, 0) / playerTotals.length),
      handicap: Math.ceil(playerLastN.reduce((sum, round) => sum + round.diff, 0) / playerLastN.length),
      birdie: sorted.reduce((sum, round) => sum + round.birdie, 0),
    }
  })
  const rankOf = (key: 'avg' | 'handicap' | 'birdie', lowerBetter: boolean) => {
    const sorted = [...playerStats].sort((a, b) => lowerBetter ? a[key] - b[key] : b[key] - a[key])
    return sorted.findIndex((item) => item.name === personalPlayerName) + 1
  }
  const rankSummary = {
    avg: rankOf('avg', true),
    handicap: rankOf('handicap', true),
    birdie: rankOf('birdie', false),
  }

  const target = Number(targetScore.replace(/[^0-9]/g, ''))
  const targetGap = target ? avg - target : 0
  const personalHoleStats = scheduleIds.flatMap((scheduleId) => personalStatsBySchedule[scheduleId] ?? [])
  const personalHoleStatsWithScore = scheduleIds.flatMap((scheduleId) => {
    const round = rounds.find((item) => item.scheduleId === scheduleId)
    const playerRound = round ? playerRounds.find((item) => item.roundId === round.id) : null
    return (personalStatsBySchedule[scheduleId] ?? []).map((item) => ({
      ...item,
      score: playerRound?.strokes[item.hole - 1] ?? null,
    }))
  })
  const firTargets = personalHoleStats.filter((item) => item.par !== 3)
  const firSuccess = firTargets.filter((item) => !item.fir || item.fir === 'center').length
  const firRate = firTargets.length ? Math.round((firSuccess / firTargets.length) * 100) : null
  const girTargets = personalHoleStatsWithScore.filter((item) => item.score !== null && item.putts > 0)
  const girSuccess = girTargets.filter((item) => item.score !== null && item.score - item.putts <= item.par - 2).length
  const girRate = girTargets.length ? Math.round((girSuccess / girTargets.length) * 100) : null
  const obCount = personalHoleStats.filter((item) => item.fir === 'left_ob' || item.fir === 'right_ob' || item.fir === 'other_ob').length
  const hazardCount = personalHoleStats.filter((item) => item.fir === 'hazard').length
  const avgPutts = personalHoleStats.length ? (personalHoleStats.reduce((sum, item) => sum + item.putts, 0) / personalHoleStats.length).toFixed(1) : '-'
  const threePuttCount = personalHoleStats.filter((item) => item.putts >= 3).length
  const penaltyTotal = personalHoleStats.reduce((sum, item) => sum + item.penalties, 0)
  const firCounts = new Map<PersonalRoundFir, number>()
  for (const item of personalHoleStats) if (item.fir) firCounts.set(item.fir, (firCounts.get(item.fir) ?? 0) + 1)
  const mainMiss = [...firCounts.entries()].filter(([key]) => key !== 'center').sort((a, b) => b[1] - a[1])[0]
  const mainMissText = mainMiss ? firLabel(mainMiss[0]) : '미입력'

  const trendRounds = [...playerRounds].sort((a, b) => a.date.localeCompare(b.date)).slice(-6)
  const trendWithStats = trendRounds.map((round) => {
    const scheduleId = rounds.find((item) => item.id === round.roundId)?.scheduleId
    const holeStats = scheduleId ? personalStatsBySchedule[scheduleId] ?? [] : []
    const holeStatsWithScore = holeStats.map((item) => ({ ...item, score: round.strokes[item.hole - 1] ?? null }))
    const roundGirTargets = holeStatsWithScore.filter((item) => item.score !== null && item.putts > 0)
    return {
      round,
      putts: holeStats.length ? Number((holeStats.reduce((sum, item) => sum + item.putts, 0) / holeStats.length).toFixed(1)) : null,
      gir: roundGirTargets.length ? Math.round((roundGirTargets.filter((item) => item.score !== null && item.score - item.putts <= item.par - 2).length / roundGirTargets.length) * 100) : null,
    }
  })
  const puttTrendData = trendWithStats
    .map((item) => item.putts === null ? null : { date: item.round.date, value: item.putts })
    .filter((item): item is { date: string; value: number } => Boolean(item))
  const obDistributionData = [
    { label: '좌 OB', value: firCounts.get('left_ob') ?? 0 },
    { label: '우 OB', value: firCounts.get('right_ob') ?? 0 },
    { label: '기타 OB', value: firCounts.get('other_ob') ?? 0 },
    { label: '해저드', value: firCounts.get('hazard') ?? 0 },
  ]
  const parRadarData = ([3, 4, 5] as const)
    .map((par) => ({ label: `Par ${par}`, value: Number(avgParType[par]) }))
    .filter((item) => !Number.isNaN(item.value))
  const scoreDistributionData = [
    { label: '버디', value: scoreTotals.birdie, color: scoreColors.birdie },
    { label: '파', value: scoreTotals.par, color: scoreColors.par },
    { label: '보기', value: scoreTotals.bogey, color: scoreColors.bogey },
    { label: '더블+', value: scoreTotals.double + scoreTotals.triplePlus, color: scoreColors.doublePlus },
  ]
  const scoreStackData = trendRounds.map((round) => ({
    date: round.date,
    birdie: round.birdie,
    par: round.parCount,
    bogey: round.bogey,
    doublePlus: round.double + round.triplePlus,
  }))
  const aiComments = [
    recent5Avg < avg
      ? `최근 5경기 평균이 전체 평균보다 ${avg - recent5Avg}타 낮아져 흐름이 좋습니다.`
      : recent5Avg > avg
        ? `최근 5경기 평균이 전체 평균보다 ${recent5Avg - avg}타 높아졌습니다.`
        : '최근 5경기 평균이 전체 평균과 비슷하게 유지되고 있습니다.',
    backAvg > frontAvg
      ? `후반이 전반보다 ${backAvg - frontAvg}타 높아 후반 집중 관리가 필요합니다.`
      : backAvg < frontAvg
        ? `후반이 전반보다 ${frontAvg - backAvg}타 낮아 마무리 흐름이 좋습니다.`
        : '전후반 타수 균형이 안정적입니다.',
    scoreTotals.double + scoreTotals.triplePlus > playerRounds.length * 3
      ? '더블 이상 타수가 많아 세컨드샷 실수를 줄이는 전략이 효과적입니다.'
      : '더블 이상 관리가 비교적 안정적입니다.',
  ]
  const improvementItems = [
    `1순위: ${weakness?.label ?? '취약 홀'}에서 안전한 공략으로 평균 타수를 낮추기`,
    `2순위: 후반 평균 ${backAvg}타를 전반 평균 ${frontAvg}타에 가깝게 만들기`,
    `3순위: 더블/트리플 ${scoreTotals.double + scoreTotals.triplePlus}개를 줄이기`,
  ]
  const personalReportCards: PersonalReportCard[] = [
    { key: 'target', icon: '🎯', title: '목표 설정', subtitle: `${targetScore || '100'}타 목표 관리`, modal: 'target' },
    { key: 'trend', icon: '📈', title: '스코어 추이', subtitle: `최근5 평균 ${recent5Avg}타`, modal: 'trend' },
    { key: 'shot', icon: '🏌️', title: '샷·퍼팅', subtitle: `FIR ${firRate === null ? '-' : `${firRate}%`} · 퍼팅 ${avgPutts === '-' ? '-' : `${avgPutts}개`}`, modal: 'shot' },
    { key: 'hole', icon: '⛳', title: '홀 유형', subtitle: weakness ? `${weakness.label} 보완 필요` : 'Par3/4/5 분석', modal: 'hole' },
    { key: 'score', icon: '📊', title: '스코어 분포', subtitle: `Par ${scoreTotals.par} · Bogey ${scoreTotals.bogey}`, modal: 'score' },
    { key: 'rank', icon: '🏆', title: '클럽 순위', subtitle: `${playerStats.length}명 비교`, modal: 'rank' },
    { key: 'rounds', icon: '📋', title: '라운드 상세', subtitle: `${playerRounds.length}경기 기록`, modal: 'rounds' },
    { key: 'improve', icon: '🤖', title: '개선 리포트', subtitle: `OB ${obCount}회 · 패널티 ${penaltyTotal}개`, modal: 'improve' },
  ]

  return {
    avg,
    best,
    handicap,
    recent5Avg,
    trendText,
    avgParType,
    frontAvg,
    backAvg,
    strength,
    weakness,
    playerStats,
    rankSummary,
    totalPlayers: playerStats.length,
    target,
    targetGap,
    firRate,
    girRate,
    obCount,
    hazardCount,
    avgPutts,
    threePuttCount,
    penaltyTotal,
    mainMissText,
    trendRounds,
    puttTrendData,
    obDistributionData,
    parRadarData,
    scoreTotals,
    scoreDistributionData,
    scoreStackData,
    aiComments,
    improvementItems,
    personalReportCards,
  }
}
