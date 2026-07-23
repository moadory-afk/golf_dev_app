import { computeHandicaps, getHandicapsForRound, playerTotal, totalPar, type SavedRound } from './store'

export type GuinnessRecordChange = {
  key: string
  label: string
  holder: string
  previousValue: string | null
  newValue: string
}

function normalizeName(value?: string | null) {
  return (value ?? '').replace(/\s+/g, '').trim()
}

function winnerForRound(round: SavedRound, allRounds: SavedRound[]) {
  if (!round.players.length) return null
  const handicaps = getHandicapsForRound(round, allRounds)
  const medalScore = Math.min(...round.players.map((player) => playerTotal(player.strokes)))
  const medalWinner = round.players.find((player) => playerTotal(player.strokes) === medalScore)?.name
  const ranking = round.players
    .map((player) => ({ name: player.name, net: playerTotal(player.strokes) - (handicaps.get(player.name) ?? 0) }))
    .sort((a, b) => a.net - b.net)
  return ranking[0]?.name === medalWinner ? ranking[1]?.name ?? null : ranking[0]?.name ?? null
}

type SnapshotRow = { holder: string; value: number; display: string }
type Snapshot = Record<string, SnapshotRow | undefined>

function buildSnapshot(rounds: SavedRound[]): Snapshot {
  if (!rounds.length) return {}

  const snapshot: Snapshot = {}
  const sorted = [...rounds].sort((a, b) => a.date.localeCompare(b.date))

  const wins = new Map<string, number>()
  for (const round of sorted) {
    const winner = winnerForRound(round, rounds)
    if (winner) wins.set(winner, (wins.get(winner) ?? 0) + 1)
  }
  const topWins = [...wins.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topWins) snapshot.most_wins = { holder: topWins[0], value: topWins[1], display: `${topWins[1]}회` }

  let maxStreak = 0
  let maxStreakHolder = ''
  let currentHolder = ''
  let currentStreak = 0
  for (const round of sorted) {
    const winner = winnerForRound(round, rounds) ?? ''
    if (winner && normalizeName(winner) === normalizeName(currentHolder)) currentStreak += 1
    else {
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak
        maxStreakHolder = currentHolder
      }
      currentHolder = winner
      currentStreak = winner ? 1 : 0
    }
  }
  if (currentStreak > maxStreak) {
    maxStreak = currentStreak
    maxStreakHolder = currentHolder
  }
  if (maxStreakHolder) snapshot.win_streak = { holder: maxStreakHolder, value: maxStreak, display: `${maxStreak}연승` }

  const totalBirdies = new Map<string, number>()
  let singleBirdie: SnapshotRow | undefined
  let singlePar: SnapshotRow | undefined
  let lowestScore: SnapshotRow | undefined
  let highestScore: SnapshotRow | undefined
  let bestComeback: SnapshotRow | undefined

  for (const round of rounds) {
    for (const player of round.players) {
      const total = playerTotal(player.strokes)
      let birdies = 0
      let pars = 0
      player.strokes.forEach((score, index) => {
        const diff = score - (round.pars[index] ?? 0)
        if (diff <= -1) birdies += 1
        if (diff === 0) pars += 1
      })
      totalBirdies.set(player.name, (totalBirdies.get(player.name) ?? 0) + birdies)
      if (!singleBirdie || birdies > singleBirdie.value) singleBirdie = { holder: player.name, value: birdies, display: `${birdies}개` }
      if (!singlePar || pars > singlePar.value) singlePar = { holder: player.name, value: pars, display: `${pars}개` }
      if (!lowestScore || total < lowestScore.value) lowestScore = { holder: player.name, value: total, display: `${total}타` }
      if (!highestScore || total > highestScore.value) highestScore = { holder: player.name, value: total, display: `${total}타` }

      const front = player.strokes.slice(0, 9).reduce((sum, score) => sum + score, 0)
      const back = player.strokes.slice(9, 18).reduce((sum, score) => sum + score, 0)
      const improvement = front - back
      if (improvement > 0 && (!bestComeback || improvement > bestComeback.value)) {
        bestComeback = { holder: player.name, value: improvement, display: `${improvement}타 개선` }
      }
    }
  }

  const topBirdies = [...totalBirdies.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topBirdies) snapshot.total_birdies = { holder: topBirdies[0], value: topBirdies[1], display: `${topBirdies[1]}개` }
  if (singleBirdie?.value) snapshot.single_birdies = singleBirdie
  if (singlePar?.value) snapshot.single_pars = singlePar
  if (lowestScore) snapshot.lowest_score = lowestScore
  if (highestScore) snapshot.highest_score = highestScore
  if (bestComeback) snapshot.best_comeback = bestComeback

  const handicaps = computeHandicaps(rounds, 5)
  const bestHandicap = [...handicaps.entries()].sort((a, b) => a[1] - b[1])[0]
  if (bestHandicap) snapshot.best_handicap = {
    holder: bestHandicap[0],
    value: -bestHandicap[1],
    display: `${bestHandicap[1] > 0 ? '+' : ''}${bestHandicap[1]}`,
  }

  return snapshot
}

const LABELS: Record<string, string> = {
  most_wins: '최다 우승',
  win_streak: '최다 연속 우승',
  total_birdies: '최다 버디',
  single_birdies: '한 경기 최다 버디',
  single_pars: '한 경기 최다 파',
  lowest_score: '최저 스코어',
  highest_score: '최고 스코어',
  best_comeback: '전·후반 최다 개선',
  best_handicap: '최저 핸디캡',
}

export function findGuinnessChangesForRound(rounds: SavedRound[], targetRoundId: string): GuinnessRecordChange[] {
  const target = rounds.find((round) => round.id === targetRoundId)
  if (!target || !target.isComplete) return []

  const before = buildSnapshot(rounds.filter((round) => round.id !== targetRoundId))
  const after = buildSnapshot(rounds)

  return Object.keys(LABELS).flatMap((key) => {
    const previous = before[key]
    const next = after[key]
    if (!next) return []

    const holderChanged = normalizeName(previous?.holder) !== normalizeName(next.holder)
    const valueChanged = previous?.value !== next.value
    if (!holderChanged && !valueChanged) return []

    const targetParticipant = target.players.some((player) => normalizeName(player.name) === normalizeName(next.holder))
    if (!targetParticipant) return []

    return [{
      key,
      label: LABELS[key],
      holder: next.holder,
      previousValue: previous?.display ?? null,
      newValue: next.display,
    }]
  })
}
