import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Modal, Dimensions, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState, useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppHeader } from '../components/AppHeader'
import Svg, { Polyline, Circle, Line, Text as SvgText, G } from 'react-native-svg'
import { getRounds, getRound, playerTotal, totalPar, getHandicapsForRound, computeHandicaps, shortName, type SavedRound } from '../lib/store'
import { useClub } from '../lib/ClubContext'
import { useUserProfile } from '../lib/UserProfileContext'
import { useAsync } from '../lib/useAsync'
import { C } from '../theme'
import { EmojiIcon } from '../components/EmojiIcon'
import { Icon } from '../components/Icon'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Tab = 'byRound' | 'byPlayer' | 'club' | 'hall'
type RankingType = 'wins' | 'streak' | 'lowestHandicap' | 'birdie' | 'singleBirdie' | 'frontBack' | 'avgImprove' | 'handicapImprove' | 'singlePar' | 'roundsPlayed' | 'lowestScore' | 'highestScore'

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

function formatWinners(names: string[], value: string): string {
  if (names.length === 0) return '-'
  const label = names.length <= 3
    ? names.map(shortName).join(', ')
    : `${shortName(names[0])} 외 ${names.length - 1}명`
  return `${label} (${value})`
}

function holeStats(strokes: number[], pars: number[]) {
  let birdie = 0, par = 0, bogey = 0, dbl = 0, dblPlus = 0
  strokes.forEach((s, i) => {
    const d = s - pars[i]
    if (d <= -1) birdie++
    else if (d === 0) par++
    else if (d === 1) bogey++
    else if (d === 2) dbl++
    else dblPlus++
  })
  return { birdie, par, bogey, dbl, dblPlus }
}

function getWinnerLocal(r: SavedRound, handicaps: Map<string, number>): string | null {
  const best = Math.min(...r.players.map((p) => playerTotal(p.strokes)))
  const medalWinner = r.players.find((p) => playerTotal(p.strokes) === best)?.name
  const ranked = r.players
    .map((p) => ({ name: p.name, net: playerTotal(p.strokes) - (handicaps.get(p.name) ?? 0) }))
    .sort((a, b) => a.net - b.net)
  if (ranked[0]?.name === medalWinner) return ranked[1]?.name ?? null
  return ranked[0]?.name ?? null
}

interface Badge { icon: string; label: string }

function getPlayerBadges(rounds: SavedRound[], basis = 5): Map<string, Badge[]> {
  const badges = new Map<string, Badge[]>()
  const add = (name: string, icon: string, label: string) => {
    const arr = badges.get(name) ?? []
    arr.push({ icon, label })
    badges.set(name, arr)
  }

  let medalName = '', medalScore = Infinity
  for (const r of rounds)
    for (const p of r.players) {
      const t = playerTotal(p.strokes)
      if (t < medalScore) { medalScore = t; medalName = p.name }
    }
  if (medalName) add(medalName, '🏆', '메달리스트')

  const sorted = [...rounds].sort((a, b) => a.date.localeCompare(b.date))

  const winCount = new Map<string, number>()
  for (const r of sorted) {
    const w = getWinnerLocal(r, getHandicapsForRound(r, rounds, basis))
    if (w) winCount.set(w, (winCount.get(w) ?? 0) + 1)
  }
  let topWinName = '', topWinCount = 0
  for (const [n, c] of winCount) if (c > topWinCount) { topWinCount = c; topWinName = n }
  if (topWinName) add(topWinName, '🥇', '최다우승')

  const streakMap = new Map<string, number>()
  let curPlayer = '', curStreak = 0
  for (const r of sorted) {
    const w = getWinnerLocal(r, getHandicapsForRound(r, rounds, basis))
    if (w && w === curPlayer) {
      curStreak++
    } else {
      if (curPlayer && curStreak > 0)
        streakMap.set(curPlayer, Math.max(streakMap.get(curPlayer) ?? 0, curStreak))
      curPlayer = w ?? ''; curStreak = w ? 1 : 0
    }
  }
  if (curPlayer && curStreak > 0)
    streakMap.set(curPlayer, Math.max(streakMap.get(curPlayer) ?? 0, curStreak))
  let maxStreak = 0, maxStreakPlayer = ''
  for (const [n, st] of streakMap) if (st > maxStreak) { maxStreak = st; maxStreakPlayer = n }
  if (maxStreak >= 2 && maxStreakPlayer) add(maxStreakPlayer, '🔥', `${maxStreak}연승`)

  const birdieTotal = new Map<string, number>()
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ })
      birdieTotal.set(p.name, (birdieTotal.get(p.name) ?? 0) + b)
    }
  let topBirdieName = '', topBirdieCount = 0
  for (const [n, c] of birdieTotal) if (c > topBirdieCount) { topBirdieCount = c; topBirdieName = n }
  if (topBirdieName && topBirdieCount > 0) add(topBirdieName, '🐦', '버디왕')

  const singleBirdie = new Map<string, number>()
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ })
      singleBirdie.set(p.name, Math.max(singleBirdie.get(p.name) ?? 0, b))
    }
  let topSingleName = '', topSingleCount = 0
  for (const [n, c] of singleBirdie) if (c > topSingleCount) { topSingleCount = c; topSingleName = n }
  if (topSingleName && topSingleCount > 0) add(topSingleName, '⛳', '한경기버디')

  return badges
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const [tab, setTab] = useState<Tab>('byPlayer')
  const [refreshKey, setRefreshKey] = useState(0)
  const { name: myName } = useUserProfile()
  const [handicapBasis, setHandicapBasis] = useState(5)
  const { activeClub, clubsLoaded } = useClub()
  const { data, loading } = useAsync(
    () => (activeClub ? getRounds(activeClub.id) : Promise.resolve([])),
    [refreshKey, activeClub?.id],
  )
  const rounds = data ?? []
  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // 화면 포커스 복귀 시 자동 새로고침 (삭제/저장 후 즉시 반영)
  useFocusEffect(useCallback(() => { setRefreshKey((k) => k + 1) }, []))

  useEffect(() => {
    AsyncStorage.getItem('@gogopar_handicap_basis').then(v => {
      if (v === '3' || v === '5' || v === '10') setHandicapBasis(Number(v))
    })
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader myName={myName} />
      <View style={s.tabs}>
        {(['byPlayer', 'byRound', 'club', 'hall'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'byRound' ? '라운딩별' : t === 'byPlayer' ? '개인별' : t === 'club' ? '클럽 전체' : '명예의 전당'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.green} />}
      >
        {!clubsLoaded || loading ? (
          <Text style={s.muted}>데이터를 불러오는 중입니다.</Text>
        ) : (
          <>
            {tab === 'byRound' && <ByRound rounds={rounds} handicapBasis={handicapBasis} />}
            {tab === 'byRound' && activeClub && <AddRoundButton />}
            {tab === 'byPlayer' && <ByPlayer rounds={rounds} handicapBasis={handicapBasis} myName={myName} />}
            {tab === 'club' && <Club rounds={rounds} />}
            {tab === 'hall' && <HallOfFame rounds={rounds} handicapBasis={handicapBasis} />}
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ─── 라운딩별 ────────────────────────────────────────────────────────────────

function AddRoundButton() {
  const nav = useNavigation<Nav>()

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={s.addRoundCard}
      onPress={() => nav.navigate('RoundSetup', {})}
    >
      <View style={s.addRoundIcon}>
        <Icon name="plus" size={18} color={C.green} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.addRoundTitle}>라운드 추가</Text>
        <Text style={s.addRoundSub}>새 스코어와 시상 기록을 남겨보세요</Text>
      </View>
      <Icon name="chevronRight" size={19} color={C.muted} />
    </TouchableOpacity>
  )
}

function ByRound({ rounds, handicapBasis = 5 }: { rounds: SavedRound[]; handicapBasis?: number }) {
  const nav = useNavigation<Nav>()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  if (rounds.length === 0) return <Text style={s.muted}>아직 라운드 기록이 없습니다.</Text>

  const years = [...new Set(rounds.map((r) => Number(r.date.slice(0, 4))))].sort((a, b) => b - a)
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)
  const filtered = rounds
    .filter((r) => r.date.startsWith(String(year)))
    .sort((a, b) => {
      if (!a.isComplete && b.isComplete) return -1
      if (a.isComplete && !b.isComplete) return 1
      return b.date.localeCompare(a.date)
    })

  return (
    <>
      <View style={s.yearNav}>
        <TouchableOpacity
          style={[s.yearBtn, year <= minYear && { opacity: 0.35 }]}
          onPress={() => setYear((y) => y - 1)}
          disabled={year <= minYear}
        >
          <Text style={s.yearBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.yearText}>{year}년</Text>
        <TouchableOpacity
          style={[s.yearBtn, year >= maxYear && { opacity: 0.35 }]}
          onPress={() => setYear((y) => y + 1)}
          disabled={year >= maxYear}
        >
          <Text style={s.yearBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <Text style={s.muted}>{year}년 라운드 기록이 없습니다.</Text>
      ) : (
        filtered.map((r) => {
          const par = totalPar(r.pars)
          const totals = r.players.map((p) => playerTotal(p.strokes))
          const best = Math.min(...totals)
          const avg = Math.ceil(totals.reduce((a, b) => a + b, 0) / totals.length)
          const bestPlayer = r.players.find((p) => playerTotal(p.strokes) === best)
          const roundHandicaps = getHandicapsForRound(r, rounds, handicapBasis)
          const ranked = r.players
            .map((p) => {
              const handicap = roundHandicaps.get(p.name) ?? 0
              const net = playerTotal(p.strokes) - handicap
              return { name: p.name, net, netVsPar: net - par }
            })
            .sort((a, b) => a.netVsPar - b.netVsPar)
          const medalIsBestNet = bestPlayer?.name === ranked[0]?.name
          const winner = medalIsBestNet ? ranked[1] : ranked[0]
          const runnerUp = medalIsBestNet ? ranked[2] : ranked[1]

          const birdieTop = r.players
            .map((p) => { let b = 0; p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ }); return { name: p.name, count: b } })
            .sort((a, b) => b.count - a.count)[0]
          const parTop = r.players
            .map((p) => { let cnt = 0; p.strokes.forEach((s, i) => { if (s - r.pars[i] === 0) cnt++ }); return { name: p.name, count: cnt } })
            .sort((a, b) => b.count - a.count)[0]

          // 신기록 체크
          const priorRounds = rounds.filter((pr) => pr.date < r.date)
          const newRecords: { icon: string; text: string }[] = []
          if (priorRounds.length > 0) {
            // 최저타 갱신
            const priorBest = Math.min(...priorRounds.flatMap((pr) => pr.players.map((p) => playerTotal(p.strokes))))
            if (best < priorBest)
              newRecords.push({ icon: '🏆', text: `최저타 갱신 ${bestPlayer ? shortName(bestPlayer.name) : ''} ${best}타` })

            // 버디왕 갱신
            const priorMaxBirdie = Math.max(0, ...priorRounds.flatMap((pr) =>
              pr.players.map((p) => { let b = 0; p.strokes.forEach((s, i) => { if (s - pr.pars[i] <= -1) b++ }); return b })
            ))
            if (birdieTop && birdieTop.count > priorMaxBirdie)
              newRecords.push({ icon: '🐦', text: `버디왕 갱신 ${shortName(birdieTop.name)} ${birdieTop.count}개` })

            // 파왕 갱신
            const priorMaxPar = Math.max(0, ...priorRounds.flatMap((pr) =>
              pr.players.map((p) => { let cnt = 0; p.strokes.forEach((s, i) => { if (s - pr.pars[i] === 0) cnt++ }); return cnt })
            ))
            if (parTop && parTop.count > priorMaxPar)
              newRecords.push({ icon: '⛳', text: `파왕 갱신 ${shortName(parTop.name)} ${parTop.count}개` })

            // 최다우승 갱신
            const winsMap = new Map<string, number>()
            for (const pr of priorRounds) {
              const w = getWinnerLocal(pr, getHandicapsForRound(pr, rounds, handicapBasis))
              if (w) winsMap.set(w, (winsMap.get(w) ?? 0) + 1)
            }
            const priorMaxWins = Math.max(0, ...[...winsMap.values()])
            const thisWinner = getWinnerLocal(r, roundHandicaps)
            if (thisWinner) {
              const newWins = (winsMap.get(thisWinner) ?? 0) + 1
              if (newWins > priorMaxWins)
                newRecords.push({ icon: '🥇', text: `최다우승 갱신 ${shortName(thisWinner)} ${newWins}회` })
            }

            // 최저핸디 갱신: 클럽 역대 최저 핸디 갱신
            const priorHandiVals = priorRounds.flatMap((pr) =>
              pr.players.map((p) => {
                const rel = priorRounds
                  .filter((x) => x.date <= pr.date && x.players.some((pl) => pl.name === p.name))
                  .sort((a, b) => a.date.localeCompare(b.date)).slice(-handicapBasis)
                if (!rel.length) return Infinity
                return Math.ceil(rel.reduce((s, x) => {
                  const pl = x.players.find((y) => y.name === p.name)!
                  return s + (playerTotal(pl.strokes) - totalPar(x.pars))
                }, 0) / rel.length)
              })
            ).filter((h) => isFinite(h))
            const prevMinH = priorHandiVals.length ? Math.min(...priorHandiVals) : Infinity

            const afterHandis = r.players.map((p) => {
              const rel = rounds
                .filter((x) => x.date <= r.date && x.players.some((pl) => pl.name === p.name))
                .sort((a, b) => a.date.localeCompare(b.date)).slice(-handicapBasis)
              if (!rel.length) return { name: p.name, h: Infinity }
              return { name: p.name, h: Math.ceil(rel.reduce((s, x) => {
                const pl = x.players.find((y) => y.name === p.name)!
                return s + (playerTotal(pl.strokes) - totalPar(x.pars))
              }, 0) / rel.length) }
            })
            const finiteHandis = afterHandis.filter((x) => isFinite(x.h))
            if (finiteHandis.length > 0 && isFinite(prevMinH)) {
              const curMinH = Math.min(...finiteHandis.map((x) => x.h))
              if (curMinH < prevMinH) {
                const top = finiteHandis.find((x) => x.h === curMinH)!
                newRecords.push({ icon: '📉', text: `최저핸디 갱신 ${shortName(top.name)} ${top.h > 0 ? '+' : ''}${top.h}` })
              }
            }
          }

          return (
            <TouchableOpacity
              key={r.id}
              style={s.card}
              onPress={async () => {
                if (!r.isComplete) {
                  const full = await getRound(r.id)
                  if (full) {
                    nav.navigate('ScoreEntry', {
                      date: full.date,
                      courseName: full.courseName,
                      pars: full.pars,
                      golfCourseId: full.golfCourseId,
                      players: full.players,
                      editId: full.id,
                      settlement: full.settlement,
                    })
                  }
                } else {
                  nav.navigate('RoundDetail', { id: r.id })
                }
              }}
            >
              {/* 1행: 코스명 + 날짜 + 경기중 배지 */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={s.cardBold}>{r.courseName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {r.isComplete ? (
                    <View style={s.completeBadge}>
                      <Text style={s.completeText}>라운드 완료</Text>
                    </View>
                  ) : (
                    <View style={s.inProgressBadge}>
                      <Text style={s.inProgressText}>라운드 중</Text>
                    </View>
                  )}
                  <Text style={[s.muted, { fontSize: 12 }]}>{r.date.replace(/-/g, '.')}</Text>
                </View>
              </View>
              {/* 2행: 메달/우승/준우승 칩 */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {bestPlayer && (
                  <View style={[s.statChip, { backgroundColor: '#fffbe8' }]}>
                    <EmojiIcon char="🏆" size={12} color={C.gold} />
                    <Text style={s.statChipText}>{shortName(bestPlayer.name)} <Text style={{ color: C.gold }}>{best}</Text></Text>
                  </View>
                )}
                {winner && (
                  <View style={[s.statChip, { backgroundColor: C.greenLight }]}>
                    <EmojiIcon char="🥇" size={12} />
                    <Text style={s.statChipText}>{shortName(winner.name)} <Text style={{ color: C.green }}>{diffText(winner.netVsPar)}</Text></Text>
                  </View>
                )}
                {runnerUp && (
                  <View style={[s.statChip, { backgroundColor: '#f4f6f8' }]}>
                    <EmojiIcon char="🥈" size={12} />
                    <Text style={s.statChipText}>{shortName(runnerUp.name)} <Text style={{ color: C.muted }}>{diffText(runnerUp.netVsPar)}</Text></Text>
                  </View>
                )}
              </View>
              {/* 3행: 평균 + 신기록 또는 버디/파 */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <View style={[s.statChip, { backgroundColor: '#f0f5f2' }]}>
                  <Text style={s.statChipText}>평균 <Text style={{ fontWeight: '700', color: C.text }}>{avg}</Text></Text>
                </View>
                {newRecords.length > 0 ? (
                  newRecords.map((rec, i) => (
                    <View key={i} style={s.recordTag}>
                      <EmojiIcon char={rec.icon} size={12} color="#8a6000" />
                      <Text style={s.recordTagText}>{rec.text}</Text>
                    </View>
                  ))
                ) : (
                  <>
                    {birdieTop && birdieTop.count > 0 && (
                      <View style={[s.statChip, { backgroundColor: '#eff6ff' }]}>
                        <EmojiIcon char="🐦" size={12} color={C.info} />
                        <Text style={s.statChipText}>{shortName(birdieTop.name)} <Text style={{ color: C.info }}>{birdieTop.count}개</Text></Text>
                      </View>
                    )}
                    {parTop && parTop.count > 0 && (
                      <View style={[s.statChip, { backgroundColor: '#f0f5f2' }]}>
                        <EmojiIcon char="⛳" size={12} color={C.green} />
                        <Text style={s.statChipText}>{shortName(parTop.name)} <Text style={{ color: C.green }}>{parTop.count}개</Text></Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </TouchableOpacity>
          )
        })
      )}
    </>
  )
}

// ─── 개인별 ──────────────────────────────────────────────────────────────────

interface PlayerRound {
  roundId: string; date: string; courseName: string
  total: number; diff: number; strokes: number[]; pars: number[]
  front: number; back: number; birdie: number; parCount: number; bogey: number; double: number; triplePlus: number
}

function ByPlayer({ rounds, handicapBasis = 5, myName }: { rounds: SavedRound[]; handicapBasis?: number; myName: string | null }) {
  const [targetScore, setTargetScore] = useState('')
  const [detailModal, setDetailModal] = useState<'target' | 'trend' | 'hole' | 'score' | 'rank' | 'improve' | 'rounds' | null>(null)
  const byName = new Map<string, PlayerRound[]>()

  for (const r of rounds) {
    const coursePar = totalPar(r.pars)
    for (const p of r.players) {
      const total = playerTotal(p.strokes)
      const stats = holeStats(p.strokes, r.pars)
      const arr = byName.get(p.name) ?? []
      arr.push({
        roundId: r.id,
        date: r.date,
        courseName: r.courseName,
        total,
        diff: total - coursePar,
        strokes: p.strokes,
        pars: r.pars,
        front: p.strokes.slice(0, 9).reduce((sum, score) => sum + score, 0),
        back: p.strokes.slice(9, 18).reduce((sum, score) => sum + score, 0),
        birdie: stats.birdie,
        parCount: stats.par,
        bogey: stats.bogey,
        double: stats.dbl,
        triplePlus: stats.dblPlus,
      })
      byName.set(p.name, arr)
    }
  }

  const playerRounds = myName ? [...(byName.get(myName) ?? [])].sort((a, b) => b.date.localeCompare(a.date)) : []
  if (!myName || playerRounds.length === 0) return <Text style={s.muted}>내 개인 기록 데이터가 없습니다.</Text>

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
      ? `최근 흐름이 ${oldestRecent.total - latestRecent.total}타 개선됐습니다.`
      : latestRecent.total > oldestRecent.total
        ? `최근 흐름이 ${latestRecent.total - oldestRecent.total}타 높아졌습니다.`
        : '최근 흐름이 안정적으로 유지되고 있습니다.'
    : '최근 흐름을 분석할 기록이 부족합니다.'
  const parType = { 3: { total: 0, count: 0 }, 4: { total: 0, count: 0 }, 5: { total: 0, count: 0 } }
  const scoreTotals = { birdie: 0, par: 0, bogey: 0, double: 0, triplePlus: 0 }
  let frontTotal = 0, backTotal = 0
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
  const avgParType = (par: 3 | 4 | 5) => parType[par].count ? (parType[par].total / parType[par].count).toFixed(1) : '-'
  const frontAvg = Math.round(frontTotal / playerRounds.length)
  const backAvg = Math.round(backTotal / playerRounds.length)
  const parAverages = [
    { label: 'Par 3', value: Number(avgParType(3)) },
    { label: 'Par 4', value: Number(avgParType(4)) },
    { label: 'Par 5', value: Number(avgParType(5)) },
  ].filter((item) => !Number.isNaN(item.value))
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
  const rankOf = (items: typeof playerStats, key: 'avg' | 'handicap' | 'birdie', lowerBetter: boolean) => {
    const sorted = [...items].sort((a, b) => lowerBetter ? a[key] - b[key] : b[key] - a[key])
    return sorted.findIndex((item) => item.name === myName) + 1
  }
  const totalPlayers = playerStats.length
  const target = Number(targetScore.replace(/[^0-9]/g, ''))
  const targetGap = target ? avg - target : 0
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
      ? '더블 이상 홀이 많은 편이라 큰 실수를 줄이는 전략이 효과적입니다.'
      : '더블 이상 관리가 비교적 안정적입니다.',
  ]
  const improvementItems = [
    `1순위: ${weakness?.label ?? '취약 홀'}에서 안전한 공략으로 평균 타수를 낮추기`,
    `2순위: 후반 평균 ${backAvg}타를 전반 평균 ${frontAvg}타에 가깝게 만들기`,
    `3순위: 더블/트리플+ ${scoreTotals.double + scoreTotals.triplePlus}개를 줄이기`,
  ]

  const modalTitle = detailModal === 'target' ? '목표 설정'
    : detailModal === 'trend' ? '추이 분석'
      : detailModal === 'hole' ? '홀 유형별 평균'
        : detailModal === 'score' ? '스코어 분포'
          : detailModal === 'rank' ? '클럽 내 순위'
            : detailModal === 'improve' ? '개선 리포트'
              : '라운드별 상세'

  return (
    <>
      {detailModal && (
        <Modal transparent animationType="fade" onRequestClose={() => setDetailModal(null)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setDetailModal(null)}>
            <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{modalTitle}</Text>
                <TouchableOpacity style={s.closeBtn} onPress={() => setDetailModal(null)}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {detailModal === 'target' && (
                  <>
                    <View style={s.goalRow}>
                      <TextInput
                        style={s.goalInput}
                        value={targetScore}
                        onChangeText={(value) => setTargetScore(value.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder={`${Math.max(1, avg - 3)}`}
                        placeholderTextColor={C.muted}
                      />
                      <Text style={s.goalUnit}>타 목표</Text>
                    </View>
                    <Text style={s.insightText}>
                      {target ? (targetGap > 0 ? `현재 평균에서 ${targetGap}타를 줄이면 목표에 도달합니다.` : '현재 평균이 목표 수준에 도달했습니다.') : '목표 타수를 입력하면 현재 평균과 비교합니다.'}
                    </Text>
                  </>
                )}
                {detailModal === 'trend' && (
                  <>
                    <Text style={s.insightText}>{trendText}</Text>
                    <View style={s.miniTrendRow}>
                      {[...playerRounds].sort((a, b) => a.date.localeCompare(b.date)).slice(-6).map((round) => (
                        <View key={round.roundId} style={s.miniTrendItem}>
                          <Text style={s.miniTrendValue}>{round.total}</Text>
                          <View style={[s.miniTrendBar, { height: Math.max(18, 72 - (round.total - best) * 2) }]} />
                          <Text style={s.miniTrendDate}>{round.date.slice(5)}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>최근 5경기 평균</Text><Text style={s.analysisValue}>{recent5Avg}타</Text></View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>전후반 차이</Text><Text style={s.analysisValue}>{diffText(backAvg - frontAvg)}타</Text></View>
                  </>
                )}
                {detailModal === 'hole' && (
                  <>
                    <View style={s.metricGrid}>
                      <MetricCard label="Par 3" value={`${avgParType(3)}타`} />
                      <MetricCard label="Par 4" value={`${avgParType(4)}타`} />
                      <MetricCard label="Par 5" value={`${avgParType(5)}타`} />
                    </View>
                    {strength && weakness && <Text style={s.insightText}>강점은 {strength.label}, 보완 포인트는 {weakness.label}입니다.</Text>}
                  </>
                )}
                {detailModal === 'score' && (
                  <View style={s.scoreDistRow}>
                    <ScoreDist label="버디" value={scoreTotals.birdie} color={C.info} />
                    <ScoreDist label="파" value={scoreTotals.par} color={C.green} />
                    <ScoreDist label="보기" value={scoreTotals.bogey} color={C.warn} />
                    <ScoreDist label="더블" value={scoreTotals.double} color={C.danger} />
                    <ScoreDist label="트리플+" value={scoreTotals.triplePlus} color={C.text} />
                  </View>
                )}
                {detailModal === 'rank' && (
                  <>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>평균 순위</Text><Text style={s.analysisValue}>{rankOf(playerStats, 'avg', true)} / {totalPlayers}</Text></View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>핸디 순위</Text><Text style={s.analysisValue}>{rankOf(playerStats, 'handicap', true)} / {totalPlayers}</Text></View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>버디 순위</Text><Text style={s.analysisValue}>{rankOf(playerStats, 'birdie', false)} / {totalPlayers}</Text></View>
                  </>
                )}
                {detailModal === 'improve' && improvementItems.map((item) => (
                  <BulletText key={item} text={item} />
                ))}
                {detailModal === 'rounds' && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <View style={s.tableHeader}>
                        {['날짜', '코스', '총타', '파대비', '전반', '후반', 'B/P/Bg/D/T+'].map((header, index) => (
                          <Text key={header} style={[s.th, { width: [54, 82, 42, 52, 42, 42, 92][index], textAlign: index >= 2 ? 'right' : 'left' }]}>{header}</Text>
                        ))}
                      </View>
                      {playerRounds.map((round) => (
                        <View key={round.roundId} style={s.tableRow}>
                          <Text style={[s.td, { width: 54 }]}>{round.date.slice(5)}</Text>
                          <Text style={[s.td, { width: 82 }]} numberOfLines={1}>{round.courseName.slice(0, 7)}</Text>
                          <Text style={[s.td, { width: 42, textAlign: 'right', fontWeight: '700' }]}>{round.total}</Text>
                          <Text style={[s.td, { width: 52, textAlign: 'right', color: round.diff <= 0 ? C.green : C.warn }]}>{diffText(round.diff)}</Text>
                          <Text style={[s.td, { width: 42, textAlign: 'right' }]}>{round.front}</Text>
                          <Text style={[s.td, { width: 42, textAlign: 'right' }]}>{round.back}</Text>
                          <Text style={[s.td, { width: 92, textAlign: 'right' }]}>{round.birdie}/{round.parCount}/{round.bogey}/{round.double}/{round.triplePlus}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <View style={s.metricGridCompact}>
        <MetricCard label="평균" value={`${avg}타`} />
        <MetricCard label="핸디" value={diffText(handicap)} />
        <MetricCard label="베스트" value={`${best}타`} tone={C.gold} />
        <MetricCard label="최근5" value={`${recent5Avg}타`} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>AI 코멘트</Text>
        {aiComments.slice(0, 2).map((comment) => (
          <BulletText key={comment} text={comment} />
        ))}
      </View>

      <View style={s.detailGrid}>
        <DetailButton label="목표 설정" onPress={() => setDetailModal('target')} />
        <DetailButton label="추이 분석" onPress={() => setDetailModal('trend')} />
        <DetailButton label="홀 유형" onPress={() => setDetailModal('hole')} />
        <DetailButton label="스코어 분포" onPress={() => setDetailModal('score')} />
        <DetailButton label="클럽 순위" onPress={() => setDetailModal('rank')} />
        <DetailButton label="개선 리포트" onPress={() => setDetailModal('improve')} />
        <DetailButton label="라운드 상세" onPress={() => setDetailModal('rounds')} />
      </View>
    </>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  )
}

function ScoreDist({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.scoreDistItem}>
      <Text style={[s.scoreDistValue, { color }]}>{value}</Text>
      <Text style={s.scoreDistLabel}>{label}</Text>
    </View>
  )
}

function BulletText({ text }: { text: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  )
}

function DetailButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.detailButton} activeOpacity={0.82} onPress={onPress}>
      <Text style={s.detailButtonText}>{label}</Text>
      <Text style={s.detailButtonArrow}>›</Text>
    </TouchableOpacity>
  )
}

// ─── 클럽 전체 ───────────────────────────────────────────────────────────────

function Club({ rounds }: { rounds: SavedRound[] }) {
  const [showChart, setShowChart] = useState<'avg' | 'best' | false>(false)
  const [handicapBasis, setHandicapBasis] = useState<3 | 5 | 10>(5)
  const [showBasisDropdown, setShowBasisDropdown] = useState(false)
  useEffect(() => {
    AsyncStorage.getItem('@gogopar_handicap_basis').then(v => {
      if (v === '3' || v === '5' || v === '10') setHandicapBasis(Number(v) as 3 | 5 | 10)
    })
  }, [])

  if (rounds.length === 0) return <Text style={s.muted}>데이터가 없습니다.</Text>

  let bestRecord: { name: string; date: string; courseName: string; total: number } | null = null
  for (const r of rounds)
    for (const p of r.players) {
      const t = playerTotal(p.strokes)
      if (!bestRecord || t < bestRecord.total)
        bestRecord = { name: p.name, date: r.date, courseName: r.courseName, total: t }
    }

  const byName = new Map<string, Array<{ date: string; total: number; par: number }>>()
  for (const r of rounds) {
    const par = totalPar(r.pars)
    for (const p of r.players) {
      const arr = byName.get(p.name) ?? []
      arr.push({ date: r.date, total: playerTotal(p.strokes), par })
      byName.set(p.name, arr)
    }
  }

  const stats = Array.from(byName.entries())
    .map(([name, entries]) => {
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
      const totals = sorted.map((e) => e.total)
      const lastN = sorted.slice(-handicapBasis)
      const handicap = Math.ceil(lastN.reduce((sum, e) => sum + (e.total - e.par), 0) / lastN.length)
      return {
        name, rounds: totals.length,
        avg: Math.ceil(totals.reduce((a, b) => a + b, 0) / totals.length),
        worst: Math.max(...totals),
        best: Math.min(...totals),
        handicap,
      }
    })
    .sort((a, b) => a.avg - b.avg)

  const totalAttendance = rounds.reduce((sum, r) => sum + r.players.length, 0)
  const clubAvg = Math.ceil(
    stats.reduce((a, st) => a + st.avg * st.rounds, 0) /
    stats.reduce((a, st) => a + st.rounds, 0)
  )

  const roundAvgs = [...rounds]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      value: Math.ceil(r.players.reduce((sum, p) => sum + playerTotal(p.strokes), 0) / r.players.length),
    }))

  const bestByRound = [...rounds]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      value: Math.min(...r.players.map((p) => playerTotal(p.strokes))),
    }))

  return (
    <>
      {showChart === 'avg' && (
        <TrendModal title="클럽 평균 추이" data={roundAvgs} onClose={() => setShowChart(false)} />
      )}
      {showChart === 'best' && (
        <TrendModal title="최저타 추이" data={bestByRound} onClose={() => setShowChart(false)} />
      )}

      <View style={s.card}>
        <Text style={s.cardTitle}>통합 통계</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* 총 라운드 */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>{rounds.length}</Text>
            <Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>총 라운드</Text>
          </View>
          {/* 연인원 */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>{totalAttendance}</Text>
            <Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>연인원</Text>
          </View>
          {/* 클럽 평균 */}
          <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => setShowChart('avg')}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: C.green }}>{clubAvg}</Text>
            <Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>클럽 평균</Text>
          </TouchableOpacity>
          {/* 최저타 */}
          {bestRecord && (
            <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => setShowChart('best')}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>{bestRecord.total}</Text>
              <Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>최저타</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, zIndex: 99 }}>
          <Text style={[s.cardTitle, { marginBottom: 0 }]}>클럽 랭킹</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 99 }}>
            <Text style={{ fontSize: 12, color: C.muted, fontWeight: '600' }}>핸디</Text>
            <View>
              <TouchableOpacity
                onPress={() => setShowBasisDropdown(v => !v)}
                style={s.dropdownTrigger}
              >
                <Text style={s.dropdownTriggerText}>{handicapBasis}경기 ▾</Text>
              </TouchableOpacity>
              {showBasisDropdown && (
                <View style={s.dropdownMenu}>
                  {([3, 5, 10] as const).map((n) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => { setHandicapBasis(n); setShowBasisDropdown(false) }}
                      style={s.dropdownItem}
                    >
                      <Text style={[s.dropdownItemText, handicapBasis === n && s.dropdownItemActive]}>
                        {n}경기{handicapBasis === n ? ' ✓' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={s.tableHeader}>
          <Text style={[s.th, { flex: 0.6 }]}>순위</Text>
          <Text style={[s.th, { flex: 2 }]}>이름</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>경기</Text>
          <Text style={[s.th, { flex: 1.2, textAlign: 'center' }]}>평균</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>최고</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>최저</Text>
          <Text style={[s.th, { flex: 1.2, textAlign: 'center' }]}>핸디</Text>
        </View>
        {stats.map((stat, i) => {
          const medalBg = ['#fffbe8', '#f4f6f8', '#fdf5f0']
          const isMedal = i < 3
          return (
            <View key={stat.name} style={[s.tableRow, { alignItems: 'center' }, i < 3 && { backgroundColor: medalBg[i], borderRadius: 8, marginBottom: 2 }]}>
              <View style={{ flex: 0.6, alignItems: 'center' }}>{isMedal ? <EmojiIcon char={['🥇','🥈','🥉'][i]} size={17} /> : <Text style={[s.td, { fontSize: 13 }]}>{i + 1}</Text>}</View>
              <Text style={[s.td, { flex: 2, fontWeight: i < 3 ? '700' : '400' }]}>{shortName(stat.name)}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{stat.rounds}</Text>
              <Text style={[s.td, { flex: 1.2, textAlign: 'center', fontWeight: '700', color: i === 0 ? C.gold : C.text }]}>{stat.avg}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{stat.worst}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{stat.best}</Text>
              <Text style={[s.td, {
                flex: 1.2, textAlign: 'center', fontWeight: '600',
                color: stat.handicap > 0 ? C.warn : stat.handicap < 0 ? C.info : C.text,
              }]}>
                {stat.handicap > 0 ? `+${stat.handicap}` : `${stat.handicap}`}
              </Text>
            </View>
          )
        })}
      </View>
    </>
  )
}

// ─── 명예의 전당 ─────────────────────────────────────────────────────────────

function HallOfFame({ rounds, handicapBasis }: { rounds: SavedRound[]; handicapBasis: number }) {
  const [rankingType, setRankingType] = useState<RankingType | null>(null)

  if (rounds.length === 0) return <Text style={s.muted}>명예의 전당 데이터가 없습니다.</Text>

  const avgOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const handicaps = computeHandicaps(rounds, handicapBasis)
  const sortedRounds = [...rounds].sort((a, b) => a.date.localeCompare(b.date))
  const winCount = new Map<string, number>()
  for (const r of sortedRounds) {
    const w = getWinnerLocal(r, getHandicapsForRound(r, rounds, handicapBasis))
    if (w) winCount.set(w, (winCount.get(w) ?? 0) + 1)
  }
  const winRanking = [...winCount.entries()].map(([name, wins]) => ({ name, wins })).sort((a, b) => b.wins - a.wins)

  let maxStreak = 0, maxStreakPlayer = '', curStreak = 0, curPlayer = ''
  for (const r of sortedRounds) {
    const w = getWinnerLocal(r, getHandicapsForRound(r, rounds, handicapBasis))
    if (w && w === curPlayer) curStreak++
    else {
      if (curStreak > maxStreak) { maxStreak = curStreak; maxStreakPlayer = curPlayer }
      curPlayer = w ?? ''; curStreak = w ? 1 : 0
    }
  }
  if (curStreak > maxStreak) { maxStreak = curStreak; maxStreakPlayer = curPlayer }

  const birdieCount = new Map<string, number>()
  const singleBirdieMap = new Map<string, { count: number; date: string; courseName: string }>()
  const singleParMap = new Map<string, { count: number; date: string; courseName: string }>()
  const scoreRecords: { name: string; total: number; date: string; courseName: string }[] = []
  for (const r of rounds) {
    for (const p of r.players) {
      let b = 0
      let parCount = 0
      p.strokes.forEach((strokes, i) => {
        const diff = strokes - r.pars[i]
        if (diff <= -1) b++
        if (diff === 0) parCount++
      })
      birdieCount.set(p.name, (birdieCount.get(p.name) ?? 0) + b)
      const prev = singleBirdieMap.get(p.name)
      if (!prev || b > prev.count) singleBirdieMap.set(p.name, { count: b, date: r.date, courseName: r.courseName })
      const prevPar = singleParMap.get(p.name)
      if (!prevPar || parCount > prevPar.count) singleParMap.set(p.name, { count: parCount, date: r.date, courseName: r.courseName })
      scoreRecords.push({ name: p.name, total: playerTotal(p.strokes), date: r.date, courseName: r.courseName })
    }
  }
  const birdieRanking = [...birdieCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  const singleBirdieRanking = [...singleBirdieMap.entries()].map(([name, v]) => ({ name, ...v })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)
  const singleParRanking = [...singleParMap.entries()].map(([name, v]) => ({ name, ...v })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)
  const handicapRanking = [...handicaps.entries()].sort((a, b) => a[1] - b[1]).map(([name, handicap]) => ({ name, handicap }))
  const lowestScoreRanking = [...scoreRecords].sort((a, b) => a.total - b.total)
  const highestScoreRanking = [...scoreRecords].sort((a, b) => b.total - a.total)

  const playerRounds = new Map<string, { date: string; total: number; diff: number }[]>()
  const frontBackRanking: { name: string; improvement: number; front: number; back: number; date: string; courseName: string }[] = []
  for (const r of rounds) {
    const coursePar = totalPar(r.pars)
    for (const p of r.players) {
      const total = playerTotal(p.strokes)
      const list = playerRounds.get(p.name) ?? []
      list.push({ date: r.date, total, diff: total - coursePar })
      playerRounds.set(p.name, list)

      const front = p.strokes.slice(0, 9).reduce((sum, score) => sum + score, 0)
      const back = p.strokes.slice(9, 18).reduce((sum, score) => sum + score, 0)
      frontBackRanking.push({ name: p.name, improvement: front - back, front, back, date: r.date, courseName: r.courseName })
    }
  }
  const frontBackImprovementRanking = frontBackRanking.filter((r) => r.improvement > 0).sort((a, b) => b.improvement - a.improvement)

  const avgImproveRanking = [...playerRounds.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
      if (sorted.length < 10) return null
      const past7 = sorted.slice(-10, -3).map((r) => r.total)
      const recent3 = sorted.slice(-3).map((r) => r.total)
      const pastAvg = Math.round(avgOf(past7))
      const recentAvg = Math.round(avgOf(recent3))
      return { name, improvement: pastAvg - recentAvg, pastAvg, recentAvg }
    })
    .filter((row): row is { name: string; improvement: number; pastAvg: number; recentAvg: number } => row !== null)
    .filter((row) => row.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)

  const handicapImproveRanking = [...playerRounds.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
      if (sorted.length < handicapBasis * 2) return null
      const pastHandicap = Math.ceil(avgOf(sorted.slice(0, handicapBasis).map((r) => r.diff)))
      const recentHandicap = Math.ceil(avgOf(sorted.slice(-handicapBasis).map((r) => r.diff)))
      return { name, improvement: pastHandicap - recentHandicap, pastHandicap, recentHandicap }
    })
    .filter((row): row is { name: string; improvement: number; pastHandicap: number; recentHandicap: number } => row !== null)
    .filter((row) => row.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)

  const topWinner = winRanking[0]
  const mostWinsText = topWinner ? formatWinners(winRanking.filter((r) => r.wins === topWinner.wins).map((r) => r.name), `${topWinner.wins}회`) : '-'
  const lowestHandicapEntry = handicapRanking[0]
  const lowestHandiText = lowestHandicapEntry ? formatWinners(handicapRanking.filter((r) => r.handicap === lowestHandicapEntry.handicap).map((r) => r.name), diffText(lowestHandicapEntry.handicap)) : '-'
  const topBirdie = birdieRanking[0]
  const topBirdieText = topBirdie && topBirdie.count > 0 ? formatWinners(birdieRanking.filter((r) => r.count === topBirdie.count).map((r) => r.name), `${topBirdie.count}개`) : '-'
  const topSingleBirdie = singleBirdieRanking[0]
  const topSingleBirdieText = topSingleBirdie ? formatWinners(singleBirdieRanking.filter((r) => r.count === topSingleBirdie.count).map((r) => r.name), `${topSingleBirdie.count}개`) : '-'
  const topSinglePar = singleParRanking[0]
  const topSingleParText = topSinglePar ? formatWinners(singleParRanking.filter((r) => r.count === topSinglePar.count).map((r) => r.name), `${topSinglePar.count}개`) : '-'
  const topRoundsPlayed = [...playerRounds.entries()].map(([name, list]) => ({ name, count: list.length })).sort((a, b) => b.count - a.count)[0]
  const roundsPlayedText = topRoundsPlayed ? formatWinners([...playerRounds.entries()].filter(([, list]) => list.length === topRoundsPlayed.count).map(([name]) => name), `${topRoundsPlayed.count}회`) : '-'
  const topLowestScore = lowestScoreRanking[0]
  const lowestScoreText = topLowestScore ? formatWinners(lowestScoreRanking.filter((r) => r.total === topLowestScore.total).map((r) => r.name), `${topLowestScore.total}타`) : '-'
  const topHighestScore = highestScoreRanking[0]
  const highestScoreText = topHighestScore ? formatWinners(highestScoreRanking.filter((r) => r.total === topHighestScore.total).map((r) => r.name), `${topHighestScore.total}타`) : '-'
  const topFrontBack = frontBackImprovementRanking[0]
  const topFrontBackText = topFrontBack ? `${shortName(topFrontBack.name)} (${topFrontBack.improvement}타 개선)` : '-'
  const topAvgImprove = avgImproveRanking[0]
  const topAvgImproveText = topAvgImprove && topAvgImprove.improvement > 0 ? `${shortName(topAvgImprove.name)} (${topAvgImprove.improvement}타 개선)` : '-'
  const topHandicapImprove = handicapImproveRanking[0]
  const topHandicapImproveText = topHandicapImprove && topHandicapImprove.improvement > 0 ? `${shortName(topHandicapImprove.name)} (${topHandicapImprove.improvement}타 개선)` : '-'

  const rankingConfig: Record<RankingType, { title: string; col: string; rows: { name: string; value: string; sub?: string }[] }> = {
    wins: { title: '최다 우승', col: '우승 횟수', rows: winRanking.map((r) => ({ name: shortName(r.name), value: `${r.wins}회` })) },
    streak: { title: '최다 연속 우승', col: '연속', rows: maxStreak > 0 ? [{ name: shortName(maxStreakPlayer), value: `${maxStreak}연승` }] : [] },
    lowestHandicap: { title: `핸디캡 랭킹 (최근 ${handicapBasis}경기)`, col: '핸디', rows: handicapRanking.map((r) => ({ name: shortName(r.name), value: diffText(r.handicap) })) },
    birdie: { title: '버디왕 (전체)', col: '버디 수', rows: birdieRanking.map((r) => ({ name: shortName(r.name), value: `${r.count}개` })) },
    singleBirdie: { title: '버디왕 (1경기)', col: '버디 수', rows: singleBirdieRanking.map((r) => ({ name: shortName(r.name), value: `${r.count}개`, sub: `${r.date.slice(5)} ${r.courseName}` })) },
    singlePar: { title: '파왕 (1경기)', col: '파 수', rows: singleParRanking.map((r) => ({ name: shortName(r.name), value: `${r.count}개`, sub: `${r.date.slice(5)} ${r.courseName}` })) },
    roundsPlayed: { title: '최다 라운드 참가', col: '참가', rows: [...playerRounds.entries()].map(([name, list]) => ({ name: shortName(name), value: `${list.length}회` })).sort((a, b) => Number(b.value.replace('회', '')) - Number(a.value.replace('회', ''))) },
    lowestScore: { title: '최저타', col: '스코어', rows: lowestScoreRanking.map((r) => ({ name: shortName(r.name), value: `${r.total}타`, sub: `${r.date.slice(5)} ${r.courseName}` })) },
    highestScore: { title: '최고타', col: '스코어', rows: highestScoreRanking.map((r) => ({ name: shortName(r.name), value: `${r.total}타`, sub: `${r.date.slice(5)} ${r.courseName}` })) },
    frontBack: {
      title: '전반 대비 후반 개선 최대',
      col: '개선',
      rows: frontBackImprovementRanking.map((r) => ({ name: shortName(r.name), value: `${r.improvement}타`, sub: `${r.date.slice(5)} ${r.courseName} · 전반 ${r.front} / 후반 ${r.back}` })),
    },
    avgImprove: {
      title: '최대 평균타 개선',
      col: '개선',
      rows: avgImproveRanking.map((r) => ({ name: shortName(r.name), value: `${r.improvement}타`, sub: `과거7 ${r.pastAvg}타 → 최근3 ${r.recentAvg}타` })),
    },
    handicapImprove: {
      title: '최대 핸디 개선',
      col: '개선',
      rows: handicapImproveRanking.map((r) => ({ name: shortName(r.name), value: `${r.improvement}타`, sub: `초기 ${diffText(r.pastHandicap)} → 최근 ${diffText(r.recentHandicap)}` })),
    },
  }
  const highlightSections = [
    {
      title: '우승 기록',
      items: [
        { icon: '🏅', label: '최다 우승', value: mostWinsText, type: 'wins' as RankingType },
        { icon: '🔥', label: '최다 연속 우승', value: maxStreak > 0 ? `${shortName(maxStreakPlayer)} (${maxStreak}연승)` : '-', type: 'streak' as RankingType },
      ],
    },
    {
      title: '스코어 기록',
      items: [
        { icon: '🏆', label: '최저타', value: lowestScoreText, type: 'lowestScore' as RankingType },
        { icon: '📈', label: '최고타', value: highestScoreText, type: 'highestScore' as RankingType },
        { icon: '🐦', label: '버디왕 (전체)', value: topBirdieText, type: 'birdie' as RankingType },
        { icon: '⛳', label: '버디왕 (1경기)', value: topSingleBirdieText, type: 'singleBirdie' as RankingType },
        { icon: '◎', label: '파왕 (1경기)', value: topSingleParText, type: 'singlePar' as RankingType },
      ],
    },
    {
      title: '성장 기록',
      items: [
        { icon: '📉', label: '최저 핸디', value: lowestHandiText, type: 'lowestHandicap' as RankingType },
        { icon: '↘️', label: '전후반 개선', value: topFrontBackText, type: 'frontBack' as RankingType },
        { icon: '📊', label: '평균타 개선', value: topAvgImproveText, type: 'avgImprove' as RankingType },
        { icon: '🪄', label: '핸디 개선', value: topHandicapImproveText, type: 'handicapImprove' as RankingType },
      ],
    },
    {
      title: '참가 기록',
      items: [
        { icon: '🗓️', label: '최다 라운드 참가', value: roundsPlayedText, type: 'roundsPlayed' as RankingType },
      ],
    },
  ]

  return (
    <>
      {rankingType && <RankingModal config={rankingConfig[rankingType]} onClose={() => setRankingType(null)} />}
      <View style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <Icon name="trophy" size={16} color={C.text} />
          <Text style={[s.cardTitle, { marginBottom: 0 }]}>명예의 전당</Text>
        </View>
        {highlightSections.map((section) => (
          <View key={section.title} style={s.hallSection}>
            <Text style={s.hallSectionTitle}>{section.title}</Text>
            {section.items.map(({ icon, label, value, type }) => (
              <TouchableOpacity key={label} style={s.hallRow} onPress={() => setRankingType(type)}>
                <View style={s.hallIconWrap}><EmojiIcon char={icon} size={15} color={C.green} /></View>
                <Text style={s.hallLabel}>{label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={s.hallValue}>{value}</Text>
                  <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </>
  )
}

function RankingModal({ config, onClose }: {
  config: { title: string; col: string; rows: { name: string; value: string; sub?: string }[] }
  onClose: () => void
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{config.title}</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
          </View>
          <ScrollView>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 0.6 }]}>순위</Text>
              <Text style={[s.th, { flex: 2.5 }]}>플레이어</Text>
              <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>{config.col}</Text>
            </View>
            {config.rows.length === 0 ? (
              <Text style={[s.muted, { padding: 16, textAlign: 'center' }]}>데이터 없음</Text>
            ) : config.rows.map((row, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={[s.td, { flex: 0.6, textAlign: 'center' }]}>{i + 1}</Text>
                <View style={{ flex: 2.5 }}>
                  <Text style={[s.td, { fontWeight: i < 3 ? '700' : '500' }]}>{row.name}</Text>
                  {row.sub && <Text style={{ fontSize: 11, color: C.muted }}>{row.sub}</Text>}
                </View>
                <Text style={[s.td, { flex: 1.5, textAlign: 'right', fontWeight: '700' }]}>{row.value}</Text>
              </View>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── SVG 추이 모달 ───────────────────────────────────────────────────────────

function TrendModal({ title, data, onClose }: {
  title: string; data: { date: string; value: number }[]; onClose: () => void
}) {
  if (data.length === 0) return null

  const W = Dimensions.get('window').width * 0.88 - 40
  const H = 130
  const PAD = { t: 20, r: 12, b: 30, l: 40 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  const vals = data.map((d) => d.value)
  const minV = Math.min(...vals) - 3
  const maxV = Math.max(...vals) + 3
  const span = maxV - minV

  const cx = (i: number) => PAD.l + (data.length > 1 ? i / (data.length - 1) : 0.5) * chartW
  const cy = (v: number) => PAD.t + (1 - (v - minV) / span) * chartH
  const polyPoints = data.map((d, i) => `${cx(i)},${cy(d.value)}`).join(' ')

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
          <Svg width={W} height={H}>
            {[0, 0.5, 1].map((t, idx) => {
              const yv = PAD.t + t * chartH
              const label = String(Math.round(maxV - t * span))
              return (
                <G key={idx}>
                  <Line x1={PAD.l} y1={yv} x2={W - PAD.r} y2={yv} stroke={C.border} strokeWidth={0.8} />
                  <SvgText x={PAD.l - 4} y={yv + 4} textAnchor="end" fontSize={9} fill="#888">{label}</SvgText>
                </G>
              )
            })}
            {data.length > 1 && (
              <Polyline fill="none" stroke={C.green} strokeWidth={2} strokeLinejoin="round" points={polyPoints} />
            )}
            {data.map((d, i) => (
              <G key={i}>
                <Circle cx={cx(i)} cy={cy(d.value)} r={3} fill={C.green} />
                <SvgText x={cx(i)} y={cy(d.value) - 6} textAnchor="middle" fontSize={8} fill="#333">
                  {String(d.value)}
                </SvgText>
                <SvgText x={cx(i)} y={H - 4} textAnchor="middle" fontSize={8} fill="#888">
                  {d.date.slice(5)}
                </SvgText>
              </G>
            ))}
          </Svg>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  appHeader: { backgroundColor: C.greenDark, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  addRoundCard: {
    backgroundColor: C.card, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 18,
    marginTop: 2, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#1a6b44', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  addRoundIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.greenLight,
    alignItems: 'center', justifyContent: 'center',
  },
  addRoundTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  addRoundSub: { color: C.muted, fontSize: 12, fontWeight: '500', marginTop: 2 },
  profileBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  profileInitial: { color: '#fff', fontSize: 16, fontWeight: '900' },
  tabs: { flexDirection: 'row', backgroundColor: C.greenLight, marginHorizontal: 12, marginVertical: 10, borderRadius: 50, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 50 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  tabText: { fontSize: 13, color: C.muted, fontWeight: '500' },
  tabTextActive: { color: C.green, fontWeight: '700' },
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#1a6b44', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  cardBold: { fontSize: 15, fontWeight: '700', color: C.text },
  bold: { fontWeight: '700', color: C.text },
  muted: { fontSize: 13, color: C.muted },
  // 통계 칩
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  statChipText: { fontSize: 12, fontWeight: '500', color: C.text },
  // 신기록 태그
  recordTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fffce8', borderWidth: 1, borderColor: '#f0d060', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  recordTagText: { fontSize: 12, fontWeight: '700', color: '#8a6000' },
  inProgressBadge: { backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  inProgressText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  completeBadge: { backgroundColor: C.border, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  completeText: { fontSize: 11, fontWeight: '600', color: C.muted },

  // 아바타
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: C.green },
  pill: { backgroundColor: C.greenLight, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 4 },
  pillText: { fontSize: 13, fontWeight: '700', color: C.green },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.greenLight, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', color: C.green },
  metricGridCompact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metricCard: { flexBasis: '47%', flexGrow: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
  metricLabel: { fontSize: 11, fontWeight: '800', color: C.muted },
  metricValue: { fontSize: 20, fontWeight: '900', color: C.text, marginTop: 8 },
  analysisRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  analysisLabel: { fontSize: 13, fontWeight: '700', color: C.muted },
  analysisValue: { fontSize: 14, fontWeight: '900', color: C.text },
  insightText: { fontSize: 13, color: C.muted, lineHeight: 20, marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  bulletDot: { width: 12, fontSize: 13, color: C.muted, lineHeight: 20 },
  bulletText: { flex: 1, fontSize: 13, color: C.muted, lineHeight: 20 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalInput: {
    width: 86, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 18, fontWeight: '900', color: C.text, textAlign: 'center', backgroundColor: '#fff',
  },
  goalUnit: { fontSize: 13, fontWeight: '800', color: C.text },
  miniTrendRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 116, gap: 8 },
  miniTrendItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  miniTrendValue: { fontSize: 11, fontWeight: '800', color: C.text, marginBottom: 5 },
  miniTrendBar: { width: '70%', borderRadius: 8, backgroundColor: C.green },
  miniTrendDate: { fontSize: 10, color: C.muted, marginTop: 6 },
  scoreDistRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  scoreDistItem: { flex: 1, alignItems: 'center', backgroundColor: C.greenLight, borderRadius: 14, paddingVertical: 10 },
  scoreDistValue: { fontSize: 17, fontWeight: '900' },
  scoreDistLabel: { fontSize: 10, fontWeight: '800', color: C.muted, marginTop: 3 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailButton: {
    flexBasis: '48%', flexGrow: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  detailButtonText: { fontSize: 13, fontWeight: '800', color: C.text },
  detailButtonArrow: { fontSize: 18, fontWeight: '700', color: C.muted },
  hallSection: { marginTop: 8 },
  hallSectionTitle: { fontSize: 12, fontWeight: '900', color: C.text, marginBottom: 4 },
  hallRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  hallIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  hallLabel: { flex: 1, fontSize: 13, color: C.muted },
  hallValue: { fontSize: 13, fontWeight: '600', color: C.text, textAlign: 'right', flexShrink: 1 },
  smallBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 10, marginBottom: 4 },
  yearBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 18 },
  yearBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  yearText: { fontWeight: '800', fontSize: 18, color: C.text },
  dropdownTrigger: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.green, backgroundColor: C.green },
  dropdownTriggerText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  dropdownMenu: { position: 'absolute', top: 32, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 10, zIndex: 100, minWidth: 90 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 16 },
  dropdownItemText: { fontSize: 13, color: C.text },
  dropdownItemActive: { color: C.green, fontWeight: '700' } as const,
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: C.border, paddingBottom: 7, marginBottom: 2 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 11, color: C.muted, fontWeight: '700', letterSpacing: 0.3 },
  td: { fontSize: 13, color: C.text },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, width: '90%', maxHeight: '78%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  closeBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14 },
  closeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
