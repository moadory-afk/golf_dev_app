import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState, useCallback, useEffect } from 'react'
import { getRounds, playerTotal, totalPar, computeHandicaps, shortName, type SavedRound } from '../lib/store'
import { useClub } from '../lib/ClubContext'
import { useAsync } from '../lib/useAsync'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { UserAvatarBtn } from '../components/UserAvatar'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type PersonalDetailType = 'handicap' | 'best' | 'wins' | 'singleBirdie' | 'records'

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

function getWinner(r: SavedRound, handicaps: Map<string, number>): string | null {
  const best = Math.min(...r.players.map((p) => playerTotal(p.strokes)))
  const medalWinner = r.players.find((p) => playerTotal(p.strokes) === best)?.name
  const ranked = r.players
    .map((p) => ({ name: p.name, net: playerTotal(p.strokes) - (handicaps.get(p.name) ?? 0) }))
    .sort((a, b) => a.net - b.net)
  if (ranked[0]?.name === medalWinner) return ranked[1]?.name ?? null
  return ranked[0]?.name ?? null
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const [refreshKey, setRefreshKey] = useState(0)
  const { activeClub: club } = useClub()
  const { data, loading } = useAsync(
    () => (club ? getRounds(club.id) : Promise.resolve([])),
    [refreshKey, club?.id],
  )
  const rounds = data ?? []
  const [myName, setMyName] = useState<string | null>(null)
  const [personalDetail, setPersonalDetail] = useState<PersonalDetailType | null>(null)
  const [h2hPlayer, setH2hPlayer] = useState<string | null>(null)
  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMyName(data.user?.user_metadata?.name ?? data.user?.email ?? null)
    })
  }, [])

  const handicaps = computeHandicaps(rounds)

  const byName = new Map<string, Array<{ date: string; total: number; par: number; courseName: string }>>()
  for (const r of rounds) {
    const par = totalPar(r.pars)
    for (const p of r.players) {
      const arr = byName.get(p.name) ?? []
      arr.push({ date: r.date, total: playerTotal(p.strokes), par, courseName: r.courseName })
      byName.set(p.name, arr)
    }
  }

  const winCount = new Map<string, number>()
  const sortedRounds = [...rounds].sort((a, b) => a.date.localeCompare(b.date))
  for (const r of sortedRounds) {
    const w = getWinner(r, handicaps)
    if (w) winCount.set(w, (winCount.get(w) ?? 0) + 1)
  }

  const birdieCount = new Map<string, number>()
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ })
      birdieCount.set(p.name, (birdieCount.get(p.name) ?? 0) + b)
    }

  const singleBirdieMap = new Map<string, { count: number; date: string; courseName: string }>()
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ })
      const prev = singleBirdieMap.get(p.name)
      if (!prev || b > prev.count)
        singleBirdieMap.set(p.name, { count: b, date: r.date, courseName: r.courseName })
    }

  const singleParMap = new Map<string, { count: number; date: string; courseName: string }>()
  for (const r of rounds)
    for (const p of r.players) {
      let pars = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] === 0) pars++ })
      const prev = singleParMap.get(p.name)
      if (!prev || pars > prev.count)
        singleParMap.set(p.name, { count: pars, date: r.date, courseName: r.courseName })
    }

  const medalRanking = Array.from(byName.entries())
    .map(([name, entries]) => {
      const best = entries.reduce((b, e) => e.total < b.total ? e : b)
      return { name, total: best.total }
    })
    .sort((a, b) => a.total - b.total)

  const myEntries = myName ? (byName.get(myName) ?? []) : []
  const myHandicap = (() => {
    if (!myEntries.length) return null
    const sorted = [...myEntries].sort((a, b) => a.date.localeCompare(b.date))
    const last5 = sorted.slice(-5)
    return Math.ceil(last5.reduce((sum, e) => sum + (e.total - e.par), 0) / last5.length)
  })()
  const myBest = myEntries.length > 0 ? myEntries.reduce((b, e) => e.total < b.total ? e : b) : null
  const myWins = myName ? (winCount.get(myName) ?? 0) : 0
  const myBestBirdie = myName ? singleBirdieMap.get(myName) : undefined
  const myBestPar = myName ? singleParMap.get(myName) : undefined

  // ─ 기네스 기록 ──────────────────────────────────────────────────
  interface GinnessRecord {
    icon: string; title: string; value: string; detail?: string
  }
  const ginnessRecords: GinnessRecord[] = []

  if (myName && rounds.length > 0) {
    // 1. 클럽 최저타 (메달리스트)
    if (myBest && medalRanking[0] && myBest.total === medalRanking[0].total)
      ginnessRecords.push({ icon: '🏆', title: '클럽 최저타', value: `${myBest.total}타`, detail: `${myBest.date.slice(5)} ${myBest.courseName}` })

    // 2. 최다 우승
    const topWinner = [...winCount.entries()].sort((a, b) => b[1] - a[1])[0]
    if (myWins > 0 && topWinner && myWins === topWinner[1])
      ginnessRecords.push({ icon: '🥇', title: '최다 우승', value: `${myWins}회` })

    // 3. 버디왕 (경기당 최다)
    const topSingleBirdie = [...singleBirdieMap.entries()].sort((a, b) => b[1].count - a[1].count)[0]
    if (myBestBirdie && myBestBirdie.count > 0 && topSingleBirdie && myBestBirdie.count === topSingleBirdie[1].count)
      ginnessRecords.push({ icon: '🐦', title: '버디왕 (경기당)', value: `${myBestBirdie.count}개`, detail: `${myBestBirdie.date.slice(5)} ${myBestBirdie.courseName}` })

    // 4. 버디왕 (전체 누적)
    const topBirdie = [...birdieCount.entries()].sort((a, b) => b[1] - a[1])[0]
    const myTotalBirdies = birdieCount.get(myName) ?? 0
    if (myTotalBirdies > 0 && topBirdie && myTotalBirdies === topBirdie[1])
      ginnessRecords.push({ icon: '🐦🐦', title: '버디왕 (누적 전체)', value: `${myTotalBirdies}개` })

    // 5. 파왕 (경기당 최다)
    const topSinglePar = [...singleParMap.entries()].sort((a, b) => b[1].count - a[1].count)[0]
    if (myBestPar && topSinglePar && myBestPar.count === topSinglePar[1].count)
      ginnessRecords.push({ icon: '⛳', title: '파왕 (경기당)', value: `${myBestPar.count}개`, detail: `${myBestPar.date.slice(5)} ${myBestPar.courseName}` })

    // 6. 최저 핸디캡
    if (myHandicap !== null && handicaps.size > 0 && myHandicap === Math.min(...[...handicaps.values()]))
      ginnessRecords.push({ icon: '📉', title: '최저 핸디캡', value: diffText(myHandicap) })
  }

  // 하위 호환 (PersonalDetailModal용)
  const myRecords = ginnessRecords.map(r => r.title)

  // 핸디캡 추이 (최근 7라운드)
  const myRoundsSorted = [...myEntries].sort((a, b) => a.date.localeCompare(b.date))
  const handicapTrend = myRoundsSorted.slice(-7).map((e, idx, arr) => {
    const last5 = arr.slice(Math.max(0, idx - 4), idx + 1)
    return Math.ceil(last5.reduce((s, x) => s + (x.total - x.par), 0) / last5.length)
  })

  const recent3 = rounds.slice(0, 3)
  const userInitial = (myName ?? '?').slice(0, 1)
  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? '좋은 아침이에요' : greetingHour < 18 ? '좋은 오후예요' : '좋은 저녁이에요'

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {h2hPlayer && (
        <HeadToHeadModal player={h2hPlayer} rounds={rounds} handicaps={handicaps} onClose={() => setH2hPlayer(null)} />
      )}
      {personalDetail && myName && (
        <PersonalDetailModal
          type={personalDetail} myName={myName} rounds={rounds}
          handicaps={handicaps} myRecords={myRecords}
          winCount={winCount} singleBirdieMap={singleBirdieMap} singleParMap={singleParMap}
          onClose={() => setPersonalDetail(null)}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.green} />}
      >
        {/* 헤더 */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting} ☀️</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.headerTitle}>{myName ? shortName(myName) : 'GogoPar'}</Text>
              {club && (
                <View style={s.clubBadge}>
                  <Text style={s.clubBadgeText}>⛳ {club.name}</Text>
                </View>
              )}
            </View>
          </View>
          <UserAvatarBtn size={38} />
        </View>

        <View style={s.content}>
          {/* 스탯 카드 3개 */}
          {myEntries.length > 0 && (
            <View style={s.statsRow}>
              <TouchableOpacity style={s.statCard} onPress={() => setPersonalDetail('handicap')}>
                <Text style={s.statLabel}>핸디캡</Text>
                <Text style={s.statValue}>{myHandicap !== null ? diffText(myHandicap) : '-'}</Text>
                <Text style={s.statSub}>최근 5경기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.statCard} onPress={() => setPersonalDetail('best')}>
                <Text style={s.statLabel}>베스트</Text>
                <Text style={[s.statValue, { color: C.gold }]}>{myBest ? `${myBest.total}타` : '-'}</Text>
                <Text style={s.statSub}>{myBest?.courseName.slice(0, 5) ?? ''}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.statCard} onPress={() => setPersonalDetail('wins')}>
                <Text style={s.statLabel}>우승</Text>
                <Text style={[s.statValue, { color: C.green }]}>{myWins}회</Text>
                <Text style={s.statSub}>정규 신페리오</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 핸디캡 추이 */}
          {handicapTrend.length >= 2 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>📈 핸디캡 추이</Text>
              <View style={s.trendWrap}>
                {handicapTrend.map((h, i) => {
                  const min = Math.min(...handicapTrend)
                  const max = Math.max(...handicapTrend)
                  const range = max - min || 1
                  const heightPct = 1 - (h - min) / range
                  const barH = 10 + heightPct * 46
                  const isLast = i === handicapTrend.length - 1
                  return (
                    <View key={i} style={s.trendCol}>
                      {isLast && <Text style={s.trendCurrent}>{diffText(h)}</Text>}
                      <View style={[s.trendBar, { height: barH, backgroundColor: isLast ? C.green : C.greenLight, borderColor: isLast ? C.green : C.border }]} />
                    </View>
                  )
                })}
              </View>
              <Text style={s.trendLabel}>← 과거  최근 →</Text>
            </View>
          )}

          {/* 개인 하이라이트 */}
          {myEntries.length > 0 && myName && (
            <View style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={s.cardTitle}>🎖️ 클럽 신기록</Text>
                {ginnessRecords.length > 0 && (
                  <View style={s.recordCountBadge}>
                    <Text style={s.recordCountText}>{ginnessRecords.length}개 보유</Text>
                  </View>
                )}
              </View>

              {ginnessRecords.length === 0 ? (
                <View style={s.noRecordBox}>
                  <Text style={{ fontSize: 36, marginBottom: 10 }}>🏆</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.muted }}>아직 보유한 클럽 신기록이 없어요</Text>
                  <Text style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>기록을 세워보세요!</Text>
                </View>
              ) : (
                ginnessRecords.map((rec, i) => (
                  <View key={i} style={[s.ginnessRow, i === 0 && { borderTopWidth: 0 }]}>
                    <View style={s.ginnessIconWrap}>
                      <Text style={{ fontSize: 20 }}>{rec.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.ginnessTitle}>{rec.title}</Text>
                      {rec.detail && <Text style={s.ginnessSub}>{rec.detail}</Text>}
                    </View>
                    <View style={s.ginnessValueWrap}>
                      <Text style={s.ginnessValue}>{rec.value}</Text>
                    </View>
                  </View>
                ))
              )}

              <TouchableOpacity style={s.h2hBtn} onPress={() => setH2hPlayer(myName)}>
                <Text style={s.h2hBtnText}>⚔️ 상대 전적 보기 →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 클럽 없음 안내 */}
          {!club && !loading && (
            <View style={s.noClubCard}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>⛳</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 }}>클럽에 소속되어 있지 않아요</Text>
              <Text style={{ fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 }}>
                프로필에서 클럽을 만들거나{'\n'}초대 링크로 참여해보세요
              </Text>
            </View>
          )}

          {/* 최근 라운드 */}
          {recent3.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>📋 최근 라운드</Text>
              {recent3.map((r) => {
                const myP = myName ? r.players.find((p) => p.name === myName) : null
                const myScore = myP ? playerTotal(myP.strokes) : null
                const par = totalPar(r.pars)
                const diff = myScore !== null ? myScore - par : null
                return (
                  <TouchableOpacity
                    key={r.id} style={s.recentRow}
                    onPress={() => nav.navigate('RoundDetail', { id: r.id })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.recentCourse}>{r.courseName}</Text>
                      <Text style={s.recentDate}>{r.date}  👥 {r.players.length}명</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {myScore !== null ? (
                        <>
                          <Text style={s.recentScore}>{myScore}타</Text>
                          <Text style={[s.recentDiff, { color: diff !== null && diff <= 0 ? C.green : C.warn }]}>
                            {diff !== null ? diffText(diff) : ''}
                          </Text>
                        </>
                      ) : (
                        <Text style={s.recentDiff}>미참여</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* 기록 없음 */}
          {club && !loading && rounds.length === 0 && (
            <View style={s.emptyCard}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>🏌️</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>아직 기록이 없어요</Text>
              <Text style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>첫 라운드를 기록해보세요!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

// ─── 상대 전적 모달 ───────────────────────────────────────────────────────────

function handicapAt(name: string, allRounds: SavedRound[], beforeDate: string): number {
  const prior = allRounds
    .filter((r) => r.date < beforeDate && r.players.some((p) => p.name === name))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-5)
  if (!prior.length) return 0
  const diffs = prior.map((r) => {
    const p = r.players.find((pl) => pl.name === name)!
    return playerTotal(p.strokes) - totalPar(r.pars)
  })
  return Math.ceil(diffs.reduce((a, b) => a + b, 0) / diffs.length)
}

function HeadToHeadModal({ player, rounds, handicaps, onClose }: {
  player: string; rounds: SavedRound[]; handicaps: Map<string, number>; onClose: () => void
}) {
  const myHandicap = handicaps.get(player) ?? 0
  const opponents = new Map<string, { played: number; wins: number; losses: number }>()
  for (const r of rounds) {
    const me = r.players.find((p) => p.name === player)
    if (!me) continue
    const myH = handicapAt(player, rounds, r.date)
    const myNet = playerTotal(me.strokes) - myH
    for (const opp of r.players) {
      if (opp.name === player) continue
      const oppH = handicapAt(opp.name, rounds, r.date)
      const oppNet = playerTotal(opp.strokes) - oppH
      const rec = opponents.get(opp.name) ?? { played: 0, wins: 0, losses: 0 }
      rec.played++
      if (myNet < oppNet) rec.wins++
      else if (myNet > oppNet) rec.losses++
      opponents.set(opp.name, rec)
    }
  }
  const sorted = [...opponents.entries()]
    .map(([name, rec]) => ({ name, rec, oppH: handicaps.get(name) ?? 0, diff: myHandicap - (handicaps.get(name) ?? 0) }))
    .sort((a, b) => a.diff - b.diff)

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>⚔️ 역대 전적 (핸디 {myHandicap > 0 ? '+' : ''}{myHandicap})</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal>
            <View>
              {sorted.length === 0 ? <Text style={s.muted}>데이터 없음</Text> : (
                <>
                  <View style={s.tableHeader}>
                    {['상대', '경기', '승', '무', '패', '승률', '핸디', '핸디차'].map((h, i) => (
                      <Text key={i} style={[s.th, { width: [44,30,28,28,28,40,38,44][i], textAlign: i === 0 ? 'left' : 'center' }]}>{h}</Text>
                    ))}
                  </View>
                  {sorted.map(({ name: opp, rec, oppH, diff }) => {
                    const draws = rec.played - rec.wins - rec.losses
                    return (
                      <View key={opp} style={s.tableRow}>
                        <Text style={[s.td, { width: 44 }]}>{shortName(opp)}</Text>
                        <Text style={[s.td, { width: 30, textAlign: 'center' }]}>{rec.played}</Text>
                        <Text style={[s.td, { width: 28, textAlign: 'center', color: C.info, fontWeight: '600' }]}>{rec.wins}</Text>
                        <Text style={[s.td, { width: 28, textAlign: 'center' }]}>{draws}</Text>
                        <Text style={[s.td, { width: 28, textAlign: 'center', color: C.danger }]}>{rec.losses}</Text>
                        <Text style={[s.td, { width: 40, textAlign: 'center', fontWeight: '600' }]}>{Math.round(rec.wins / rec.played * 100)}%</Text>
                        <Text style={[s.td, { width: 38, textAlign: 'center' }]}>{oppH > 0 ? '+' : ''}{oppH}</Text>
                        <Text style={[s.td, { width: 44, textAlign: 'center', fontWeight: '600', color: diff > 0 ? C.danger : diff < 0 ? C.info : C.text }]}>{diff > 0 ? '+' : ''}{diff}</Text>
                      </View>
                    )
                  })}
                </>
              )}
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── 개인 상세 모달 ───────────────────────────────────────────────────────────

function PersonalDetailModal({ type, myName, rounds, handicaps, myRecords, winCount, singleBirdieMap, singleParMap, onClose }: {
  type: PersonalDetailType; myName: string; rounds: SavedRound[]
  handicaps: Map<string, number>; myRecords: string[]
  winCount: Map<string, number>
  singleBirdieMap: Map<string, { count: number; date: string; courseName: string }>
  singleParMap: Map<string, { count: number; date: string; courseName: string }>
  onClose: () => void
}) {
  const myRounds = rounds
    .filter((r) => r.players.some((p) => p.name === myName))
    .map((r) => {
      const player = r.players.find((p) => p.name === myName)!
      const total = playerTotal(player.strokes)
      const par = totalPar(r.pars)
      let birdies = 0, parCount = 0
      player.strokes.forEach((s, i) => {
        if (s - r.pars[i] <= -1) birdies++
        else if (s - r.pars[i] === 0) parCount++
      })
      return { date: r.date, courseName: r.courseName, total, par, diff: total - par, birdies, parCount }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const getWinnerLocal = (r: SavedRound) => {
    const best = Math.min(...r.players.map((p) => playerTotal(p.strokes)))
    const medalWinner = r.players.find((p) => playerTotal(p.strokes) === best)?.name
    const ranked = r.players
      .map((p) => ({ name: p.name, net: playerTotal(p.strokes) - (handicaps.get(p.name) ?? 0) }))
      .sort((a, b) => a.net - b.net)
    if (ranked[0]?.name === medalWinner) return ranked[1]?.name ?? null
    return ranked[0]?.name ?? null
  }

  type Row = { cols: (string | { text: string; color?: string })[] }
  let title = ''; let headers: string[] = []; let rows: Row[] = []

  if (type === 'handicap') {
    title = '핸디캡 근거 (최근 5경기)'; headers = ['날짜', '코스', '스코어', '파대비']
    const last5 = myRounds.slice(-5)
    rows = last5.map((e) => ({ cols: [e.date.slice(5), e.courseName.slice(0, 7), `${e.total}`, { text: diffText(e.diff), color: e.diff <= 0 ? C.green : C.warn }] }))
  } else if (type === 'best') {
    title = '베스트 스코어 순위'; headers = ['날짜', '코스', '스코어', '파대비']
    rows = [...myRounds].sort((a, b) => a.total - b.total).map((e) => ({ cols: [e.date.slice(5), e.courseName.slice(0, 7), `${e.total}`, { text: diffText(e.diff), color: e.diff <= 0 ? C.green : C.warn }] }))
  } else if (type === 'wins') {
    title = '우승 기록'; headers = ['날짜', '코스', '핸디대비']
    const myH = handicaps.get(myName) ?? 0
    const winRounds = rounds
      .filter((r) => getWinnerLocal(r) === myName)
      .map((r) => {
        const p = r.players.find((pl) => pl.name === myName)!
        return { date: r.date, courseName: r.courseName, netVsPar: playerTotal(p.strokes) - myH - totalPar(r.pars) }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
    rows = winRounds.map((e) => ({ cols: [e.date.slice(5), e.courseName.slice(0, 7), { text: diffText(e.netVsPar), color: e.netVsPar <= 0 ? C.green : C.warn }] }))
  } else if (type === 'singleBirdie') {
    title = '한경기 버디 기록'; headers = ['날짜', '코스', '버디']
    rows = [...myRounds].sort((a, b) => b.birdies - a.birdies).map((e) => ({ cols: [e.date.slice(5), e.courseName.slice(0, 7), { text: `${e.birdies}개`, color: e.birdies > 0 ? C.info : C.muted }] }))
  }

  const flexes = [1.2, 2.2, 1, 1]

  if (type === 'records') {
    return (
      <Modal transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>🏅 보유 신기록</Text>
              <TouchableOpacity style={s.closeBtn} onPress={onClose}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
            </View>
            <ScrollView>
              {myRecords.length === 0 ? (
                <Text style={[s.muted, { textAlign: 'center', paddingVertical: 20 }]}>현재 보유한 클럽 신기록이 없습니다.</Text>
              ) : myRecords.map((rec, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>🏅</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{rec}</Text>
                </View>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    )
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
          </View>
          <ScrollView>
            <View style={s.tableHeader}>
              {headers.map((h, i) => <Text key={i} style={[s.th, { flex: flexes[i] ?? 1, textAlign: i >= 2 ? 'right' : 'left' }]}>{h}</Text>)}
            </View>
            {rows.map((row, i) => (
              <View key={i} style={s.tableRow}>
                {row.cols.map((col, j) => {
                  const cell = typeof col === 'string' ? { text: col, color: undefined } : col
                  return <Text key={j} style={[s.td, { flex: flexes[j] ?? 1, textAlign: j >= 2 ? 'right' : 'left', fontWeight: j >= 2 ? '700' : '400', color: cell.color ?? C.text }]}>{cell.text}</Text>
                })}
              </View>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const s = StyleSheet.create({
  // 헤더
  header: {
    backgroundColor: C.greenDark,
    paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  greeting: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginBottom: 4 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  scoreBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  scoreBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  clubBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  clubBadgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  profileBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  profileInitial: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // 컨텐츠
  content: { padding: 16 },

  // 스탯 카드
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14,
    alignItems: 'center',
    shadowColor: '#1a6b44', shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  statLabel: { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '900', color: C.text },
  statSub: { fontSize: 10, color: C.muted, marginTop: 4, textAlign: 'center' },

  // 핸디캡 추이
  trendWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 72, marginVertical: 8 },
  trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: { width: '100%', borderRadius: 4, borderWidth: 1 },
  trendCurrent: { fontSize: 10, fontWeight: '800', color: C.green, marginBottom: 3 },
  trendLabel: { fontSize: 10, color: C.muted, textAlign: 'right', marginTop: 4 },

  // 카드
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#1a6b44', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },

  // 하이라이트 행
  highlightRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border,
  },
  highlightLabel: { fontSize: 13, color: C.text, fontWeight: '500' },
  highlightSub: { fontSize: 11, color: C.muted, marginTop: 2 },
  highlightValue: { fontSize: 14, fontWeight: '700', color: C.green },
  chevron: { color: C.muted, fontSize: 18 },

  // 기네스 기록
  recordCountBadge: {
    backgroundColor: C.gold, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  recordCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  noRecordBox: { alignItems: 'center', paddingVertical: 24 },
  ginnessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border,
  },
  ginnessIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fffbe8', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#f0e0a0',
  },
  ginnessTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  ginnessSub: { fontSize: 11, color: C.muted, marginTop: 2 },
  ginnessValueWrap: {
    backgroundColor: C.greenLight, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  ginnessValue: { fontSize: 15, fontWeight: '900', color: C.green },

  // 상대 전적 버튼
  h2hBtn: {
    marginTop: 12, paddingVertical: 10, borderRadius: 12,
    backgroundColor: C.greenLight, alignItems: 'center',
  },
  h2hBtnText: { color: C.green, fontWeight: '700', fontSize: 13 },

  // 최근 라운드
  recentRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  recentCourse: { fontSize: 14, fontWeight: '700', color: C.text },
  recentDate: { fontSize: 12, color: C.muted, marginTop: 2 },
  recentScore: { fontSize: 16, fontWeight: '900', color: C.text },
  recentDiff: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  // 빈 상태
  noClubCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 32,
    alignItems: 'center', marginBottom: 14,
  },
  emptyCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 32,
    alignItems: 'center', marginBottom: 14,
  },
  muted: { fontSize: 13, color: C.muted },

  // 모달
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, width: '90%', maxHeight: '78%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  closeBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14 },
  closeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: C.border, paddingBottom: 7, marginBottom: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 11, color: C.muted, fontWeight: '700' },
  td: { fontSize: 13, color: C.text },
})
