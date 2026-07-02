import { AWARD_CATEGORIES } from './awardConfig'
import { playerTotal, type SavedRound } from './store'

export type ClubAwardResult = {
  awardKey: string
  icon: string
  label: string
  winner: string
  detail: string
}

type AwardPlayer = SavedRound['players'][number]

export function computeClubAwardResult(
  id: string,
  round: SavedRound,
  handicaps: Map<string, number>,
  par: number,
  usedWinners?: Set<string>,
): ClubAwardResult | null {
  const def = AWARD_CATEGORIES.flatMap((category) => category.items).find((item) => item.id === id)
  if (!def) return null

  const players = round.players
  const getTotal = (player: AwardPlayer) => playerTotal(player.strokes)
  const sortAsc = (key: (player: AwardPlayer) => number) =>
    [...players].sort((a, b) => {
      const diff = key(a) - key(b)
      return diff !== 0 ? diff : getTotal(a) - getTotal(b)
    })
  const sortDesc = (key: (player: AwardPlayer) => number) =>
    [...players].sort((a, b) => {
      const diff = key(b) - key(a)
      return diff !== 0 ? diff : getTotal(a) - getTotal(b)
    })
  const countHoles = (player: AwardPlayer, cond: (diff: number) => boolean) =>
    player.strokes.filter((stroke, index) => cond(stroke - round.pars[index])).length
  const pickFrom = (list: AwardPlayer[], startIndex: number) => {
    for (let index = startIndex; index < list.length; index++) {
      if (!usedWinners?.has(list[index].name)) return list[index]
    }
    return undefined
  }
  const pickFirst = (list: AwardPlayer[]) => pickFrom(list, 0)
  const result = (player: AwardPlayer, detail: string): ClubAwardResult => ({
    awardKey: id,
    icon: def.icon,
    label: def.label,
    winner: player.name,
    detail,
  })
  const fmtVsPar = (net: number) => {
    const diff = net - par
    if (diff === 0) return 'Net E'
    return diff > 0 ? `Net +${diff}` : `Net ${diff}`
  }

  switch (id) {
    case 'medal': {
      const player = pickFirst(sortAsc(getTotal))
      return player ? result(player, `${getTotal(player)}타`) : null
    }
    case 'regular1':
    case 'regular2':
    case 'regular3': {
      const rank = Number(id.replace('regular', '')) - 1
      const player = pickFrom(sortAsc((p) => getTotal(p) - (handicaps.get(p.name) ?? 0)), rank)
      if (!player) return null
      return result(player, fmtVsPar(getTotal(player) - (handicaps.get(player.name) ?? 0)))
    }
    case 'shin1':
    case 'shin2': {
      if (!round.shinperioHoles.length) return null
      const rank = Number(id.replace('shin', '')) - 1
      const score = (player: AwardPlayer) =>
        player.strokes.reduce((sum, stroke, index) => sum + (round.shinperioHoles.includes(index + 1) ? stroke : round.pars[index]), 0)
      const player = pickFrom(sortAsc(score), rank)
      return player ? result(player, `${score(player)}타`) : null
    }
    case 'birdieKing': {
      const player = pickFirst(sortDesc((p) => countHoles(p, (diff) => diff <= -1)))
      if (!player) return null
      const count = countHoles(player, (diff) => diff <= -1)
      return count > 0 ? result(player, `${count}개`) : null
    }
    case 'eagleKing': {
      const player = pickFirst(sortDesc((p) => countHoles(p, (diff) => diff <= -2)))
      if (!player) return null
      const count = countHoles(player, (diff) => diff <= -2)
      return count > 0 ? result(player, `${count}개`) : null
    }
    case 'parKing': {
      const player = pickFirst(sortDesc((p) => countHoles(p, (diff) => diff === 0)))
      return player ? result(player, `${countHoles(player, (diff) => diff === 0)}개`) : null
    }
    case 'bogeyKing': {
      const player = pickFirst(sortDesc((p) => countHoles(p, (diff) => diff === 1)))
      return player ? result(player, `${countHoles(player, (diff) => diff === 1)}개`) : null
    }
    case 'doublePlus': {
      const player = pickFirst(sortDesc((p) => countHoles(p, (diff) => diff >= 2)))
      return player ? result(player, `${countHoles(player, (diff) => diff >= 2)}개`) : null
    }
    case 'last': {
      const best = sortAsc(getTotal)[0]
      const player = pickFirst(sortDesc(getTotal))
      return player && player.name !== best.name ? result(player, `${getTotal(player)}타`) : null
    }
    case 'fighter': {
      const player = pickFirst(sortDesc(getTotal))
      if (!player) return null
      const birdies = countHoles(player, (diff) => diff <= -1)
      return birdies > 0 ? result(player, `버디 ${birdies}개`) : null
    }
    case 'effort': {
      const player = pickFirst(sortDesc((p) => countHoles(p, (diff) => diff <= 0)))
      return player ? result(player, `파이하 ${countHoles(player, (diff) => diff <= 0)}개`) : null
    }
    case 'lucky':
    case 'bestDresser': {
      if (players.length === 0) return null
      const seed = round.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
      const startIndex = (seed + def.label.length) % players.length
      for (let offset = 0; offset < players.length; offset++) {
        const player = players[(startIndex + offset) % players.length]
        if (!usedWinners?.has(player.name)) return result(player, '추첨')
      }
      return result(players[startIndex], '추첨')
    }
    case 'longDrive':
    case 'nearPin':
      return { awardKey: id, icon: def.icon, label: def.label, winner: '미입력', detail: '현장 확인' }
    default:
      return null
  }
}

export function computeClubAwardResults(
  itemIds: string[],
  round: SavedRound,
  handicaps: Map<string, number>,
  par: number,
): ClubAwardResult[] {
  const usedWinners = new Set<string>()
  return itemIds
    .map((id) => {
      const result = computeClubAwardResult(id, round, handicaps, par, usedWinners)
      if (result && result.winner !== '미입력') usedWinners.add(result.winner)
      return result
    })
    .filter((result): result is ClubAwardResult => result !== null)
}
