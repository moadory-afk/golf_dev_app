import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert, Image, Platform } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getRound, getRounds, deleteRound, updateRoundSettlement, playerTotal, totalPar, computeHandicaps, shortName } from '../lib/store'
import { AWARD_CONFIG_KEY, AWARD_CATEGORIES, fillToCount } from '../lib/awardConfig'
import { calcSettlement, holeNetForPlayer, fmtKRW } from '../features/settlement'
import { useAsync } from '../lib/useAsync'
import { useClub } from '../lib/ClubContext'
import { C } from '../theme'
import { Icon } from '../components/Icon'
import AppTabBar from '../components/AppTabBar'
import type { RootStackProps } from '../navigation/types'

type Mode = 'regular' | 'shinperio' | 'score' | 'settlement'

type AwardResult = { icon: string; label: string; winner: string; detail: string }

function computeAwardResult(
  id: string,
  round: { id: string; players: { name: string; strokes: number[] }[]; pars: number[]; shinperioHoles: number[] },
  handicaps: Map<string, number>,
  par: number,
  usedWinners?: Set<string>
): AwardResult | null {
  const def = AWARD_CATEGORIES.flatMap(c => c.items).find(a => a.id === id)
  if (!def) return null
  const { players, pars, shinperioHoles } = round
  const getTotal = (p: { strokes: number[] }) => p.strokes.reduce((s, v) => s + v, 0)
  // tiebreaker: 동점이면 총타수 낮은 순 (regularRank와 동일)
  const sortAsc = (arr: typeof players, key: (p: typeof players[0]) => number) =>
    [...arr].sort((a, b) => { const d = key(a) - key(b); return d !== 0 ? d : getTotal(a) - getTotal(b) })
  const sortDesc = (arr: typeof players, key: (p: typeof players[0]) => number) =>
    [...arr].sort((a, b) => { const d = key(b) - key(a); return d !== 0 ? d : getTotal(a) - getTotal(b) })
  const countHoles = (p: { strokes: number[] }, cond: (diff: number) => boolean) =>
    p.strokes.filter((v, i) => cond(v - pars[i])).length
  // startIdx부터 탐색해서 중복 수상자를 제외한 첫 번째 플레이어 반환
  const pickFrom = (arr: typeof players, startIdx: number) => {
    for (let i = startIdx; i < arr.length; i++) {
      if (!usedWinners?.has(arr[i].name)) return arr[i]
    }
    return undefined
  }
  const pickFirst = (arr: typeof players) => pickFrom(arr, 0)
  const fmtVsPar = (net: number) => {
    const d = net - par
    if (d === 0) return 'Net E'
    return d > 0 ? `Net +${d}` : `Net ${d}`
  }

  switch (id) {
    case 'medal': {
      const s = sortAsc(players, getTotal)
      const p = pickFirst(s)
      if (!p) return null
      return { ...def, winner: p.name, detail: `${getTotal(p)}타` }
    }
    case 'regular1': case 'regular2': case 'regular3': {
      // regular1=rank0, regular2=rank1, regular3=rank2 에서 시작해 중복 스킵
      const rank = Number(id.replace('regular', '')) - 1
      const s = sortAsc(players, p => getTotal(p) - (handicaps.get(p.name) ?? 0))
      const p = pickFrom(s, rank)
      if (!p) return null
      const net = getTotal(p) - (handicaps.get(p.name) ?? 0)
      return { ...def, winner: p.name, detail: fmtVsPar(net) }
    }
    case 'shin1': case 'shin2': {
      const rank = Number(id.replace('shin', '')) - 1
      if (!shinperioHoles.length) return null
      const s = sortAsc(players, p =>
        p.strokes.reduce((sum, v, i) => sum + (shinperioHoles.includes(i + 1) ? v : pars[i]), 0)
      )
      const p = pickFrom(s, rank)
      if (!p) return null
      const sc = p.strokes.reduce((sum, v, i) => sum + (shinperioHoles.includes(i + 1) ? v : pars[i]), 0)
      return { ...def, winner: p.name, detail: `${sc}타` }
    }
    case 'birdieKing': {
      const s = sortDesc(players, p => countHoles(p, d => d <= -1))
      const p = pickFirst(s)
      if (!p) return null
      const count = countHoles(p, d => d <= -1)
      if (count === 0) return null
      return { ...def, winner: p.name, detail: `${count}개` }
    }
    case 'eagleKing': {
      const s = sortDesc(players, p => countHoles(p, d => d <= -2))
      const p = pickFirst(s)
      if (!p) return null
      const count = countHoles(p, d => d <= -2)
      if (count === 0) return null
      return { ...def, winner: p.name, detail: `${count}개` }
    }
    case 'parKing': {
      const s = sortDesc(players, p => countHoles(p, d => d === 0))
      const p = pickFirst(s)
      if (!p) return null
      const count = countHoles(p, d => d === 0)
      return { ...def, winner: p.name, detail: `${count}개` }
    }
    case 'bogeyKing': {
      const s = sortDesc(players, p => countHoles(p, d => d === 1))
      const p = pickFirst(s)
      if (!p) return null
      const count = countHoles(p, d => d === 1)
      return { ...def, winner: p.name, detail: `${count}개 😅` }
    }
    case 'doublePlus': {
      const s = sortDesc(players, p => countHoles(p, d => d >= 2))
      const p = pickFirst(s)
      if (!p) return null
      const count = countHoles(p, d => d >= 2)
      return { ...def, winner: p.name, detail: `${count}개` }
    }
    case 'last': {
      const best = sortAsc(players, getTotal)[0]
      const s = sortDesc(players, getTotal)
      const p = pickFirst(s)
      if (!p || p.name === best.name) return null
      return { ...def, winner: p.name, detail: `${getTotal(p)}타` }
    }
    case 'fighter': {
      const s = sortDesc(players, getTotal)
      const p = pickFirst(s)
      if (!p) return null
      const birdies = countHoles(p, d => d <= -1)
      if (birdies === 0) return null
      return { ...def, winner: p.name, detail: `버디 ${birdies}개` }
    }
    case 'effort': {
      const s = sortDesc(players, p => countHoles(p, d => d <= 0))
      const p = pickFirst(s)
      if (!p) return null
      const count = countHoles(p, d => d <= 0)
      return { ...def, winner: p.name, detail: `파이하 ${count}개` }
    }
    case 'lucky': case 'bestDresser': {
      const seed = round.id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0)
      const startIdx = (seed + def.label.length) % players.length
      // 중복 시 순차적으로 다음 플레이어 탐색
      let pick = players[startIdx]
      if (usedWinners) {
        for (let k = 0; k < players.length; k++) {
          const candidate = players[(startIdx + k) % players.length]
          if (!usedWinners.has(candidate.name)) { pick = candidate; break }
        }
      }
      return { ...def, winner: pick.name, detail: '🎲 추첨' }
    }
    case 'longDrive': case 'nearPin':
      return { ...def, winner: '미입력', detail: '현장 확인' }
    default: return null
  }
}

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

function rankMedal(i: number) {
  return `${i + 1}`
}

function scoreColor(d: number): string {
  if (d <= -2) return C.eagle
  if (d === -1) return C.info
  if (d === 0) return C.muted
  if (d === 1) return C.warn
  return C.danger
}

function scoreFontWeight(d: number): '800' | '700' | '400' {
  if (d <= -2) return '800'
  if (d <= -1) return '700'
  return '400'
}

export default function RoundDetailScreen() {
  const route = useRoute<RootStackProps<'RoundDetail'>['route']>()
  const nav = useNavigation<RootStackProps<'RoundDetail'>['navigation']>()
  const [mode, setMode] = useState<Mode>('regular')
  const [recalcKey, setRecalcKey] = useState(0)
  const [recalcing, setRecalcing] = useState(false)
  const [applyHandicap, setApplyHandicap] = useState(false)
  const [handicapBasis, setHandicapBasis] = useState<3 | 5 | 10>(5)
  const [showShinDropdown, setShowShinDropdown] = useState(false)
  const [showRegularDropdown, setShowRegularDropdown] = useState(false)
  const [showHoleDetail, setShowHoleDetail] = useState(false)
  const [awardConfig, setAwardConfig] = useState<{ count: number; items: string[] } | null>(null)
  const { activeClub } = useClub()

  useEffect(() => {
    AsyncStorage.getItem('@gogopar_handicap_basis').then(v => {
      if (v === '3' || v === '5' || v === '10') setHandicapBasis(Number(v) as 3 | 5 | 10)
    })
    AsyncStorage.getItem(AWARD_CONFIG_KEY).then(v => {
      if (v) { try { setAwardConfig(JSON.parse(v)) } catch {} }
    })
  }, [])
  const isAdmin = activeClub?.role === 'admin'
  const { data: round, loading } = useAsync(() => getRound(route.params.id), [route.params.id, recalcKey])
  const { data: allRounds } = useAsync(async () => {
    if (!activeClub) return []
    return getRounds(activeClub.id)
  }, [activeClub?.id])

  if (loading) return <View style={s.center}><Text style={s.muted}>불러오는 중...</Text></View>
  if (!round) return <View style={s.center}><Text style={s.muted}>라운드를 찾을 수 없습니다.</Text></View>

  const par = totalPar(round.pars)
  const handicaps = computeHandicaps(allRounds ?? [], handicapBasis)

  const regularRank = round.players
    .map((p) => {
      let birdie = 0
      p.strokes.forEach((s, i) => { if (s - round.pars[i] <= -1) birdie++ })
      const handicap = handicaps.get(p.name) ?? 0
      const net = playerTotal(p.strokes) - handicap
      return { name: p.name, total: playerTotal(p.strokes), handicap, net, netVsPar: net - par, birdie }
    })
    .sort((a, b) => {
      if (applyHandicap) {
        const d = a.netVsPar - b.netVsPar
        return d !== 0 ? d : a.total - b.total   // 핸디Net 동점 → 총타수 낮은 순
      }
      return a.total - b.total
    })

  // 신페리오: 선정 홀은 실제 타수, 비선정 홀은 파로 대체 → 핸디캡 산출
  const shinRank = round.players
    .map((p) => {
      // 선정 홀만 실타, 나머지 파로 교체한 합계
      const shinScore = p.strokes.reduce((sum, s, i) => {
        return sum + (round.shinperioHoles.includes(i + 1) ? s : round.pars[i])
      }, 0)
      const N = round.shinperioHoles.length || 12
      // 신페리오 핸디 = (조정스코어 - 코스파) × (18/N) × 0.8
      const shinHandicap = Math.round((shinScore - par) * (18 / N) * 0.8)
      const net = playerTotal(p.strokes) - shinHandicap
      const total = playerTotal(p.strokes)
      const regularHandicap = handicaps.get(p.name) ?? 0
      const diff = shinScore - total   // 신페리오 타수 - 실제 타수 (음수 = 신페리오가 유리)
      let birdie = 0
      p.strokes.forEach((s, i) => { if (s - round.pars[i] <= -1) birdie++ })
      return { name: p.name, total, shinScore, handicap: shinHandicap, regularHandicap, diff, net, netVsPar: net - par, birdie }
    })
    .sort((a, b) => {
      if (applyHandicap) {
        // 핸디 적용: 신페리오 타수에서 정규 핸디 차감 후 정렬
        const aNet = a.shinScore - a.regularHandicap
        const bNet = b.shinScore - b.regularHandicap
        return aNet !== bNet ? aNet - bNet : a.shinScore - b.shinScore
      }
      return a.shinScore - b.shinScore
    })

  async function handleDelete() {
    const doDelete = async () => {
      try {
        await deleteRound(round!.id)
        nav.goBack()
      } catch {
        Alert.alert('오류', '삭제에 실패했습니다.')
      }
    }
    if (Platform.OS === 'web') {
      if (confirm('이 라운드를 삭제하시겠습니까?')) await doDelete()
    } else {
      Alert.alert('삭제', '이 라운드를 삭제하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: doDelete },
      ])
    }
  }

  function handleEdit() {
    nav.navigate('ScoreReview', {
      editId: round!.id,
      courseName: round!.courseName,
      date: round!.date,
      pars: round!.pars,
      players: round!.players.map((p) => ({
        name: p.name,
        diffs: p.strokes.map((s, i) => s - round!.pars[i]),
      })),
    })
  }

  async function handleRecalc() {
    if (!round?.settlement) return
    setRecalcing(true)
    try {
      // 정산 참가자(붉은색) 집합은 유지하고, 선수 목록에 없는 이름만 정리한다.
      // (경기만 하는 선수를 정산에 끌어들이지 않도록 전원 덮어쓰기는 하지 않음)
      await updateRoundSettlement(round.id, {
        ...round.settlement,
        participants: round.settlement.participants.filter((name) =>
          round.players.some((p) => p.name === name)
        ),
      })
      setRecalcKey((k) => k + 1)
    } catch (e: unknown) {
      Alert.alert('재계산 실패', e instanceof Error ? e.message : String(e))
    } finally {
      setRecalcing(false)
    }
  }

  const rankBg = ['#fffbe8', '#f4f6f8', '#fdf5f0']

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
      <View style={s.infoRow}>
        <Text style={s.muted}>{round.date}</Text>
        <Text style={s.muted}>참가 {round.players.length}명</Text>
      </View>

      {/* 탭 */}
      <View style={s.tabs}>
        {(['regular', 'shinperio', 'score', 'settlement'] as Mode[]).map((m) => (
          <TouchableOpacity key={m} style={[s.tab, mode === m && s.tabActive]} onPress={() => setMode(m)}>
            <Text style={[s.tabText, mode === m && s.tabTextActive]}>
              {m === 'regular' ? '정규' : m === 'shinperio' ? '신페리오' : m === 'score' ? '스코어' : '시상'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── 정규 순위 ── */}
      {mode === 'regular' && (
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, zIndex: 10 }}>
            <Text style={[s.cardTitle, { marginBottom: 0 }]}>정규 순위</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* 핸디 기준 드롭다운 */}
              <View>
                <TouchableOpacity
                  onPress={() => setShowRegularDropdown(v => !v)}
                  style={s.basisBtn}
                >
                  <Text style={s.basisBtnText}>{handicapBasis}경기 ▾</Text>
                </TouchableOpacity>
                {showRegularDropdown && (
                  <View style={s.basisMenu}>
                    {([3, 5, 10] as const).map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => { setHandicapBasis(n); setShowRegularDropdown(false) }}
                        style={s.basisMenuItem}
                      >
                        <Text style={[s.basisMenuText, handicapBasis === n && s.basisMenuTextActive]}>
                          {n}경기{handicapBasis === n ? ' ✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              {/* 핸디 적용 */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setApplyHandicap((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, applyHandicap && s.checkboxOn]}>
                  {applyHandicap && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: applyHandicap ? C.green : C.muted }}>핸디 적용</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.rankHeader}>
            <View style={{ width: 28 }} />
            <Text style={[s.rankHeaderCell, { flex: 2 }]} />
            <Text style={[s.rankHeaderCell, { flex: 1, textAlign: 'right' }]}>스코어</Text>
            <Text style={[s.rankHeaderCell, { flex: 1, textAlign: 'center' }]}>{applyHandicap ? '핸디Net' : '파대비'}</Text>
            <Text style={[s.rankHeaderCell, { flex: 0.7, textAlign: 'center' }]}>버디</Text>
          </View>
          {regularRank.map((r, i) => {
            const displayDiff = applyHandicap ? r.netVsPar : r.total - par
            return (
              <View key={r.name} style={[s.rankRow, i < 3 && { backgroundColor: rankBg[i] }]}>
                <Text style={[s.rankMedal, i >= 3 && { fontSize: 13, color: C.muted }]}>{rankMedal(i)}</Text>
                <Text style={s.rankName}>{shortName(r.name)}</Text>
                <Text style={s.rankScore}>{r.total}</Text>
                <Text style={[s.rankDiff, { color: displayDiff <= 0 ? C.green : C.warn }]}>{diffText(displayDiff)}</Text>
                <Text style={s.rankBirdie}>{r.birdie > 0 ? `버디 ${r.birdie}` : ''}</Text>
              </View>
            )
          })}
        </View>
      )}

      {/* ── 신페리오 순위 ── */}
      {mode === 'shinperio' && (
        <View style={s.card}>
          {/* 타이틀 + 정규핸디 기준 드롭다운 + 핸디 적용 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, zIndex: 10 }}>
            <Text style={[s.cardTitle, { marginBottom: 0 }]}>신페리오 순위</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* 정규 핸디 기준 드롭다운 */}
              <View>
                <TouchableOpacity
                  onPress={() => setShowShinDropdown(v => !v)}
                  style={s.basisBtn}
                >
                  <Text style={s.basisBtnText}>정규{handicapBasis}경기 ▾</Text>
                </TouchableOpacity>
                {showShinDropdown && (
                  <View style={s.basisMenu}>
                    {([3, 5, 10] as const).map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => { setHandicapBasis(n); setShowShinDropdown(false) }}
                        style={s.basisMenuItem}
                      >
                        <Text style={[s.basisMenuText, handicapBasis === n && s.basisMenuTextActive]}>
                          {n}경기{handicapBasis === n ? ' ✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              {/* 핸디 적용 */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                onPress={() => setApplyHandicap((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, applyHandicap && s.checkboxOn]}>
                  {applyHandicap && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: applyHandicap ? C.green : C.muted }}>핸디 적용</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[s.muted, { marginBottom: 10 }]}>선정 홀: {round.shinperioHoles.join(', ')}</Text>
          {/* 컬럼 헤더 */}
          <View style={s.rankHeader}>
            <View style={{ width: 28 }} />
            <Text style={[s.rankHeaderCell, { flex: 2 }]} />
            <Text style={[s.rankHeaderCell, { flex: 1, textAlign: 'right' }]}>스코어</Text>
            <Text style={[s.rankHeaderCell, { flex: 1, textAlign: 'center' }]}>신페리오</Text>
            <Text style={[s.rankHeaderCell, { flex: 0.9, textAlign: 'center' }]}>핸디차</Text>
            <Text style={[s.rankHeaderCell, { flex: 0.7, textAlign: 'center' }]}>버디</Text>
          </View>
          {shinRank.map((r, i) => (
            <View key={r.name} style={[s.rankRow, i < 3 && { backgroundColor: rankBg[i] }]}>
              <Text style={[s.rankMedal, i >= 3 && { fontSize: 13, color: C.muted }]}>{rankMedal(i)}</Text>
              <Text style={s.rankName}>{shortName(r.name)}</Text>
              <Text style={s.rankScore}>{r.total}</Text>
              <Text style={[s.rankDiff, { flex: 1, color: (r.shinScore - par) <= 0 ? C.green : C.warn }]}>{r.shinScore}</Text>
              <Text style={[s.rankDiff, { flex: 0.9, color: r.diff < 0 ? C.info : r.diff > 0 ? C.warn : C.muted }]}>{diffText(r.diff)}</Text>
              <Text style={s.rankBirdie}>{r.birdie > 0 ? `버디 ${r.birdie}` : ''}</Text>
            </View>
          ))}
        </View>
      )}

      {mode === 'score' && round.photoData.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>📸 스코어카드</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {round.photoData.map((uri, i) => (
              <Image key={i} source={{ uri }} style={s.photo} resizeMode="cover" />
            ))}
          </ScrollView>
        </View>
      )}

      {mode === 'score' && (
        <View style={s.card}>
          <Text style={s.cardTitle}>홀별 스코어 (파 대비)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* 헤더 */}
              <View style={{ flexDirection: 'row' }}>
                <Text style={s.hName} />
                {round.pars.slice(0, 9).map((_, i) => <Text key={i} style={s.hCell}>{i + 1}</Text>)}
                <Text style={[s.hSub, { color: C.green }]}>OUT</Text>
                {round.pars.slice(9).map((_, i) => <Text key={i + 9} style={s.hCell}>{i + 10}</Text>)}
                <Text style={[s.hSub, { color: C.green }]}>IN</Text>
                <Text style={[s.hSub, { color: C.text }]}>TOT</Text>
              </View>
              {/* 파 */}
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 2 }}>
                <Text style={[s.hName, { fontWeight: '700', color: C.muted }]}>파</Text>
                {round.pars.slice(0, 9).map((p, i) => <Text key={i} style={[s.hCell, { color: C.muted }]}>{p}</Text>)}
                <Text style={[s.hSub, { color: C.green, fontWeight: '700' }]}>{round.pars.slice(0, 9).reduce((a, b) => a + b, 0)}</Text>
                {round.pars.slice(9).map((p, i) => <Text key={i + 9} style={[s.hCell, { color: C.muted }]}>{p}</Text>)}
                <Text style={[s.hSub, { color: C.green, fontWeight: '700' }]}>{round.pars.slice(9).reduce((a, b) => a + b, 0)}</Text>
                <Text style={[s.hSub, { color: C.green, fontWeight: '700' }]}>{par}</Text>
              </View>
              {/* 플레이어 */}
              {round.players.map((player) => {
                const front = player.strokes.slice(0, 9)
                const back = player.strokes.slice(9)
                const fp = round.pars.slice(0, 9)
                const bp = round.pars.slice(9)
                const outD = front.reduce((a, b, i) => a + b - fp[i], 0)
                const inD = back.reduce((a, b, i) => a + b - bp[i], 0)
                const totD = playerTotal(player.strokes) - par
                return (
                  <View key={player.name} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <Text style={[s.hName, { fontWeight: '600' }]}>{shortName(player.name)}</Text>
                    {front.map((stroke, i) => {
                      const d = stroke - fp[i]
                      return (
                        <Text key={i} style={[s.hCell, { color: scoreColor(d), fontWeight: scoreFontWeight(d) }]}>
                          {diffText(d)}
                        </Text>
                      )
                    })}
                    <Text style={[s.hSub, { fontWeight: '700', color: outD <= 0 ? C.green : C.warn }]}>{diffText(outD)}</Text>
                    {back.map((stroke, i) => {
                      const d = stroke - bp[i]
                      return (
                        <Text key={i + 9} style={[s.hCell, { color: scoreColor(d), fontWeight: scoreFontWeight(d) }]}>
                          {diffText(d)}
                        </Text>
                      )
                    })}
                    <Text style={[s.hSub, { fontWeight: '700', color: inD <= 0 ? C.green : C.warn }]}>{diffText(inD)}</Text>
                    <Text style={[s.hSub, { fontWeight: '700', color: totD <= 0 ? C.green : C.warn }]}>{diffText(totD)}</Text>
                  </View>
                )
              })}
            </View>
          </ScrollView>

          {/* 범례 */}
          <View style={s.legend}>
            <Text style={[s.legendItem, { color: C.eagle }]}>■ 이글↓</Text>
            <Text style={[s.legendItem, { color: C.info }]}>■ 버디</Text>
            <Text style={[s.legendItem, { color: C.muted }]}>■ 파</Text>
            <Text style={[s.legendItem, { color: C.warn }]}>■ 보기</Text>
            <Text style={[s.legendItem, { color: C.danger }]}>■ 더블↑</Text>
          </View>
        </View>
      )}

      {/* 시상 탭 */}
      {mode === 'settlement' && (() => {
        const cfg = round.settlement

        // 클럽 시상 카드 (정산 유무와 무관하게 항상 표시)
        // count에 맞게 ranked 항목(shin1→2, regular1→2→3) 자동 보완
        const itemIds: string[] = awardConfig
          ? fillToCount(awardConfig.items, awardConfig.count)
          : ['medal', 'birdieKing', 'parKing', ...(round.shinperioHoles.length > 0 ? ['shin1'] : []), 'last']
        const _usedWinners = new Set<string>()
        const awardResults = itemIds
          .map(id => {
            const r = computeAwardResult(id, round, handicaps, par, _usedWinners)
            if (r && r.winner !== '미입력') _usedWinners.add(r.winner)
            return r
          })
          .filter((r): r is AwardResult => r !== null)
        const clubAwardCard = (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <Icon name="trophy" size={16} color={C.text} />
              <Text style={[s.cardTitle, { marginBottom: 0 }]}>클럽 시상</Text>
            </View>
            {awardResults.length === 0
              ? <Text style={s.muted}>설정된 시상 항목이 없습니다</Text>
              : awardResults.map((award, i) => (
                <View key={award.label + i} style={[s.awardRow, i === 0 && { borderTopWidth: 0 }]}>
                  <View style={s.awardIconWrap}>
                    <Text style={{ fontSize: 20 }}>{award.icon}</Text>
                  </View>
                  <Text style={s.awardTitle}>{award.label}</Text>
                  <Text style={s.awardWinner}>{shortName(award.winner)}</Text>
                  <View style={s.awardDetailWrap}>
                    <Text style={s.awardDetail}>{award.detail}</Text>
                  </View>
                </View>
              ))
            }
          </View>
        )

        // 정산 설정 없을 때 → 개별 시상 안내 + 클럽 시상
        if (!cfg) {
          return (
            <>
              <View style={s.card}>
                <Text style={s.cardTitle}>개별 시상</Text>
                <Text style={s.muted}>이 라운드에는 정산 설정이 없습니다.{'\n'}스코어 입력 시 정산 설정을 추가하세요.</Text>
              </View>
              {clubAwardCard}
            </>
          )
        }

        const result = calcSettlement(cfg, round.pars, round.players)
        const { participants, totals, holes } = result

        const pairs: { from: string; to: string; amount: number }[] = []
        for (let i = 0; i < participants.length; i++) {
          for (let j = i + 1; j < participants.length; j++) {
            const net = totals[participants[i]][participants[j]]
            if (net > 0) pairs.push({ from: participants[i], to: participants[j], amount: net })
            else if (net < 0) pairs.push({ from: participants[j], to: participants[i], amount: -net })
            else pairs.push({ from: participants[i], to: participants[j], amount: 0 })
          }
        }

        return (
          <>
            {/* 설정 요약 */}
            <View style={[s.card, { paddingVertical: 12 }]}>
              <Text style={s.muted}>
                타당 {cfg.strokeFee.toLocaleString('ko-KR')}원 · 버디 {cfg.birdieBonus.toLocaleString('ko-KR')}원 · 참가 {participants.length}명
              </Text>
            </View>

            {/* 개별 시상 */}
            <View style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={[s.cardTitle, { marginBottom: 0 }]}>개별 시상</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity style={s.holeDetailBtn} onPress={() => setShowHoleDetail(v => !v)}>
                    <Text style={s.holeDetailBtnText}>{showHoleDetail ? '홀별 내역 ▲' : '홀별 내역 ▼'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.recalcBtn, recalcing && { opacity: 0.5 }]} onPress={handleRecalc} disabled={recalcing}>
                    <Text style={s.recalcBtnText}>{recalcing ? '계산 중...' : '🔄 재계산'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {participants.length === 0 ? (
                <Text style={s.muted}>참가자 이름이 선수와 맞지 않습니다.{'\n'}🔄 재계산을 누르면 현재 선수 전원으로 다시 계산합니다.</Text>
              ) : (
                pairs.map((p, i) => (
                  <View key={i} style={s.settleRow}>
                    <Text style={s.settleName}>{shortName(p.from)}</Text>
                    <Text style={s.settleArrow}>→</Text>
                    <Text style={s.settleName}>{shortName(p.to)}</Text>
                    <Text style={[s.settleAmount, { color: p.amount === 0 ? C.muted : C.text }]}>
                      {p.amount === 0 ? '동점' : fmtKRW(p.amount)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* 클럽 시상 */}
            {clubAwardCard}

            {/* 홀별 내역 (토글) */}
            {showHoleDetail && (
              <View style={s.card}>
                <Text style={s.cardTitle}>홀별 내역</Text>
                {holes.map((h) => {
                  const nets = participants.map((name) => ({ name, net: holeNetForPlayer(h, name) }))
                  return (
                    <View key={h.hole} style={s.holeBlock}>
                      <View style={s.holeHeader}>
                        <Text style={s.holeNum}>{h.hole}홀</Text>
                        <Text style={s.holePar}>파{h.par}</Text>
                        {h.isBaepan && <View style={s.baepanBadge}><Text style={s.baepanText}>배판</Text></View>}
                        <Text style={[s.muted, { marginLeft: 'auto' }]}>{h.holeFee.toLocaleString('ko-KR')}원</Text>
                      </View>
                      <View style={s.holeNetRow}>
                        {nets.map(({ name, net }) => (
                          <View key={name} style={s.holeNetItem}>
                            <Text style={s.holeNetName}>{shortName(name)}</Text>
                            <Text style={[s.holeNetVal, { color: net > 0 ? C.green : net < 0 ? C.danger : C.muted }]}>
                              {net > 0 ? `+${fmtKRW(net)}` : net < 0 ? `-${fmtKRW(net)}` : '0'}
                            </Text>
                            {h.birdies.includes(name) && (
                              <Text style={{ fontSize: 10, color: C.info }}>{h.strokes[name] <= h.par - 2 ? 'E' : 'B'}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </>
        )
      })()}

      {/* 수정/삭제 */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={handleEdit}>
          <Text style={s.btnText}>수정</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: C.danger }]} onPress={handleDelete}>
            <Text style={s.btnText}>삭제</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
    <AppTabBar />
    </View>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  muted: { fontSize: 13, color: C.muted },
  card: {
    backgroundColor: C.card, borderRadius: 18, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  tabs: { flexDirection: 'row', backgroundColor: C.greenLight, borderRadius: 50, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 50 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, color: C.muted, fontWeight: '500' },
  tabTextActive: { color: C.green, fontWeight: '700' },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
    borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { borderColor: C.green, backgroundColor: C.green },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '900' },
  rankHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, marginBottom: 4,
  },
  rankHeaderCell: { fontSize: 10, fontWeight: '600', color: C.muted },
  rankRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    paddingHorizontal: 8, borderRadius: 10, marginBottom: 2,
  },
  rankMedal: { width: 28, fontSize: 18, textAlign: 'center' },
  rankName: { flex: 2, fontSize: 15, color: C.text, fontWeight: '600' },
  rankScore: { flex: 1, textAlign: 'right', fontSize: 17, fontWeight: '700', color: C.text },
  rankDiff: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800' },
  rankBirdie: { flex: 0.7, textAlign: 'center', fontSize: 13 },
  hName: { width: 54, fontSize: 12, color: C.text, paddingVertical: 7, paddingLeft: 2 },
  hCell: { width: 30, textAlign: 'center', fontSize: 12, paddingVertical: 7 },
  hSub: { width: 36, textAlign: 'center', fontSize: 12, fontWeight: '700', paddingVertical: 7 },
  legend: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  legendItem: { fontSize: 10, fontWeight: '600' },
  btn: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  photo: { width: 240, height: 160, borderRadius: 14, marginRight: 10 },
  recalcBtn: { backgroundColor: C.greenLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  recalcBtnText: { color: C.green, fontWeight: '700', fontSize: 13 },
  settleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  settleName: { fontSize: 14, fontWeight: '600', color: C.text, width: 54 },
  settleArrow: { fontSize: 14, color: C.muted, marginHorizontal: 4 },
  settleAmount: { marginLeft: 'auto', fontSize: 15, fontWeight: '700' },
  holeBlock: { borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 10 },
  holeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  holeNum: { fontSize: 13, fontWeight: '700', color: C.text, width: 28 },
  holePar: { fontSize: 12, color: C.muted },
  baepanBadge: { backgroundColor: '#fff0dc', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  baepanText: { fontSize: 10, fontWeight: '700', color: C.warn },
  holeNetRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  holeNetItem: { alignItems: 'center', minWidth: 60 },
  holeNetName: { fontSize: 11, color: C.muted },
  holeNetVal: { fontSize: 13, fontWeight: '700' },
  // 홀별 내역 토글 버튼
  holeDetailBtn: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  holeDetailBtnText: { fontSize: 12, color: C.text, fontWeight: '600' },
  // 시상 내역
  awardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.border,
  },
  awardIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fffbe8', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#f0e0a0',
  },
  awardTitle: { fontSize: 13, color: C.muted, fontWeight: '500', width: 80 },
  awardWinner: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  awardDetailWrap: { backgroundColor: C.greenLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  awardDetail: { fontSize: 13, fontWeight: '800', color: C.green },
  // 신페리오 기준 드롭다운
  basisBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: C.green, backgroundColor: C.green },
  basisBtnText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  basisMenu: { position: 'absolute', top: 30, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 20, zIndex: 100, minWidth: 90 },
  basisMenuItem: { paddingVertical: 10, paddingHorizontal: 16 },
  basisMenuText: { fontSize: 13, color: C.text },
  basisMenuTextActive: { color: C.green, fontWeight: '700' } as const,
})
