import type { SettlementConfig } from '../lib/store'

export interface HoleResult {
  hole: number
  par: number
  isBaepan: boolean
  holeFee: number
  strokes: Record<string, number>
  birdies: string[]
  amounts: Record<string, Record<string, number>>
  strokeAmounts: Record<string, Record<string, number>>
  bonusAmounts: Record<string, Record<string, number>>
}

export interface SettlementResult {
  holes: HoleResult[]
  // totals[from][to] = net amount (positive = from owes to)
  totals: Record<string, Record<string, number>>
  participants: string[]
}

export function calcSettlement(
  config: SettlementConfig,
  pars: number[],
  allPlayers: Array<{ name: string; strokes: number[] }>
): SettlementResult {
  const players = allPlayers.filter((p) => config.participants.includes(p.name))
  const participants = players.map((p) => p.name)

  if (players.length < 2) return { holes: [], totals: {}, participants }

  const totals: Record<string, Record<string, number>> = {}
  for (const a of participants) {
    totals[a] = {}
    for (const b of participants) totals[a][b] = 0
  }

  const holes: HoleResult[] = []

  for (let h = 0; h < Math.min(18, pars.length); h++) {
    const par = pars[h]
    const strokes: Record<string, number> = {}
    for (const p of players) strokes[p.name] = p.strokes[h] ?? 0

    const cond = config.baepanConditions ?? { strokeOverpar: true, tie: true, birdie: false }

    // 배판 조건: 타수 오버파
    const baepanByScore = cond.strokeOverpar && players.some((p) => {
      const s = strokes[p.name]
      return par === 3 ? s >= par + 2 : s >= par + 3
    })

    // 배판 조건: 동타 (3명 이하 경기 → 2명이상, 4명 경기 → 3명이상)
    const strokeCounts = new Map<number, number>()
    for (const p of players) {
      const s = strokes[p.name]
      strokeCounts.set(s, (strokeCounts.get(s) ?? 0) + 1)
    }
    const tieThreshold = players.length >= 4 ? 3 : 2
    const baepanByTie = cond.tie && [...strokeCounts.values()].some((c) => c >= tieThreshold)

    // 배판 조건: 버디 이하
    const baepanByBirdie = cond.birdie && players.some((p) => strokes[p.name] <= par - 1)

    const isBaepan = baepanByScore || baepanByTie || baepanByBirdie
    const holeFee = config.strokeFee * (isBaepan ? 2 : 1)

    // 버디/이글 선수 (par-1 이하)
    const birdies = players.filter((p) => strokes[p.name] <= par - 1).map((p) => p.name)

    const amounts: Record<string, Record<string, number>> = {}
    const strokeAmounts: Record<string, Record<string, number>> = {}
    const bonusAmounts: Record<string, Record<string, number>> = {}
    for (const a of participants) {
      amounts[a] = {}; strokeAmounts[a] = {}; bonusAmounts[a] = {}
      for (const b of participants) { amounts[a][b] = 0; strokeAmounts[a][b] = 0; bonusAmounts[a][b] = 0 }
    }

    // 1:1 스트로크 정산 (타수 차 × 단가)
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const a = participants[i], b = participants[j]
        const diff = (strokes[a] - strokes[b]) * holeFee
        amounts[a][b] += diff; amounts[b][a] -= diff
        strokeAmounts[a][b] += diff; strokeAmounts[b][a] -= diff
        totals[a][b] += diff; totals[b][a] -= diff
      }
    }

    // 버디 보너스 (이글은 2배)
    for (const birdier of birdies) {
      const isEagle = strokes[birdier] <= par - 2
      const bonus = config.birdieBonus * (isEagle ? 2 : 1)
      for (const other of participants) {
        if (other === birdier) continue
        amounts[other][birdier] += bonus; amounts[birdier][other] -= bonus
        bonusAmounts[other][birdier] += bonus; bonusAmounts[birdier][other] -= bonus
        totals[other][birdier] += bonus; totals[birdier][other] -= bonus
      }
    }

    holes.push({ hole: h + 1, par, isBaepan, holeFee, strokes, birdies, amounts, strokeAmounts, bonusAmounts })
  }

  return { holes, totals, participants }
}

// 홀별 선수 순수익 (양수 = 획득, 음수 = 지출)
export function holeNetForPlayer(hole: HoleResult, player: string): number {
  const row = hole.amounts[player]
  if (!row) return 0
  return Object.values(row).reduce((sum, v) => sum - v, 0)
}

export function holeStrokeNetForPlayer(hole: HoleResult, player: string): number {
  const row = hole.strokeAmounts[player]
  if (!row) return 0
  return Object.values(row).reduce((sum, v) => sum - v, 0)
}

export function holeBonusNetForPlayer(hole: HoleResult, player: string): number {
  const row = hole.bonusAmounts[player]
  if (!row) return 0
  return Object.values(row).reduce((sum, v) => sum - v, 0)
}

export function fmtKRW(amount: number): string {
  return Math.abs(amount).toLocaleString('ko-KR') + '원'
}
