import {
  playerTotal,
  totalPar,
  type PersonalRoundFir,
  type SavedRound,
} from '../../lib/store'

export interface PlayerRound {
  roundId: string
  date: string
  courseName: string
  total: number
  diff: number
  strokes: number[]
  pars: number[]
  front: number
  back: number
  birdie: number
  parCount: number
  bogey: number
  double: number
  triplePlus: number
}

type HoleScoreStats = {
  birdie: number
  par: number
  bogey: number
  double: number
  triplePlus: number
}

function scoreStats(strokes: number[], pars: number[]): HoleScoreStats {
  return strokes.reduce<HoleScoreStats>((stats, stroke, index) => {
    const diff = stroke - (pars[index] ?? 4)
    if (diff === -1) stats.birdie += 1
    else if (diff === 0) stats.par += 1
    else if (diff === 1) stats.bogey += 1
    else if (diff === 2) stats.double += 1
    else if (diff >= 3) stats.triplePlus += 1
    return stats
  }, { birdie: 0, par: 0, bogey: 0, double: 0, triplePlus: 0 })
}

export function buildPlayerRoundsByName(rounds: SavedRound[]): Map<string, PlayerRound[]> {
  const byName = new Map<string, PlayerRound[]>()
  for (const round of rounds) {
    const coursePar = totalPar(round.pars)
    for (const player of round.players) {
      const total = playerTotal(player.strokes)
      const stats = scoreStats(player.strokes, round.pars)
      const playerRounds = byName.get(player.name) ?? []
      playerRounds.push({
        roundId: round.id,
        date: round.date,
        courseName: round.courseName,
        total,
        diff: total - coursePar,
        strokes: player.strokes,
        pars: round.pars,
        front: player.strokes.slice(0, 9).reduce((sum, score) => sum + score, 0),
        back: player.strokes.slice(9, 18).reduce((sum, score) => sum + score, 0),
        birdie: stats.birdie,
        parCount: stats.par,
        bogey: stats.bogey,
        double: stats.double,
        triplePlus: stats.triplePlus,
      })
      byName.set(player.name, playerRounds)
    }
  }
  return byName
}

function normalizeRecordName(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, '').toLowerCase()
}

function decodeGogoParEmailName(value: string | null | undefined): string {
  const email = (value ?? '').trim()
  const match = email.match(/^([0-9a-f]{4,})@gogopar\.app$/i)
  if (!match) return ''
  const hex = match[1]
  try {
    const chars: string[] = []
    for (let index = 0; index < hex.length; index += 4) {
      const code = Number.parseInt(hex.slice(index, index + 4), 16)
      if (!Number.isFinite(code)) return ''
      chars.push(String.fromCharCode(code))
    }
    return chars.join('').trim()
  } catch {
    return ''
  }
}

export function resolvePersonalPlayerName(
  myName: string | null,
  byName: Map<string, PlayerRound[]>,
  scheduleMemberNames: string[] = [],
): string | null {
  if (byName.size === 0) return null

  const candidates = [
    myName,
    decodeGogoParEmailName(myName),
    ...scheduleMemberNames,
  ].filter((value): value is string => Boolean(value?.trim()))

  const names = [...byName.keys()]
  for (const candidate of candidates) {
    if (byName.has(candidate)) return candidate
    const normalized = normalizeRecordName(candidate)
    const matched = names.find((name) => normalizeRecordName(name) === normalized)
    if (matched) return matched
  }

  return null
}

export function firLabel(value: PersonalRoundFir) {
  if (value === 'center') return '중앙'
  if (value === 'long') return '롱'
  if (value === 'short') return '숏'
  if (value === 'left_ob') return '좌 OB'
  if (value === 'right_ob') return '우 OB'
  if (value === 'other_ob') return '기타 OB'
  if (value === 'hazard') return '해저드'
  return '미입력'
}
