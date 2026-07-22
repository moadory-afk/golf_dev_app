import { fillToCount } from '../../lib/awardConfig'
import { computeClubAwardResults } from '../../lib/awardResults'
import type { ScheduledRound } from '../../lib/roundSchedule'
import {
  getHandicapsForRound,
  playerTotal,
  shortName,
  totalPar,
  type ClubAwardSnapshot,
  type LottoAwardConfig,
  type RoundLottoDraw,
  type RoundLottoEntry,
  type SavedRound,
} from '../../lib/store'
import { calcSettlement } from '../settlement'

type HoleStats = {
  eagle: number
  birdie: number
  par: number
  bogey: number
  double: number
  triplePlus: number
}

export type RoundFrontSummary = {
  par: number
  best: number
  avg: number
  bestPlayerName: string
  winnerName: string
  winnerDiff: string
  runnerUpName: string
  runnerUpDiff: string
  clubRecordRows: Array<{ icon: string; label: string; value: string }>
  records: Array<{ icon: string; label: string; value: string }>
  frontHighlights: Array<{ icon: string; label: string; value: string }>
}

export type RoundDetailSummary = {
  detailPar: number
  actualRegularRank: Array<{ name: string; total: number; diff: number }>
  handicapRegularRank: Array<{ name: string; total: number; handicap: number; net: number; diff: number }>
  hiddenHoles: number[]
  shinScoreRank: Array<{ name: string; total: number; diff: number }>
  shinRank: Array<{ name: string; total: number; handicap: number; net: number }>
  scoreRows: Array<{ name: string; total: number; diff: number; stats: HoleStats }>
}

export type RoundAwardMoneySummary = {
  awardRows: Array<{ awardKey: string; icon: string; label: string; winner: string; detail: string }>
  lottoAwardGroups: Array<{ hits: number; prize: number; names: string }>
  moneyGame: ReturnType<typeof calcSettlement> | null
  moneyPairs: Array<{ from: string; to: string; amount: number }>
}

function diffText(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function holeStats(strokes: number[], pars: number[]): HoleStats {
  return strokes.reduce<HoleStats>((stats, stroke, index) => {
    const diff = stroke - (pars[index] ?? 4)
    if (diff <= -2) stats.eagle += 1
    else if (diff === -1) stats.birdie += 1
    else if (diff === 0) stats.par += 1
    else if (diff === 1) stats.bogey += 1
    else if (diff === 2) stats.double += 1
    else stats.triplePlus += 1
    return stats
  }, { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triplePlus: 0 })
}

function lottoPrizeForHits(hits: number, config: LottoAwardConfig, jackpot: number) {
  if (hits === 6) return jackpot
  if (hits === 3 || hits === 4 || hits === 5) return config.prizes[String(hits) as '3' | '4' | '5']
  return 0
}

function awardWinnerDisplay(winner: string) {
  return winner
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map(shortName)
    .join(', ')
}

function applyManualAwardWinners<T extends { awardKey: string; winner: string; detail: string }>(
  rows: T[],
  manualWinners?: Record<string, string[]>,
) {
  if (!manualWinners) return rows
  return rows.map((row) => {
    const winners = manualWinners[row.awardKey]
    if (!winners?.length) return row
    return {
      ...row,
      winner: winners.map(shortName).join(', '),
      detail: row.detail === '추첨' || row.detail === '현장 확인' ? '관리자 지정' : row.detail,
    }
  })
}

export function buildRoundFrontSummary(
  round: SavedRound,
  rounds: SavedRound[],
  handicapBasis: number,
): RoundFrontSummary {
  const hasResults = round.players.length > 0 && round.pars.length > 0
  const par = hasResults ? totalPar(round.pars) : 0
  const totals = hasResults ? round.players.map((player) => playerTotal(player.strokes)) : []
  const best = totals.length > 0 ? Math.min(...totals) : 0
  const avg = totals.length > 0 ? Math.ceil(totals.reduce((sum, total) => sum + total, 0) / totals.length) : 0
  const bestPlayer = round.players.find((player) => playerTotal(player.strokes) === best)
  const roundHandicaps = getHandicapsForRound(round, rounds, handicapBasis)
  const regularRank = round.players
    .map((player) => {
      const total = playerTotal(player.strokes)
      const handicap = roundHandicaps.get(player.name) ?? 0
      return { name: player.name, total, handicap, net: total - handicap }
    })
    .sort((a, b) => a.net - b.net)
  const winner = regularRank[0]
  const runnerUp = regularRank.find((row) => row.name !== winner?.name)

  const playerHighlights = round.players.map((player) => {
    const stats = holeStats(player.strokes, round.pars)
    return { name: player.name, ...stats }
  })
  const birdieTop = [...playerHighlights].sort((a, b) => b.birdie - a.birdie)[0]
  const parTop = [...playerHighlights].sort((a, b) => b.par - a.par)[0]
  const frontBackTop = round.players
    .map((player) => {
      const front = player.strokes.slice(0, 9).reduce((sum, score) => sum + score, 0)
      const back = player.strokes.slice(9, 18).reduce((sum, score) => sum + score, 0)
      return { name: player.name, improvement: front - back }
    })
    .filter((row) => row.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)[0]

  const priorRounds = rounds.filter((item) => item.date < round.date)
  const clubRecordRows: RoundFrontSummary['clubRecordRows'] = []
  const priorBest = priorRounds.length
    ? Math.min(...priorRounds.flatMap((item) => item.players.map((player) => playerTotal(player.strokes))))
    : Infinity
  if (best < priorBest) clubRecordRows.push({ icon: '🏆', label: '최저타 갱신', value: `${shortName(bestPlayer?.name ?? '')} ${best}타` })
  const priorBirdie = priorRounds.length ? Math.max(0, ...priorRounds.flatMap((item) => item.players.map((player) => holeStats(player.strokes, item.pars).birdie))) : 0
  if ((birdieTop?.birdie ?? 0) > 0 && birdieTop!.birdie > priorBirdie) clubRecordRows.push({ icon: '🟡', label: '버디왕 갱신', value: `${shortName(birdieTop!.name)} ${birdieTop!.birdie}개` })
  const priorPar = priorRounds.length ? Math.max(0, ...priorRounds.flatMap((item) => item.players.map((player) => holeStats(player.strokes, item.pars).par))) : 0
  if ((parTop?.par ?? 0) > 0 && parTop!.par > priorPar) clubRecordRows.push({ icon: '⛳', label: '파왕 갱신', value: `${shortName(parTop!.name)} ${parTop!.par}개` })

  const records = clubRecordRows.length > 0
    ? clubRecordRows
    : [{ icon: '✨', label: '기록 갱신 없음', value: '다음 라운드 도전' }]

  type HighlightCandidate = { icon: string; label: string; value: string; priority: number }
  const candidates: HighlightCandidate[] = []
  const holeCount = Math.max(round.pars.length, 1)
  const steadyParThreshold = Math.max(5, Math.ceil(holeCount * 0.5))

  if (bestPlayer) candidates.push({ icon: '🏅', label: '메달리스트', value: `${shortName(bestPlayer.name)} ${best}타`, priority: 95 })
  if ((birdieTop?.birdie ?? 0) >= 2) candidates.push({ icon: '🟡', label: '버디 집중', value: `${shortName(birdieTop!.name)} ${birdieTop!.birdie}개`, priority: 80 + birdieTop!.birdie })
  if ((parTop?.par ?? 0) >= steadyParThreshold) candidates.push({ icon: '⛳', label: '파 세이브', value: `${shortName(parTop!.name)} ${parTop!.par}개`, priority: 70 + parTop!.par })
  if ((frontBackTop?.improvement ?? 0) >= 3) candidates.push({ icon: '📈', label: '후반 반등', value: `${shortName(frontBackTop!.name)} ${frontBackTop!.improvement}타`, priority: 75 + frontBackTop!.improvement })
  if (candidates.length < 3 && (birdieTop?.birdie ?? 0) === 1) candidates.push({ icon: '🟡', label: '오늘의 버디', value: `${shortName(birdieTop!.name)} 1개`, priority: 60 })
  if (candidates.length === 0) candidates.push({ icon: '✨', label: '라운드 완료', value: '다음 기록 도전', priority: 1 })

  return {
    par,
    best,
    avg,
    bestPlayerName: shortName(bestPlayer?.name ?? '메달'),
    winnerName: shortName(winner?.name ?? '우승'),
    winnerDiff: winner ? diffText(winner.net - par) : '-',
    runnerUpName: shortName(runnerUp?.name ?? '준우승'),
    runnerUpDiff: runnerUp ? diffText(runnerUp.net - par) : '-',
    clubRecordRows,
    records,
    frontHighlights: candidates
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)
      .map(({ icon, label, value }) => ({ icon, label, value })),
  }
}

export function buildRoundDetailSummary(
  round: SavedRound,
  rounds: SavedRound[],
  handicapBasis: number,
): RoundDetailSummary {
  const detailPar = round.pars.length > 0 ? totalPar(round.pars) : 0
  const detailHandicaps = getHandicapsForRound(round, rounds, handicapBasis)
  const actualRegularRank = round.players
    .map((player) => {
      const total = playerTotal(player.strokes)
      return { name: player.name, total, diff: total - detailPar }
    })
    .sort((a, b) => a.total - b.total)
  const handicapRegularRank = round.players
    .map((player) => {
      const total = playerTotal(player.strokes)
      const handicap = detailHandicaps.get(player.name) ?? 0
      const net = total - handicap
      return { name: player.name, total, handicap, net, diff: net - detailPar }
    })
    .sort((a, b) => a.net - b.net || a.total - b.total)
  const hiddenHoles = round.shinperioHoles.length
    ? round.shinperioHoles
    : round.pars.map((_, index) => index + 1)
  const shinScoreRank = round.players
    .map((player) => {
      const total = player.strokes.reduce(
        (sum, stroke, index) => sum + (hiddenHoles.includes(index + 1) ? stroke : (round.pars[index] ?? 0)),
        0,
      )
      return { name: player.name, total, diff: total - detailPar }
    })
    .sort((a, b) => a.total - b.total)
  const shinRank = round.players
    .map((player) => {
      const hiddenScore = hiddenHoles.reduce((sum, hole) => sum + (player.strokes[hole - 1] ?? round.pars[hole - 1] ?? 0), 0)
      const hiddenPar = hiddenHoles.reduce((sum, hole) => sum + (round.pars[hole - 1] ?? 0), 0)
      const scaledScore = hiddenHoles.length > 0 ? hiddenScore * (round.pars.length / hiddenHoles.length) : hiddenScore
      const scaledPar = hiddenHoles.length > 0 ? hiddenPar * (round.pars.length / hiddenHoles.length) : hiddenPar
      const handicap = Math.max(0, Math.ceil((scaledScore - scaledPar) * 0.8))
      const total = playerTotal(player.strokes)
      const net = Math.ceil(total - handicap)
      return { name: player.name, total, handicap, net }
    })
    .sort((a, b) => a.net - b.net || a.total - b.total)
  const scoreRows = round.players
    .map((player) => {
      const total = playerTotal(player.strokes)
      const stats = holeStats(player.strokes, round.pars)
      return { name: player.name, total, diff: total - detailPar, stats }
    })
    .sort((a, b) => a.total - b.total)
  return { detailPar, actualRegularRank, handicapRegularRank, hiddenHoles, shinScoreRank, shinRank, scoreRows }
}

export function buildRoundAwardMoneySummary({
  round,
  rounds,
  handicapBasis,
  detailPar,
  roundSchedules,
  clubAwardConfig,
  awardSnapshots,
  lottoEntries,
  lottoDraw,
  lottoAwardConfig,
  clubMembers,
}: {
  round: SavedRound
  rounds: SavedRound[]
  handicapBasis: number
  detailPar: number
  roundSchedules: ScheduledRound[]
  clubAwardConfig: { count: number; items: string[]; manualWinners?: Record<string, string[]> } | null
  awardSnapshots: ClubAwardSnapshot[]
  lottoEntries: RoundLottoEntry[]
  lottoDraw: RoundLottoDraw | null
  lottoAwardConfig: LottoAwardConfig
  clubMembers: Array<{ userId: string; name: string; role: string }>
}): RoundAwardMoneySummary {
  const scheduleAwardConfig = round.scheduleId
    ? roundSchedules.find((item) => item.id === round.scheduleId)?.awardConfig
    : null
  const effectiveAwardConfig = scheduleAwardConfig ?? clubAwardConfig
  const fallbackAwardRows = effectiveAwardConfig
    ? computeClubAwardResults(
        fillToCount(effectiveAwardConfig.items, effectiveAwardConfig.count),
        round,
        getHandicapsForRound(round, rounds, handicapBasis),
        detailPar,
      ).map((award) => ({
        awardKey: award.awardKey,
        icon: award.icon,
        label: award.label,
        winner: awardWinnerDisplay(award.winner),
        detail: award.detail,
      }))
    : []
  const awardRows = applyManualAwardWinners(awardSnapshots.length > 0
    ? awardSnapshots.map((award) => ({
        awardKey: award.awardKey,
        icon: award.icon,
        label: award.label,
        winner: awardWinnerDisplay(award.winner),
        detail: award.detail,
      }))
    : fallbackAwardRows, effectiveAwardConfig?.manualWinners)
  const lottoJackpot = lottoAwardConfig.prizes['6'] + (lottoAwardConfig.rollover ? lottoAwardConfig.carryoverAmount : 0)
  const lottoAwardRows = lottoEntries.map((entry) => {
    const member = clubMembers.find((item) => item.userId === entry.userId)
    const name = member?.name ?? '회원'
    const player = round.players.find((item) => item.name === name)
    const selectedHoles = [
      ...entry.selectedHoles.par3,
      ...entry.selectedHoles.par4,
      ...entry.selectedHoles.par5,
    ].sort((a, b) => a - b)
    const hasScore = Boolean(player && lottoDraw?.drawStatus === 'COMPLETED' && lottoDraw.drawnScores)
    const hits = hasScore
      ? selectedHoles.filter((hole) => player!.strokes[hole - 1] === lottoDraw!.drawnScores?.[String(hole)]?.score).length
      : 0
    const prize = hasScore ? lottoPrizeForHits(hits, lottoAwardConfig, lottoJackpot) : 0
    return { name, hits, prize, hasScore }
  })
  const lottoAwardGroups = [3, 4, 5, 6]
    .map((hits) => ({
      hits,
      prize: hits === 6 ? lottoJackpot : lottoAwardConfig.prizes[String(hits) as '3' | '4' | '5'],
      names: lottoAwardRows
        .filter((row) => row.hasScore && row.hits === hits && row.prize > 0)
        .map((row) => shortName(row.name))
        .join(', '),
    }))
    .filter((group) => group.names)
  const moneyGame = round.settlement ? calcSettlement(round.settlement, round.pars, round.players) : null
  const moneyPairs = moneyGame
    ? moneyGame.participants.flatMap((from, index) => moneyGame.participants.slice(index + 1).map((to) => {
        const net = moneyGame.totals[from][to]
        if (net > 0) return { from, to, amount: net }
        if (net < 0) return { from: to, to: from, amount: -net }
        return { from, to, amount: 0 }
      }))
    : []
  return { awardRows, lottoAwardGroups, moneyGame, moneyPairs }
}
