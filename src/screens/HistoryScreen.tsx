import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Modal, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState, useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { AppHeader } from '../components/AppHeader'
import Svg, { Polyline, Circle, Line, Text as SvgText, G } from 'react-native-svg'
import { getRounds, getRound, playerTotal, totalPar, computeHandicaps, shortName, type SavedRound } from '../lib/store'
import { useClub } from '../lib/ClubContext'
import { useAsync } from '../lib/useAsync'
import { C } from '../theme'
import { EmojiIcon } from '../components/EmojiIcon'
import { Icon } from '../components/Icon'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Tab = 'byRound' | 'byPlayer' | 'club'

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

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

  const handicaps = computeHandicaps(rounds, basis)

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
    const w = getWinnerLocal(r, handicaps)
    if (w) winCount.set(w, (winCount.get(w) ?? 0) + 1)
  }
  let topWinName = '', topWinCount = 0
  for (const [n, c] of winCount) if (c > topWinCount) { topWinCount = c; topWinName = n }
  if (topWinName) add(topWinName, '🥇', '최다우승')

  const streakMap = new Map<string, number>()
  let curPlayer = '', curStreak = 0
  for (const r of sorted) {
    const w = getWinnerLocal(r, handicaps)
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
  const [tab, setTab] = useState<Tab>('byRound')
  const [refreshKey, setRefreshKey] = useState(0)
  const [myName, setMyName] = useState<string | null>(null)
  const [handicapBasis, setHandicapBasis] = useState(5)
  const { activeClub } = useClub()
  const { data, loading } = useAsync(
    () => (activeClub ? getRounds(activeClub.id) : Promise.resolve([])),
    [refreshKey, activeClub?.id],
  )
  const rounds = data ?? []
  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // 화면 포커스 복귀 시 자동 새로고침 (삭제/저장 후 즉시 반영)
  useFocusEffect(useCallback(() => { setRefreshKey((k) => k + 1) }, []))

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', data.user.id).single()
      setMyName(profile?.name ?? data.user?.user_metadata?.name ?? null)
    })
    AsyncStorage.getItem('@gogopar_handicap_basis').then(v => {
      if (v === '3' || v === '5' || v === '10') setHandicapBasis(Number(v))
    })
  }, [])

  const userInitial = (myName ?? '?').slice(0, 1)

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader myName={myName} />
      <View style={s.tabs}>
        {(['byRound', 'byPlayer', 'club'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'byRound' ? '라운딩별' : t === 'byPlayer' ? '개인별' : '클럽 전체'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.green} />}
      >
        {tab === 'byRound' && <ByRound rounds={rounds} handicapBasis={handicapBasis} />}
        {tab === 'byRound' && activeClub && <AddRoundButton />}
        {tab === 'byPlayer' && <ByPlayer rounds={rounds} handicapBasis={handicapBasis} />}
        {tab === 'club' && <Club rounds={rounds} />}
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
          const roundHandicaps = computeHandicaps(rounds, handicapBasis)
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
              const w = getWinnerLocal(pr, roundHandicaps)
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
}

function ByPlayer({ rounds, handicapBasis = 5 }: { rounds: SavedRound[]; handicapBasis?: number }) {
  const nav = useNavigation<Nav>()
  const [selected, setSelected] = useState<string | null>(null)
  const [graphPlayer, setGraphPlayer] = useState<string | null>(null)

  const byName = new Map<string, PlayerRound[]>()
  for (const r of rounds) {
    const par = totalPar(r.pars)
    for (const p of r.players) {
      const total = playerTotal(p.strokes)
      const arr = byName.get(p.name) ?? []
      arr.push({ roundId: r.id, date: r.date, courseName: r.courseName, total, diff: total - par, strokes: p.strokes, pars: r.pars })
      byName.set(p.name, arr)
    }
  }

  const playerBadges = getPlayerBadges(rounds, handicapBasis)

  const players = Array.from(byName.entries())
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
      const totals = sorted.map((x) => x.total)
      return {
        name, rounds: sorted.length,
        avg: Math.ceil(totals.reduce((a, b) => a + b, 0) / totals.length),
        best: Math.min(...totals),
        list: sorted,
        recent3: sorted.slice(-3).map((x) => x.total).reverse(),
      }
    })
    .sort((a, b) => b.rounds - a.rounds || a.name.localeCompare(b.name))

  if (players.length === 0) return <Text style={s.muted}>데이터가 없습니다.</Text>

  // 개인 상세 화면
  if (selected) {
    const p = players.find((x) => x.name === selected)
    if (!p) { setSelected(null); return null }
    return (
      <>
        <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>{shortName(p.name)}</Text>
            <Text style={s.muted}>{p.rounds}경기 · 평균 {p.avg} · 최저 {p.best}</Text>
          </View>
          <TouchableOpacity style={s.smallBtn} onPress={() => setSelected(null)}>
            <Text style={s.smallBtnText}>← 목록</Text>
          </TouchableOpacity>
        </View>
        {p.list.map((x) => {
          const stats = holeStats(x.strokes, x.pars)
          return (
            <TouchableOpacity key={x.roundId} style={s.card} onPress={() => nav.navigate('RoundDetail', { id: x.roundId })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={s.cardBold}>{x.courseName}</Text>
                  <Text style={s.muted}>{x.date}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>{x.total}</Text>
                  <Text style={s.muted}>{diffText(x.diff)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                {stats.birdie > 0 && <Text style={{ fontSize: 12, color: '#2980b9', fontWeight: '600' }}>버디 {stats.birdie}</Text>}
                {stats.par > 0 && <Text style={[s.muted, { fontSize: 12 }]}>파 {stats.par}</Text>}
                {stats.bogey > 0 && <Text style={{ fontSize: 12, color: '#e67e22' }}>보기 {stats.bogey}</Text>}
                {stats.dbl > 0 && <Text style={{ fontSize: 12, color: '#c0392b' }}>더블 {stats.dbl}</Text>}
                {stats.dblPlus > 0 && <Text style={{ fontSize: 12, color: '#8e1a0e', fontWeight: '600' }}>더블+ {stats.dblPlus}</Text>}
              </View>
            </TouchableOpacity>
          )
        })}
      </>
    )
  }

  // 선수 목록
  const graphData = graphPlayer
    ? players.find((p) => p.name === graphPlayer)?.list.map((x) => ({ date: x.date, value: x.total }))
    : null

  return (
    <>
      {graphData && graphPlayer && (
        <TrendModal title={`${shortName(graphPlayer)} 타수 추이`} data={graphData} onClose={() => setGraphPlayer(null)} />
      )}
      {players.map((p) => (
        <TouchableOpacity key={p.name} style={s.card} onPress={() => setSelected(p.name)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{shortName(p.name).slice(0, 1)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <Text style={s.cardBold}>{shortName(p.name)}</Text>
                  {(playerBadges.get(p.name) ?? []).map((b) => (
                    <View key={b.label} style={s.badge}>
                      <EmojiIcon char={b.icon} size={11} color={C.green} />
                      <Text style={s.badgeText}>{b.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.muted}>{p.rounds}경기</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>{p.avg}</Text>
              <Text style={[s.muted, { fontSize: 12 }]}>최저 {p.best}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={[s.muted, { fontSize: 12 }]}>최근</Text>
              {p.recent3.map((score, i) => (
                <View key={i} style={s.pill}>
                  <Text style={s.pillText}>{score}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={s.smallBtn} onPress={() => setGraphPlayer(p.name)}>
              <Text style={s.smallBtnText}>추이</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </>
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
          <Text style={[s.cardTitle, { marginBottom: 0 }]}>전체 랭킹 (평균)</Text>
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
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>최저</Text>
          <Text style={[s.th, { flex: 1.2, textAlign: 'center' }]}>{'핸디\n최근' + handicapBasis}</Text>
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
