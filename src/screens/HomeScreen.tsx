import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getRounds, getClubMembers, getFeeDashboard, getFeeMemberHistory, playerTotal, totalPar, computeHandicaps, shortName, type SavedRound } from '../lib/store'
import {
  getRoundAttendanceMap,
  getRoundSchedules,
  getUpcomingRound,
  updateRoundAttendance,
  type RoundAttendanceLabel,
  type ScheduledRound,
} from '../lib/roundSchedule'
import { useClub } from '../lib/ClubContext'
import { useUserProfile } from '../lib/UserProfileContext'
import { useAsync } from '../lib/useAsync'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { UserAvatarBtn } from '../components/UserAvatar'
import { AppHeader } from '../components/AppHeader'
import { EmojiIcon } from '../components/EmojiIcon'
import { Icon } from '../components/Icon'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type PersonalDetailType = 'handicap' | 'average' | 'best' | 'wins' | 'singleBirdie' | 'records'

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

function formatShortDate(input: string) {
  if (!input) return '-'
  if (input.includes('T')) return input.slice(5, 10).replace('-', '.')
  if (input.includes('-')) return input.slice(5).replace('-', '.')
  return input
}

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
  const [roundRefreshKey, setRoundRefreshKey] = useState(0)
  const roundRealtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundRealtimeKey = useRef(`home-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const { activeClub: club, clubsLoaded } = useClub()

  // 클럽 로드 완료 후 소속 클럽 없으면 Club 탭으로 자동 이동
  useEffect(() => {
    if (clubsLoaded && !club) {
      nav.navigate('Main', { screen: 'Club' })
    }
  }, [clubsLoaded, club]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading } = useAsync(
    () => (club ? getRounds(club.id) : Promise.resolve([])),
    [refreshKey, club?.id],
  )
  const { data: clubMembers } = useAsync(
    () => (club ? getClubMembers(club.id) : Promise.resolve([])),
    [club?.id],
  )
  const { data: feeDashboard } = useAsync(
    () => (club ? getFeeDashboard(club.id) : Promise.resolve(null)),
    [club?.id, refreshKey],
  )
  const rounds = data ?? []
  const { name: myName, userId: myUserId } = useUserProfile()
  const [personalDetail, setPersonalDetail] = useState<PersonalDetailType | null>(null)
  const [h2hPlayer, setH2hPlayer] = useState<string | null>(null)
  const [recentRoundOpen, setRecentRoundOpen] = useState(false)
  const [roundAttendance, setRoundAttendance] = useState<Record<string, RoundAttendanceLabel>>({})
  const [showUpcomingCard, setShowUpcomingCard] = useState(false)
  const [attendanceSheetOpen, setAttendanceSheetOpen] = useState(false)
  const [roundSheetMode, setRoundSheetMode] = useState<'attendance' | 'groups'>('attendance')
  const [showFeeCard, setShowFeeCard] = useState(true)
  const [scheduledRounds, setScheduledRounds] = useState<ScheduledRound[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
    setRoundRefreshKey((k) => k + 1)
  }, [])

  const [handicapBasis, setHandicapBasis] = useState(5)
  const { data: myFeeHistory, loading: myFeeHistoryLoading } = useAsync(
    () => (club && myUserId ? getFeeMemberHistory(club.id, myUserId) : Promise.resolve([])),
    [club?.id, myUserId, refreshKey],
  )

  useEffect(() => {
    AsyncStorage.getItem('@gogopar_handicap_basis').then(v => {
      if (v === '3' || v === '5' || v === '10') setHandicapBasis(Number(v))
    })
  }, [])

  useEffect(() => {
    if (!club?.id) {
      setScheduledRounds([])
      setSelectedRoundId(null)
      return
    }
    getRoundSchedules(club.id).then((items) => {
      setScheduledRounds(items)
      setSelectedRoundId((current) => {
        if (current && items.some((item) => item.id === current)) return current
        return getUpcomingRound(items)?.id ?? items[0]?.id ?? null
      })
    })
  }, [club?.id, roundRefreshKey])

  useEffect(() => {
    if (!club?.id || !selectedRoundId) {
      setRoundAttendance({})
      return
    }
    getRoundAttendanceMap(club.id, selectedRoundId)
      .then(setRoundAttendance)
      .catch(() => setRoundAttendance({}))
  }, [club?.id, selectedRoundId, roundRefreshKey])

  useEffect(() => {
    if (!club?.id) return

    const queueRoundRefresh = () => {
      if (roundRealtimeTimer.current) clearTimeout(roundRealtimeTimer.current)
      roundRealtimeTimer.current = setTimeout(() => {
        setRoundRefreshKey((key) => key + 1)
      }, 500)
    }

    const channel = supabase
      .channel(`club-rounds:${club.id}:${roundRealtimeKey.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_round_schedules', filter: `club_id=eq.${club.id}` }, queueRoundRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_round_attendances', filter: `club_id=eq.${club.id}` }, queueRoundRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_round_groups', filter: `club_id=eq.${club.id}` }, queueRoundRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_round_group_members', filter: `club_id=eq.${club.id}` }, queueRoundRefresh)
      .subscribe()

    return () => {
      if (roundRealtimeTimer.current) clearTimeout(roundRealtimeTimer.current)
      supabase.removeChannel(channel)
    }
  }, [club?.id])

  const handicaps = computeHandicaps(rounds, handicapBasis)

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
  const myAverage = myEntries.length > 0
    ? Math.round(myEntries.reduce((sum, e) => sum + e.total, 0) / myEntries.length)
    : null
  const myHandicap = (() => {
    if (!myEntries.length) return null
    const sorted = [...myEntries].sort((a, b) => a.date.localeCompare(b.date))
    const lastN = sorted.slice(-handicapBasis)
    return Math.ceil(lastN.reduce((sum, e) => sum + (e.total - e.par), 0) / lastN.length)
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

  // 핸디캡 추이: 전체 기록 기반 5경기 슬라이딩 윈도우 → 마지막 10포인트 표시
  const myRoundsSorted = [...myEntries].sort((a, b) => a.date.localeCompare(b.date))
  const handicapTrend = myRoundsSorted.map((_, idx) => {
    const last5 = myRoundsSorted.slice(Math.max(0, idx - 4), idx + 1)
    return Math.ceil(last5.reduce((s, x) => s + (x.total - x.par), 0) / last5.length)
  }).slice(-10)

  const recent3 = rounds.slice(0, 3)
  const nextRound = scheduledRounds.find((item) => item.id === selectedRoundId) ?? scheduledRounds[0] ?? null
  const isAdmin = club?.role === 'admin'
  const roundGroups = nextRound?.groups ?? []
  const assignedGroups = roundGroups.filter((group) => group.members.length > 0)
  const assignedMemberIds = new Set(assignedGroups.flatMap((group) => group.members.map((member) => member.userId)))
  const unassignedMembers = (clubMembers ?? []).filter((member) => !assignedMemberIds.has(member.userId))
  const myRoundGroup = roundGroups.find((group) =>
    group.members.some((member) => member.userId === myUserId || member.name === myName)
  ) ?? null
  const hasUpcomingRound = Boolean(nextRound)
  const hasAssignedGroups = assignedGroups.length > 0
  const hasCourse = Boolean(nextRound?.courseName || (nextRound?.course && nextRound.course !== '미정'))
  const roundCourseName = hasCourse ? (nextRound?.courseName ?? nextRound?.course ?? '골프장 미정') : '골프장 미정'
  const roundCourseSummary = myRoundGroup
    ? `${myRoundGroup.frontLayoutName ?? '전반 미정'} / ${myRoundGroup.backLayoutName ?? '후반 미정'}`
    : (roundGroups[0]?.frontLayoutName || roundGroups[0]?.backLayoutName)
      ? `${roundGroups[0].frontLayoutName ?? '전반 미정'} / ${roundGroups[0].backLayoutName ?? '후반 미정'}`
      : (nextRound?.layoutName ?? '코스 미정')
  const teeTime = myRoundGroup?.time || nextRound?.time || '티오프 미정'
  const allGroupSummary = hasAssignedGroups ? `${assignedGroups.length}개 조 편성` : '조 미편성'
  const canApplyRound = hasUpcomingRound && !hasAssignedGroups
  const canOpenAttendance = hasUpcomingRound
  const canOpenGroupResult = hasUpcomingRound && hasAssignedGroups
  const roundCollapsedSummary = !nextRound
    ? '현재 예정된 라운딩이 없습니다'
    : scheduledRounds.length > 1
      ? `${scheduledRounds.length}개 일정 · ${nextRound.date} · ${roundCourseName}`
    : hasAssignedGroups
      ? `${nextRound.date} · ${roundCourseName} · ${teeTime} · ${myRoundGroup?.name ?? allGroupSummary}`
      : `${nextRound.date} · ${roundCourseName} · ${teeTime} · ${allGroupSummary}`
  const roundSummaryFor = (round: ScheduledRound) => {
    const groups = round.groups ?? []
    const assigned = groups.filter((group) => group.members.length > 0)
    const myGroup = groups.find((group) =>
      group.members.some((member) => member.userId === myUserId || member.name === myName)
    ) ?? null
    const courseName = round.courseName || (round.course && round.course !== '미정' ? round.course : '골프장 미정')
    const courseSummary = myGroup
      ? `${myGroup.frontLayoutName ?? '전반 미정'} / ${myGroup.backLayoutName ?? '후반 미정'}`
      : (groups[0]?.frontLayoutName || groups[0]?.backLayoutName)
        ? `${groups[0].frontLayoutName ?? '전반 미정'} / ${groups[0].backLayoutName ?? '후반 미정'}`
        : (round.layoutName ?? '코스 미정')
    const time = myGroup?.time || round.time || '티오프 미정'
    const groupTimes = assigned.map((group) => group.time).filter(Boolean)
    const groupSummary = assigned.length > 0
      ? `${assigned.length}조${groupTimes.length > 0 ? ` (${groupTimes.join(', ')})` : ''}`
      : '조 미편성'
    return { courseName, courseSummary, time, groupSummary, hasGroups: assigned.length > 0 }
  }
  const attendanceMembers = useMemo(() => {
    const statusOrder: Record<RoundAttendanceLabel, number> = { 참석: 0, 미정: 1, 불참: 2 }
    return [...(clubMembers ?? [])].sort((a, b) => {
      if (a.userId === myUserId) return -1
      if (b.userId === myUserId) return 1
      const statusDiff = statusOrder[roundAttendance[a.userId] ?? '미정'] - statusOrder[roundAttendance[b.userId] ?? '미정']
      if (statusDiff !== 0) return statusDiff
      return a.name.localeCompare(b.name, 'ko-KR')
    })
  }, [clubMembers, myUserId, roundAttendance])
  const recentRoundSummary = (() => {
    const recentRound = recent3[0]
    if (!recentRound || !myName) return { value: '-', sub: '기록 없음' }
    const player = recentRound.players.find((item) => item.name === myName)
    if (!player) return { value: '-', sub: '미참여' }
    return {
      value: `${playerTotal(player.strokes)}타`,
      sub: recentRound.courseName.slice(0, 5),
    }
  })()
  const headToHeadHandicapDiff = (() => {
    if (!myName || myHandicap === null) return 0
    let total = 0
    for (const round of rounds) {
      const me = round.players.find((player) => player.name === myName)
      if (!me) continue
      for (const opp of round.players) {
        if (opp.name === myName) continue
        total += myHandicap - (handicaps.get(opp.name) ?? 0)
      }
    }
    return total
  })()
  const feeCycleLabel = feeDashboard?.cycle?.label ?? '현재 회차'
  const currentMyFeeStatus = myUserId
    ? feeDashboard?.members.find((member) => member.userId === myUserId)
    : undefined
  const myFeeItems = (myFeeHistory?.length ?? 0) > 0
    ? (myFeeHistory ?? [])
    : currentMyFeeStatus && feeDashboard?.cycle
      ? [{
          ...currentMyFeeStatus,
          cycleLabel: feeDashboard.cycle.label,
          feeYear: feeDashboard.cycle.feeYear,
          feeMonth: feeDashboard.cycle.feeMonth,
        }]
      : []
  const myUnpaidFeeLabels = [...new Set(
    myFeeItems
      .filter((item) => item.status !== 'paid')
      .sort((a, b) => (a.feeYear ?? 0) - (b.feeYear ?? 0) || (a.feeMonth ?? 0) - (b.feeMonth ?? 0))
      .map((item) => item.feeMonth ? `${item.feeMonth}월` : (item.cycleLabel ?? '해당 회차'))
  )]
  const myHasUnpaidFee = myUnpaidFeeLabels.length > 0
  const feeStatusSummary = (() => {
    if (!feeDashboard?.policy || !feeDashboard?.cycle) return '회비 정책 없음'
    if (!myUserId || (myFeeHistoryLoading && myFeeItems.length === 0)) return '확인 중'
    if (!myHasUnpaidFee) return '오늘 기준 완납'
    return `오늘 기준 ${myUnpaidFeeLabels.join(',')} 미납`
  })()
  const nextAttendance = (value: RoundAttendanceLabel) => {
    const order: RoundAttendanceLabel[] = ['미정', '참석', '불참']
    return order[(order.indexOf(value) + 1) % order.length]
  }
  const saveRoundAttendance = async (userId: string, status: RoundAttendanceLabel) => {
    if (!club?.id || !nextRound?.id) return
    setRoundAttendance((prev) => ({ ...prev, [userId]: status }))
    try {
      await updateRoundAttendance(club.id, nextRound.id, userId, status)
    } catch {
      getRoundAttendanceMap(club.id, nextRound.id)
        .then(setRoundAttendance)
        .catch(() => {})
    }
  }
  const applyMemberAttendance = (userId: string) => {
    if (!canApplyRound) return
    const next = nextAttendance(roundAttendance[userId] ?? '미정')
    saveRoundAttendance(userId, next)
  }
  const openRoundSheet = (mode: 'attendance' | 'groups') => {
    if (mode === 'attendance' && !canOpenAttendance) return
    if (mode === 'groups' && !canOpenGroupResult) return
    setRoundSheetMode(mode)
    setAttendanceSheetOpen(true)
  }
  const openRoundSheetFor = (round: ScheduledRound) => {
    const hasGroups = round.groups.some((group) => group.members.length > 0)
    setSelectedRoundId(round.id)
    setRoundSheetMode(hasGroups ? 'groups' : 'attendance')
    setAttendanceSheetOpen(true)
  }

  // 클럽 로딩 전: 빈 화면 (모든 hook 호출 후)
  if (!clubsLoaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {h2hPlayer && (
        <HeadToHeadModal player={h2hPlayer} rounds={rounds} handicaps={handicaps} onClose={() => setH2hPlayer(null)} basis={handicapBasis} />
      )}
      {personalDetail && myName && (
        <PersonalDetailModal
          type={personalDetail} myName={myName} rounds={rounds}
          handicaps={handicaps} myRecords={myRecords}
          winCount={winCount} singleBirdieMap={singleBirdieMap} singleParMap={singleParMap}
          onClose={() => setPersonalDetail(null)} basis={handicapBasis} handicapTrend={handicapTrend}
        />
      )}
      {recentRoundOpen && recent3[0] && myName && (
        <RecentRoundModal round={recent3[0]} myName={myName} onClose={() => setRecentRoundOpen(false)} />
      )}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.green} />}
      >
        {/* 헤더 (공용) */}
        <AppHeader myName={myName} />

        <View style={s.content}>
          {/* 상단 요약 카드 */}
          <View style={s.statsRow}>
            <TouchableOpacity style={s.statCard} onPress={() => setPersonalDetail('handicap')}>
              <Text style={s.statLabel}>핸디캡</Text>
              <Text style={s.statValue}>{myHandicap !== null ? diffText(myHandicap) : '-'}</Text>
              <Text style={s.statSub}>최근 {handicapBasis}경기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.statCard} onPress={() => setPersonalDetail('average')}>
              <Text style={s.statLabel}>평균</Text>
              <Text style={s.statValue}>{myAverage !== null ? `${myAverage}타` : '-'}</Text>
              <Text style={s.statSub}>전체 경기 평균</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.statCard} onPress={() => setPersonalDetail('best')}>
              <Text style={s.statLabel}>베스트</Text>
              <Text style={[s.statValue, { color: C.gold }]}>{myBest ? `${myBest.total}타` : '-'}</Text>
              <Text style={s.statSub}>{myBest?.courseName.slice(0, 5) ?? ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.statCard}
              onPress={() => recent3[0] && setRecentRoundOpen(true)}
              disabled={!recent3[0]}
            >
              <Text style={s.statLabel}>최근라운드</Text>
              <Text style={s.statValue}>{recentRoundSummary.value}</Text>
              <Text style={s.statSub}>{recentRoundSummary.sub}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.statCard} onPress={() => setH2hPlayer(myName)}>
              <Text style={s.statLabel}>상대전적</Text>
              <Text style={s.statValue}>{diffText(headToHeadHandicapDiff)}타</Text>
              <Text style={s.statSub}>핸디차이</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.statCard} onPress={() => setPersonalDetail('records')}>
              <Text style={s.statLabel}>보유기록</Text>
              <Text style={s.statValue}>{ginnessRecords.length}개</Text>
              <Text style={s.statSub}>클럽 기준</Text>
            </TouchableOpacity>
          </View>

          {/* 클럽 없음 안내 */}
          {!club && !loading && (
            <View style={s.noClubCard}>
              <Icon name="flag" size={38} color={C.green} strokeWidth={1.6} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6, marginTop: 12 }}>클럽에 소속되어 있지 않아요</Text>
              <Text style={{ fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 }}>
                프로필에서 클럽을 만들거나{'\n'}초대 링크로 참여해보세요
              </Text>
            </View>
          )}

          <View style={s.protoSection}>
            <View style={s.protoCard}>
              <View style={s.protoTopRow}>
                <Text style={s.protoTitle}>예정된 라운드</Text>
                <View style={s.roundHeaderActions}>
                  <TouchableOpacity style={s.recordToggleBtn} onPress={() => setShowUpcomingCard((v) => !v)}>
                    <Text style={s.recordToggleText}>{showUpcomingCard ? '접기' : '펼치기'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {showUpcomingCard ? (
                <>
                  {scheduledRounds.length > 0 ? (
                    <View style={s.roundList}>
                      {scheduledRounds.map((round) => {
                        const summary = roundSummaryFor(round)
                        const selected = round.id === selectedRoundId
                        return (
                          <TouchableOpacity
                            key={round.id}
                            style={[
                              s.roundRow,
                              summary.hasGroups ? s.roundRowGroupReady : s.roundRowAttendanceReady,
                              selected && s.roundRowSelected,
                            ]}
                            onPress={() => openRoundSheetFor(round)}
                            activeOpacity={0.84}
                          >
                            <View style={{ flex: 1 }}>
                              <View style={s.roundLine}>
                                <Text style={s.roundCourse} numberOfLines={1}>
                                  {round.date} · {summary.courseName}
                                </Text>
                                <View style={[
                                  s.roundStageBadge,
                                  summary.hasGroups ? s.roundStageDone : s.roundStagePending,
                                ]}>
                                  <Text style={[
                                    s.roundStageText,
                                    summary.hasGroups ? s.roundStageTextDone : s.roundStageTextPending,
                                  ]}>
                                    {summary.hasGroups ? '조편성 완료' : '참석 확인중'}
                                  </Text>
                                </View>
                              </View>
                              <Text style={s.roundInfoText}>{summary.groupSummary}</Text>
                            </View>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  ) : (
                    <View style={[s.roundRow, s.roundRowDisabled]}>
                      <Text style={s.roundCourse}>현재 예정된 라운딩이 없습니다</Text>
                    </View>
                  )}
                </>
              ) : (
                <TouchableOpacity
                  style={[s.roundCollapsedBox, !hasUpcomingRound && s.roundRowDisabled]}
                  onPress={() => openRoundSheet(canOpenGroupResult ? 'groups' : 'attendance')}
                  disabled={!canOpenAttendance}
                >
                  <Text style={s.roundCollapsedText}>
                    {roundCollapsedSummary}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={s.protoCard}>
              <View style={s.protoTopRow}>
                <Text style={s.protoTitle}>회비관리 현황</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity style={s.recordToggleBtn} onPress={() => setShowFeeCard((v) => !v)}>
                    <Text style={s.recordToggleText}>{showFeeCard ? '접기' : '펼치기'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {showFeeCard ? (
                <>
                  <View style={s.feeSummaryBox}>
                    <View style={s.feeSummaryRow}>
                      <Text style={s.feeSummaryLabel}>납부 현황</Text>
                      <Text style={[s.feeSummaryValue, myHasUnpaidFee && s.feeSummaryValueWarn]}>
                        {feeStatusSummary}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={s.feeActionBtn} onPress={() => nav.navigate('FeePrototype')}>
                    <Text style={s.feeActionText}>회비관리 현황 확인 →</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={s.feeCollapsedBox}>
                  <Text style={s.feeCollapsedText}>{feeStatusSummary}</Text>
                </View>
              )}
            </View>
          </View>

          <Modal transparent animationType="fade" visible={attendanceSheetOpen && !!nextRound} onRequestClose={() => setAttendanceSheetOpen(false)}>
            <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setAttendanceSheetOpen(false)}>
              <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>{roundSheetMode === 'groups' ? '전체 조편성 결과' : '참가자 확인'}</Text>
                  <TouchableOpacity style={s.closeBtn} onPress={() => setAttendanceSheetOpen(false)}>
                    <Text style={s.closeBtnText}>닫기</Text>
                  </TouchableOpacity>
                </View>
                {roundSheetMode === 'groups' && canOpenGroupResult ? (
                  <ScrollView style={{ marginTop: 8, maxHeight: 500 }}>
                    <View style={s.groupSection}>
                      {assignedGroups.map((group) => (
                        <View key={group.id} style={s.groupSummaryCard}>
                          <View style={s.groupSummaryHeader}>
                            <Text style={s.groupSummaryTitle}>{group.name}</Text>
                            <Text style={s.groupSummaryTime}>{group.time || '미정'}</Text>
                          </View>
                          <Text style={s.groupSummaryCourse}>
                            {group.frontLayoutName ?? '전반 미정'} / {group.backLayoutName ?? '후반 미정'}
                          </Text>
                          <Text style={s.groupMemberName}>{group.members.map((member) => member.name).join(', ')}</Text>
                        </View>
                      ))}
                      <View style={[s.groupSummaryCard, s.unassignedCard]}>
                        <View style={s.groupSummaryHeader}>
                          <Text style={s.groupSummaryTitle}>미참가</Text>
                          <Text style={s.groupSummaryTime}>{unassignedMembers.length}명</Text>
                        </View>
                        {unassignedMembers.length > 0
                          ? <Text style={s.unassignedMemberName}>{unassignedMembers.map((member) => member.name).join(', ')}</Text>
                          : <Text style={s.groupSummaryMembers}>미참가 회원 없음</Text>}
                      </View>
                    </View>
                  </ScrollView>
                ) : (
                  <ScrollView style={{ marginTop: 8, maxHeight: 420 }}>
                    {attendanceMembers.map((member) => {
                      const status = roundAttendance[member.userId] ?? '미정'
                      const canToggleStatus = canApplyRound && (isAdmin || member.userId === myUserId)
                      return (
                        <View key={member.userId} style={s.attendanceMemberRow}>
                          <Text style={s.attendanceMemberName}>
                            {member.userId === myUserId ? `${member.name} (나)` : member.name}
                          </Text>
                          {canToggleStatus ? (
                            <TouchableOpacity
                              style={[
                                s.attendanceBtn,
                                status === '참석' && s.attendanceYes,
                                status === '불참' && s.attendanceNo,
                              ]}
                              onPress={() => {
                                if (!canApplyRound) return
                                applyMemberAttendance(member.userId)
                              }}
                              disabled={!canApplyRound}
                            >
                              <Text style={[
                                s.attendanceText,
                                status === '참석' && s.attendanceTextYes,
                                status === '불참' && s.attendanceTextNo,
                              ]}>
                                {status}
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={[
                              s.attendanceBtn,
                              s.attendanceBtnDisabled,
                              status === '참석' && s.attendanceYes,
                              status === '불참' && s.attendanceNo,
                            ]}>
                              <Text style={[
                                s.attendanceText,
                                status === '참석' && s.attendanceTextYes,
                                status === '불참' && s.attendanceTextNo,
                              ]}>
                                {status}
                              </Text>
                            </View>
                          )}
                        </View>
                      )
                    })}
                  </ScrollView>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* 기록 없음 */}
          {club && !loading && rounds.length === 0 && (
            <View style={s.emptyCard}>
              <Icon name="flag" size={34} color={C.green} strokeWidth={1.6} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 10 }}>아직 기록이 없어요</Text>
              <Text style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>첫 라운드를 기록해보세요!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

// ─── 상대 전적 모달 ───────────────────────────────────────────────────────────

function RecentRoundModal({ round, myName, onClose }: { round: SavedRound; myName: string; onClose: () => void }) {
  const player = round.players.find((p) => p.name === myName)
  const total = player ? playerTotal(player.strokes) : null
  const par = totalPar(round.pars)
  const diff = total !== null ? total - par : null
  const stats = player ? player.strokes.reduce((acc, score, index) => {
    const scoreDiff = score - round.pars[index]
    if (scoreDiff <= -1) acc.birdie += 1
    else if (scoreDiff === 0) acc.par += 1
    else if (scoreDiff === 1) acc.bogey += 1
    else if (scoreDiff === 2) acc.double += 1
    else acc.triplePlus += 1
    return acc
  }, { birdie: 0, par: 0, bogey: 0, double: 0, triplePlus: 0 }) : null

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>최근 라운드</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{round.courseName}</Text>
          <Text style={[s.muted, { marginTop: 4 }]}>{round.date}</Text>
          {player && total !== null && diff !== null && stats ? (
            <>
              <View style={s.recentRoundScoreBox}>
                <Text style={s.recentRoundScore}>{total}타</Text>
                <Text style={[s.recentRoundDiff, { color: diff <= 0 ? C.green : C.warn }]}>{diffText(diff)}</Text>
              </View>
              <View style={s.scoreDistRow}>
                <ScorePill label="버디" value={stats.birdie} color={C.info} />
                <ScorePill label="파" value={stats.par} color={C.green} />
                <ScorePill label="보기" value={stats.bogey} color={C.warn} />
                <ScorePill label="더블" value={stats.double} color={C.danger} />
                <ScorePill label="트리플+" value={stats.triplePlus} color={C.text} />
              </View>
            </>
          ) : (
            <Text style={[s.muted, { marginTop: 14 }]}>이 라운드에 내 기록이 없습니다.</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.scorePill}>
      <Text style={[s.scorePillValue, { color }]}>{value}</Text>
      <Text style={s.scorePillLabel}>{label}</Text>
    </View>
  )
}

function handicapAt(name: string, allRounds: SavedRound[], beforeDate: string, basis = 5): number {
  const prior = allRounds
    .filter((r) => r.date < beforeDate && r.players.some((p) => p.name === name))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-basis)
  if (!prior.length) return 0
  const diffs = prior.map((r) => {
    const p = r.players.find((pl) => pl.name === name)!
    return playerTotal(p.strokes) - totalPar(r.pars)
  })
  return Math.ceil(diffs.reduce((a, b) => a + b, 0) / diffs.length)
}

function HeadToHeadModal({ player, rounds, handicaps: _handicaps, onClose, basis = 5 }: {
  player: string; rounds: SavedRound[]; handicaps: Map<string, number>; onClose: () => void; basis?: number
}) {
  const [localBasis, setLocalBasis] = useState<3 | 5 | 10>(basis as 3 | 5 | 10)
  const [showDropdown, setShowDropdown] = useState(false)

  const localHandicaps = computeHandicaps(rounds, localBasis)
  const myHandicap = localHandicaps.get(player) ?? 0

  const opponents = new Map<string, { played: number; wins: number; losses: number }>()
  for (const r of rounds) {
    const me = r.players.find((p) => p.name === player)
    if (!me) continue
    const myH = handicapAt(player, rounds, r.date, localBasis)
    const myNet = playerTotal(me.strokes) - myH
    for (const opp of r.players) {
      if (opp.name === player) continue
      const oppH = handicapAt(opp.name, rounds, r.date, localBasis)
      const oppNet = playerTotal(opp.strokes) - oppH
      const rec = opponents.get(opp.name) ?? { played: 0, wins: 0, losses: 0 }
      rec.played++
      if (myNet < oppNet) rec.wins++
      else if (myNet > oppNet) rec.losses++
      opponents.set(opp.name, rec)
    }
  }
  const sorted = [...opponents.entries()]
    .map(([name, rec]) => ({ name, rec, oppH: localHandicaps.get(name) ?? 0, diff: myHandicap - (localHandicaps.get(name) ?? 0) }))
    .sort((a, b) => a.diff - b.diff)

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => { if (showDropdown) setShowDropdown(false) }}>
          <View style={[s.modalHeader, { zIndex: 10 }]}>
            <Text style={[s.modalTitle, { fontSize: 14 }]}>역대 전적 (핸디 {myHandicap > 0 ? '+' : ''}{myHandicap})</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View>
                <TouchableOpacity
                  onPress={() => setShowDropdown(v => !v)}
                  style={s.dropdownTrigger}
                >
                  <Text style={s.dropdownTriggerText}>{localBasis}경기 ▾</Text>
                </TouchableOpacity>
                {showDropdown && (
                  <View style={s.dropdownMenu}>
                    {([3, 5, 10] as const).map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => { setLocalBasis(n); setShowDropdown(false) }}
                        style={s.dropdownItem}
                      >
                        <Text style={[s.dropdownItemText, localBasis === n && s.dropdownItemActive]}>
                          {n}경기{localBasis === n ? ' ✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={onClose}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
            </View>
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

function PersonalDetailModal({ type, myName, rounds, handicaps, myRecords, winCount, singleBirdieMap, singleParMap, onClose, basis = 5, handicapTrend = [] }: {
  type: PersonalDetailType; myName: string; rounds: SavedRound[]
  handicaps: Map<string, number>; myRecords: string[]
  winCount: Map<string, number>
  singleBirdieMap: Map<string, { count: number; date: string; courseName: string }>
  singleParMap: Map<string, { count: number; date: string; courseName: string }>
  onClose: () => void; basis?: number; handicapTrend?: number[]
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
    title = `핸디캡 근거 (최근 ${basis}경기)`; headers = ['날짜', '코스', '스코어', '파대비']
    const last5 = myRounds.slice(-basis)
    rows = last5.map((e) => ({ cols: [e.date.slice(5), e.courseName.slice(0, 7), `${e.total}`, { text: diffText(e.diff), color: e.diff <= 0 ? C.green : C.warn }] }))
  } else if (type === 'average') {
    const avg = Math.round(myRounds.reduce((sum, e) => sum + e.total, 0) / myRounds.length)
    title = `전체 라운드 기록 (평균 ${avg}타)`; headers = ['날짜', '코스', '스코어', '평균차']
    rows = [...myRounds].sort((a, b) => b.date.localeCompare(a.date)).map((e) => {
      const diff = e.total - avg
      return { cols: [e.date.slice(5), e.courseName.slice(0, 7), `${e.total}`, { text: diffText(diff), color: diff <= 0 ? C.green : C.warn }] }
    })
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
              <Text style={s.modalTitle}>보유 신기록</Text>
              <TouchableOpacity style={s.closeBtn} onPress={onClose}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
            </View>
            <ScrollView>
              {myRecords.length === 0 ? (
                <Text style={[s.muted, { textAlign: 'center', paddingVertical: 20 }]}>현재 보유한 클럽 신기록이 없습니다.</Text>
              ) : myRecords.map((rec, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="medal" size={18} color={C.green} />
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
            {type === 'handicap' && handicapTrend.length >= 2 && (
              <View style={s.modalTrendBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <Icon name="trend" size={16} color={C.green} />
                  <Text style={[s.cardTitle, { marginBottom: 0 }]}>핸디캡 추이 (5경기 슬라이딩)</Text>
                </View>
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
                        <Text style={[s.trendCurrent, { color: isLast ? C.green : C.muted }]}>{diffText(h)}</Text>
                        <View style={[s.trendBar, { height: barH, backgroundColor: isLast ? C.green : C.greenLight, borderColor: isLast ? C.green : C.border }]} />
                      </View>
                    )
                  })}
                </View>
                <Text style={s.trendLabel}>← 과거  최근 →</Text>
              </View>
            )}
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
    flexDirection: 'row', alignItems: 'center',
  },
  clubBadgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  clubBadgeCaret: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginLeft: 4 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  clubMenu: {
    position: 'absolute', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 6, maxWidth: 260,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  clubMenuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  clubMenuItemActive: { backgroundColor: C.greenLight },
  clubMenuText: { fontSize: 14, color: C.text, fontWeight: '500' },
  clubMenuTextActive: { color: C.green, fontWeight: '700' },
  clubMenuCheck: { color: C.green, fontWeight: '800', fontSize: 14 },
  profileBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  profileInitial: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // 컨텐츠
  content: { padding: 16 },

  // 스탯 카드
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: {
    width: '31%', backgroundColor: C.card, borderRadius: 16, padding: 14,
    alignItems: 'center',
    shadowColor: '#1a6b44', shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  statCardMuted: { opacity: 0.65 },
  statLabel: { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '900', color: C.text },
  statSub: { fontSize: 10, color: C.muted, marginTop: 4, textAlign: 'center' },

  // 핸디캡 추이
  trendWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 72, marginVertical: 8 },
  trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: { width: '100%', borderRadius: 4, borderWidth: 1 },
  trendCurrent: { fontSize: 10, fontWeight: '800', color: C.green, marginBottom: 3 },
  trendLabel: { fontSize: 10, color: C.muted, textAlign: 'right', marginTop: 4 },
  modalTrendBox: { paddingBottom: 14, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },

  // 카드
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#1a6b44', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  recordToggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: C.greenLight,
  },
  recordToggleText: { fontSize: 12, color: C.green, fontWeight: '700' },
  recordCollapsedBox: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#f6fbf7',
    marginBottom: 4,
  },
  recordCollapsedText: { fontSize: 13, fontWeight: '700', color: C.green },

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

  protoSection: { marginBottom: 14, gap: 10 },
  protoCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#1a6b44',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  protoTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  protoTitle: { fontSize: 15, fontWeight: '800', color: C.text, flex: 1 },
  protoBadge: {
    backgroundColor: C.greenLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  protoBadgeText: { fontSize: 11, color: C.green, fontWeight: '800' },
  protoSub: { fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 18 },
  protoMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  protoMetaLabel: { fontSize: 11, color: C.muted, fontWeight: '700' },
  protoMetaValue: { fontSize: 12, color: C.text, fontWeight: '700', textAlign: 'right', flex: 1 },
  feeSummaryBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f6fbf7',
  },
  feeSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 4,
  },
  feeSummaryLabel: { fontSize: 11, color: C.muted, fontWeight: '700' },
  feeSummaryValue: { fontSize: 12, color: C.text, fontWeight: '800', textAlign: 'right', flex: 1 },
  feeSummaryValueWarn: { color: C.warn },
  feeCollapsedBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f6fbf7',
  },
  feeCollapsedText: { fontSize: 14, fontWeight: '800', color: C.text },
  feeCollapsedSub: { fontSize: 12, fontWeight: '700', color: C.green, marginTop: 4 },
  feeActionBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: C.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeActionText: { color: C.green, fontWeight: '800', fontSize: 13 },
  feeMemberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  feeMemberName: { fontSize: 13, fontWeight: '700', color: C.text, flex: 1 },
  feeMemberStatus: { fontSize: 12, fontWeight: '800' },
  feeMemberStatusPaid: { color: C.green },
  feeMemberStatusPartial: { color: C.warn },
  feeMemberStatusUnpaid: { color: '#d65b4a' },
  roundList: { gap: 8 },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.card,
  },
  roundRowAttendanceReady: { borderColor: '#d8e2d8' },
  roundRowGroupReady: { borderColor: C.green, backgroundColor: '#f6fbf7' },
  roundRowSelected: { borderWidth: 2, borderColor: C.green },
  roundRowDisabled: { opacity: 0.65 },
  roundLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundCourse: { flex: 1, fontSize: 14, color: C.text, fontWeight: '800' },
  roundInfoText: { fontSize: 12, color: C.text, fontWeight: '700' },
  roundHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  roundStageBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  roundStagePending: { backgroundColor: '#f3f5f3' },
  roundStageDone: { backgroundColor: C.greenLight },
  roundStageText: { fontSize: 10, fontWeight: '900' },
  roundStageTextPending: { color: C.muted },
  roundStageTextDone: { color: C.green },
  roundCollapsedBox: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#f6fbf7',
  },
  roundCollapsedText: { fontSize: 13, color: C.text, fontWeight: '700' },
  attendanceBtn: {
    minWidth: 72,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f3f5f3',
  },
  attendanceBtnDisabled: { opacity: 0.55 },
  attendanceYes: { backgroundColor: C.greenLight },
  attendanceNo: { backgroundColor: '#fdeeee' },
  attendanceText: { fontSize: 12, fontWeight: '800', color: C.muted },
  attendanceTextYes: { color: C.green },
  attendanceTextNo: { color: '#d65b4a' },
  roundGuideBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f6fbf7',
    gap: 4,
  },
  roundGuideText: { fontSize: 12, color: C.text, fontWeight: '700' },
  attendanceSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  attendanceSummaryText: { fontSize: 11, color: C.muted, fontWeight: '700' },
  groupSection: { marginTop: 14, gap: 10 },
  groupSectionTitle: { fontSize: 14, color: C.text, fontWeight: '800' },
  groupSummaryCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fff',
    gap: 6,
  },
  groupSummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupSummaryTitle: { fontSize: 13, color: C.text, fontWeight: '800' },
  groupSummaryTime: { fontSize: 12, color: C.green, fontWeight: '800' },
  groupSummaryCourse: { fontSize: 12, color: C.text, fontWeight: '700' },
  groupSummaryMembers: { fontSize: 12, color: C.muted, lineHeight: 18 },
  groupMemberList: { gap: 6, marginTop: 2 },
  groupMemberName: { fontSize: 13, color: C.text, fontWeight: '800' },
  unassignedCard: { backgroundColor: '#f8f8f8' },
  unassignedMemberName: { fontSize: 13, color: C.muted, fontWeight: '800' },
  attendanceMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  attendanceMemberName: { fontSize: 13, color: C.text, fontWeight: '700', flex: 1 },

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
  recentRoundScoreBox: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 16, marginBottom: 14 },
  recentRoundScore: { fontSize: 30, fontWeight: '900', color: C.text },
  recentRoundDiff: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  scoreDistRow: { flexDirection: 'row', gap: 7 },
  scorePill: { flex: 1, alignItems: 'center', backgroundColor: C.greenLight, borderRadius: 12, paddingVertical: 9 },
  scorePillValue: { fontSize: 16, fontWeight: '900' },
  scorePillLabel: { fontSize: 10, fontWeight: '800', color: C.muted, marginTop: 3 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: C.border, paddingBottom: 7, marginBottom: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 11, color: C.muted, fontWeight: '700' },
  td: { fontSize: 13, color: C.text },

  // 드롭다운
  dropdownTrigger: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.green, backgroundColor: C.green },
  dropdownTriggerText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  dropdownMenu: { position: 'absolute', top: 32, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 20, zIndex: 100, minWidth: 90 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 16 },
  dropdownItemText: { fontSize: 13, color: C.text },
  dropdownItemActive: { color: C.green, fontWeight: '700' } as const,
})
