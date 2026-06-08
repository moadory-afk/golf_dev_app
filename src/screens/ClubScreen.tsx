import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState, useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getRounds, playerTotal, totalPar, computeHandicaps, shortName, type SavedRound } from '../lib/store'
import { useClub } from '../lib/ClubContext'
import { useAsync } from '../lib/useAsync'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { AppHeader } from '../components/AppHeader'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type RankingType = 'recentMedal' | 'recentWins' | 'wins' | 'streak' | 'lowestHandicap' | 'birdie' | 'singleBirdie'

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

// 공동 수상자 포맷: 3명 이하 전원, 4명 이상 "A 외 N명"
function formatWinners(names: string[], value: string): string {
  if (names.length === 0) return '-'
  const label = names.length <= 3
    ? names.map(shortName).join(', ')
    : `${shortName(names[0])} 외 ${names.length - 1}명`
  return `${label} (${value})`
}

function getWinner(r: SavedRound, handicaps: Map<string, number>): string | null {
  const ranked = r.players
    .map((p) => {
      const total = playerTotal(p.strokes)
      return { name: p.name, net: total - (handicaps.get(p.name) ?? 0), total }
    })
    .sort((a, b) => a.net !== b.net ? a.net - b.net : a.total - b.total) // net 동점 → 총타수 낮은 순
  return ranked[0]?.name ?? null
}

export default function ClubScreen() {
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const [refreshKey, setRefreshKey] = useState(0)
  const { activeClub: club } = useClub()
  const { data, loading } = useAsync(
    () => (club ? getRounds(club.id) : Promise.resolve([])),
    [refreshKey, club?.id],
  )
  const rounds = data ?? []
  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  const [rankingType, setRankingType] = useState<RankingType | null>(null)
  const [myName, setMyName] = useState<string | null>(null)

  const [handicapBasis, setHandicapBasis] = useState(5)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMyName(data.user?.user_metadata?.name ?? null)
    })
    AsyncStorage.getItem('@gogopar_handicap_basis').then(v => {
      if (v === '3' || v === '5' || v === '10') setHandicapBasis(Number(v))
    })
  }, [])

  const userInitial = (myName ?? '?').slice(0, 1)
  const handicaps = computeHandicaps(rounds, handicapBasis)
  const sortedRounds = [...rounds].sort((a, b) => a.date.localeCompare(b.date))

  // 선수별 평균 타수 (기준 경기 수)
  const avgScoreByPlayer = new Map<string, number>()
  const scoresByPlayer = new Map<string, Array<{ date: string; score: number }>>()
  for (const r of rounds) {
    for (const p of r.players) {
      const arr = scoresByPlayer.get(p.name) ?? []
      arr.push({ date: r.date, score: playerTotal(p.strokes) })
      scoresByPlayer.set(p.name, arr)
    }
  }
  for (const [name, entries] of scoresByPlayer) {
    const lastN = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-handicapBasis)
    avgScoreByPlayer.set(name, Math.round(lastN.reduce((s, e) => s + e.score, 0) / lastN.length))
  }

  // 핸디캡 랭킹 (낮을수록 잘하는 것)
  const handicapRanking = [...handicaps.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name, h]) => ({ name, handicap: h, avgScore: avgScoreByPlayer.get(name) ?? 0 }))

  // 우승 집계
  const winCount = new Map<string, number>()
  for (const r of sortedRounds) {
    const w = getWinner(r, handicaps)
    if (w) winCount.set(w, (winCount.get(w) ?? 0) + 1)
  }
  const winRanking = [...winCount.entries()]
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins)

  // 연속 우승
  let maxStreak = 0, maxStreakPlayer = '', curStreak = 0, curPlayer = ''
  for (const r of sortedRounds) {
    const w = getWinner(r, handicaps)
    if (w && w === curPlayer) { curStreak++ }
    else {
      if (curStreak > maxStreak) { maxStreak = curStreak; maxStreakPlayer = curPlayer }
      curPlayer = w ?? ''; curStreak = w ? 1 : 0
    }
  }
  if (curStreak > maxStreak) { maxStreak = curStreak; maxStreakPlayer = curPlayer }
  const streakRanking = [...winCount.keys()]
    .map((name) => ({ name, streak: 0 }))

  // 버디 집계
  const birdieCount = new Map<string, number>()
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ })
      birdieCount.set(p.name, (birdieCount.get(p.name) ?? 0) + b)
    }
  const birdieRanking = [...birdieCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // 한경기 최다 버디
  const singleBirdieMap = new Map<string, { count: number; date: string; courseName: string }>()
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ })
      const prev = singleBirdieMap.get(p.name)
      if (!prev || b > prev.count)
        singleBirdieMap.set(p.name, { count: b, date: r.date, courseName: r.courseName })
    }
  const singleBirdieRanking = [...singleBirdieMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)

  // 최근 5경기 메달리스트 / 우승자 (공동 포함)
  const recentMedalRows = rounds.slice(0, 5).map((r) => {
    const best = Math.min(...r.players.map((p) => playerTotal(p.strokes)))
    const medals = r.players.filter((p) => playerTotal(p.strokes) === best).map((p) => p.name)
    const label = medals.length <= 3 ? medals.map(shortName).join(', ') : `${shortName(medals[0])} 외 ${medals.length - 1}명`
    return { name: label || '-', value: `${best}타`, sub: `${r.date.slice(5)} ${r.courseName}` }
  })
  const recentWinsRows = rounds.slice(0, 5).map((r) => {
    const pts = r.players.map((p) => { const total = playerTotal(p.strokes); return { name: p.name, net: total - (handicaps.get(p.name) ?? 0), total } })
    const minNet = Math.min(...pts.map((p) => p.net))
    const winners = pts.filter((p) => p.net === minNet)
    const topGross = Math.min(...winners.map((w) => w.total))
    const label = winners.length <= 3 ? winners.map((w) => shortName(w.name)).join(', ') : `${shortName(winners[0].name)} 외 ${winners.length - 1}명`
    return { name: label || '-', value: `${topGross}타`, sub: `${r.date.slice(5)} ${r.courseName}` }
  })

  const rankingConfig: Record<RankingType, { title: string; col: string; rows: { name: string; value: string; sub?: string }[] }> = {
    recentMedal: { title: '최근 5경기 메달리스트', col: '최저타', rows: recentMedalRows },
    recentWins: { title: '최근 5경기 우승자', col: '핸디대비', rows: recentWinsRows },
    wins: { title: '최다 우승', col: '우승 횟수', rows: winRanking.map((r) => ({ name: shortName(r.name), value: `${r.wins}회` })) },
    streak: { title: '최다 연속 우승', col: '연속', rows: maxStreak > 0 ? [{ name: shortName(maxStreakPlayer), value: `${maxStreak}연승` }] : [] },
    lowestHandicap: { title: `핸디캡 랭킹 (최근 ${handicapBasis}경기)`, col: '평균타 (핸디)', rows: handicapRanking.map((r) => ({ name: shortName(r.name), value: r.avgScore ? `${r.avgScore} (${diffText(r.handicap)})` : diffText(r.handicap) })) },
    birdie: { title: '버디왕 (전체)', col: '버디 수', rows: birdieRanking.map((r) => ({ name: shortName(r.name), value: `${r.count}개` })) },
    singleBirdie: { title: '버디왕 (1경기)', col: '버디 수', rows: singleBirdieRanking.map((r) => ({ name: shortName(r.name), value: `${r.count}개`, sub: `${r.date.slice(5)} ${r.courseName}` })) },
  }

  // 최근 라운드
  const recent3 = rounds.slice(0, 3)

  const topWinner = winRanking[0]
  const latestRound = rounds[0]
  const lowestHandicapEntry = [...handicaps.entries()].sort((a, b) => a[1] - b[1])[0]
  const topBirdie = birdieRanking[0]
  const topSingleBirdie = singleBirdieRanking[0]

  // 공동 수상 포함 텍스트 계산
  const recentMedalText = (() => {
    if (!latestRound) return '-'
    const best = Math.min(...latestRound.players.map((p) => playerTotal(p.strokes)))
    const names = latestRound.players.filter((p) => playerTotal(p.strokes) === best).map((p) => p.name)
    return formatWinners(names, `${best}타`)
  })()

  const recentWinnerText = (() => {
    if (!latestRound) return '-'
    const pts = latestRound.players.map((p) => { const total = playerTotal(p.strokes); return { name: p.name, net: total - (handicaps.get(p.name) ?? 0), total } })
    const minNet = Math.min(...pts.map((p) => p.net))
    const winners = pts.filter((p) => p.net === minNet)
    const topGross = Math.min(...winners.map((w) => w.total))
    return formatWinners(winners.map((w) => w.name), `${topGross}타`)
  })()

  const mostWinsText = (() => {
    if (!topWinner) return '-'
    const tied = winRanking.filter((r) => r.wins === topWinner.wins)
    return formatWinners(tied.map((r) => r.name), `${topWinner.wins}회`)
  })()

  const lowestHandiText = (() => {
    if (!lowestHandicapEntry) return '-'
    const minH = lowestHandicapEntry[1]
    const tied = [...handicaps.entries()].filter(([, h]) => h === minH).map(([n]) => n)
    return formatWinners(tied, diffText(minH))
  })()

  const topBirdieText = (() => {
    if (!topBirdie || topBirdie.count === 0) return '-'
    const tied = birdieRanking.filter((r) => r.count === topBirdie.count)
    return formatWinners(tied.map((r) => r.name), `${topBirdie.count}개`)
  })()

  const topSingleBirdieText = (() => {
    if (!topSingleBirdie) return '-'
    const tied = singleBirdieRanking.filter((r) => r.count === topSingleBirdie.count)
    return formatWinners(tied.map((r) => r.name), `${topSingleBirdie.count}개`)
  })()

  const highlights = [
    { icon: '🏆', label: '최근 메달리스트', value: recentMedalText,    type: 'recentMedal'     as RankingType },
    { icon: '🥇', label: '최근 우승',       value: recentWinnerText,   type: 'recentWins'      as RankingType },
    { icon: '🏅', label: '최다 우승',       value: mostWinsText,       type: 'wins'            as RankingType },
    { icon: '🔥', label: '최다 연속 우승',  value: maxStreak > 0 ? `${shortName(maxStreakPlayer)} (${maxStreak}연승)` : '-', type: 'streak' as RankingType },
    { icon: '📉', label: '최저 핸디',       value: lowestHandiText,    type: 'lowestHandicap'  as RankingType },
    { icon: '🐦', label: '버디왕 (전체)',   value: topBirdieText,      type: 'birdie'          as RankingType },
    { icon: '⛳', label: '버디왕 (1경기)',  value: topSingleBirdieText, type: 'singleBirdie'   as RankingType },
  ]

  const MEDAL_BG = ['#fffbe8', '#f4f6f8', '#fdf5f0']
  const MEDAL_COLOR = [C.gold, C.silver, C.bronze]

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {rankingType && (
        <RankingModal config={rankingConfig[rankingType]} onClose={() => setRankingType(null)} />
      )}

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.green} />}
      >
        {/* 헤더 (공용) — 클럽명 오른쪽 멤버 버튼 */}
        <AppHeader myName={myName} showSettings />

        <View style={s.content}>
          {/* 클럽 없음 */}
          {!club && !loading && (
            <View style={s.emptyCard}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>⛳</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 }}>소속 클럽이 없어요</Text>
              <Text style={{ fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 }}>
                프로필에서 클럽을 만들거나{'\n'}초대 링크로 참여해보세요
              </Text>
              <TouchableOpacity style={s.goProfileBtn} onPress={() => nav.navigate('Profile')}>
                <Text style={s.goProfileBtnText}>프로필 바로가기 →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 기록 없음 */}
          {club && !loading && rounds.length === 0 && (
            <View style={s.emptyCard}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>🏌️</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>아직 클럽 기록이 없어요</Text>
            </View>
          )}

          {/* 핸디캡 랭킹 */}
          {handicapRanking.length > 0 && (
            <TouchableOpacity style={s.card} onPress={() => setRankingType('lowestHandicap')} activeOpacity={0.85}>
              <View style={s.cardTitleRow}>
                <Text style={s.cardTitle}>📊 핸디캡 랭킹 (최근 {handicapBasis}경기)</Text>
                <Text style={s.more}>전체보기 ›</Text>
              </View>
              {handicapRanking.slice(0, 5).map(({ name, handicap, avgScore }, i) => (
                <View key={name} style={[s.rankRow, i < 3 && { backgroundColor: MEDAL_BG[i], borderRadius: 10 }]}>
                  <Text style={[s.rankNum, i < 3 && { fontSize: 18 }]}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </Text>
                  <Text style={[s.rankName, myName && name === myName && { color: C.green, fontWeight: '700' }]}>
                    {shortName(name)}{myName && name === myName ? ' (나)' : ''}
                  </Text>
                  <Text style={[s.rankValue, { color: i < 3 ? MEDAL_COLOR[i] : C.text }]}>
                    {avgScore ? `${avgScore} (${diffText(handicap)})` : diffText(handicap)}
                  </Text>
                </View>
              ))}
            </TouchableOpacity>
          )}

          {/* 명예의 전당 */}
          {rounds.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>🏆 명예의 전당</Text>
              {highlights.map(({ icon, label, value, type }) => (
                <TouchableOpacity key={label} style={s.hallRow} onPress={() => setRankingType(type)}>
                  <View style={s.hallIconWrap}>
                    <Text style={{ fontSize: 15 }}>{icon}</Text>
                  </View>
                  <Text style={s.hallLabel}>{label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={s.hallValue}>{value}</Text>
                    <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 최근 클럽 라운드 */}
          {recent3.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>📅 최근 클럽 라운드</Text>
              {recent3.map((r) => {
                const best = Math.min(...r.players.map((p) => playerTotal(p.strokes)))
                const winner = getWinner(r, handicaps)
                return (
                  <TouchableOpacity key={r.id} style={s.roundRow} onPress={() => nav.navigate('RoundDetail', { id: r.id })}>
                    <View style={s.roundLeft}>
                      <Text style={s.roundCourse}>{r.courseName}</Text>
                      <Text style={s.roundMeta}>{r.date}  👥 {r.players.length}명</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <Text style={s.roundStat}>🏆 <Text style={{ color: C.text, fontWeight: '700' }}>{best}타</Text></Text>
                      {winner && <Text style={s.roundStat}>🥇 <Text style={{ color: C.green, fontWeight: '700' }}>{shortName(winner)}</Text></Text>}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

// ─── 랭킹 모달 ────────────────────────────────────────────────────────────────

function RankingModal({ config, onClose }: {
  config: { title: string; col: string; rows: { name: string; value: string; sub?: string }[] }
  onClose: () => void
}) {
  const MEDAL_BG = ['#fffbe8', '#f4f6f8', '#fdf5f0']
  const MEDAL_COLOR = [C.gold, C.silver, C.bronze]
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
              <View key={i} style={[s.tableRow, i < 3 && { backgroundColor: MEDAL_BG[i], borderRadius: 8, marginBottom: 2 }]}>
                <Text style={[s.td, { flex: 0.6, fontSize: i < 3 ? 17 : 13, textAlign: 'center' }]}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </Text>
                <View style={{ flex: 2.5 }}>
                  <Text style={[s.td, { fontWeight: i < 3 ? '700' : '500' }]}>{row.name}</Text>
                  {row.sub && <Text style={{ fontSize: 11, color: C.muted }}>{row.sub}</Text>}
                </View>
                <Text style={[s.td, { flex: 1.5, textAlign: 'right', fontWeight: '700', color: i < 3 ? MEDAL_COLOR[i] : C.text }]}>{row.value}</Text>
              </View>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.greenDark, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 3 },
  profileBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  profileInitial: { color: '#fff', fontSize: 16, fontWeight: '900' },

  clubSelector: { backgroundColor: C.greenDark, paddingBottom: 14 },
  clubPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  clubPillActive: { backgroundColor: '#fff' },
  clubPillText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  clubPillTextActive: { color: C.greenDark },

  content: { padding: 16 },

  emptyCard: { backgroundColor: C.card, borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 14 },
  goProfileBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: C.green, borderRadius: 20 },
  goProfileBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#1a6b44', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  more: { fontSize: 13, color: C.green, fontWeight: '600' },

  // 핸디캡 랭킹
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, marginBottom: 2 },
  rankNum: { width: 32, fontSize: 13, textAlign: 'center', color: C.muted },
  rankName: { flex: 1, fontSize: 14, fontWeight: '500', color: C.text },
  rankValue: { fontSize: 16, fontWeight: '800' },

  // 명예의 전당
  hallRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  hallIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  hallLabel: { flex: 1, fontSize: 13, color: C.muted },
  hallValue: { fontSize: 13, fontWeight: '600', color: C.text, textAlign: 'right', flexShrink: 1 },

  // 최근 라운드
  roundRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  roundLeft: { flex: 1 },
  roundCourse: { fontSize: 14, fontWeight: '700', color: C.text },
  roundMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  roundStat: { fontSize: 12, color: C.muted },

  memberBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  memberBtnText: {
    fontSize: 10, fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  clubDropdownBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6,
    maxWidth: 120,
  },
  clubDropdownText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dropdownOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingRight: 16,
  },
  dropdownCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    minWidth: 200, maxWidth: 260,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  dropdownTitle: {
    fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  dropdownRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dropdownRowDivider: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownClubName: { fontSize: 14, fontWeight: '700', color: C.text },
  dropdownClubSub: { fontSize: 11, color: C.muted, marginTop: 1 },

  muted: { fontSize: 13, color: C.muted },
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
