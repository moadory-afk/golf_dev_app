import {
  ActivityIndicator, Alert, ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_LOTTO_AWARD_CONFIG, getClubLottoAwardConfig, getClubNotices, getCourseHoleGuides, getCourseLayouts, getPersonalRoundStat, getRoundLottoDraw, getRoundLottoEntries, getRoundLottoEntry, getRounds, getClubMembers, getFeeDashboard, getFeeMemberHistory, playerTotal, savePersonalRoundStat, saveRoundLottoDrawResult, saveRoundLottoEntry, totalPar, computeHandicaps, shortName, type ClubNotice, type CourseHoleGuide, type CourseLayout, type LottoAwardConfig, type PersonalRoundFir, type PersonalRoundHoleStat, type RoundLottoDraw, type RoundLottoDrawScore, type RoundLottoEntry, type SavedRound } from '../lib/store'
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
import { loadHandicapBasis, type HandicapBasis } from '../lib/handicapBasis'
import { C } from '../theme'
import { useSkin } from '../skins'
import { GPMascotHero, GPRoundTicket, GPStatCard } from '../design'
import { getOpenWeatherForRound, type RoundWeather } from '../lib/weather'
import { UserAvatarBtn } from '../components/UserAvatar'
import { AppHeader } from '../components/AppHeader'
import { EmojiIcon } from '../components/EmojiIcon'
import { Icon } from '../components/Icon'
import { AWARD_CATEGORIES } from '../lib/awardConfig'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type PersonalDetailType = 'handicap' | 'average' | 'best' | 'wins' | 'singleBirdie' | 'records'
type LottoSelection = { par3: number[]; par4: number[]; par5: number[] }
type LottoAwardRow = { userId: string; name: string; hits: number; total: number; hasScore: boolean; prize: number }
type PersonalCourseSegment = { label: string; layoutId?: string; start: number; end: number }

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

function formatWon(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString('ko-KR')}원`
}

function formatShortDate(input: string) {
  if (!input) return '-'
  if (input.includes('T')) return input.slice(5, 10).replace('-', '.')
  if (input.includes('-')) return input.slice(5).replace('-', '.')
  return input
}

function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function noticeReadKey(clubId?: string, userId?: string | null) {
  return `@gogopar_notice_reads:${clubId ?? 'none'}:${userId ?? 'guest'}`
}

function defaultHoleStats(pars: number[]): PersonalRoundHoleStat[] {
  return Array.from({ length: 18 }, (_, index) => ({
    hole: index + 1,
    par: pars[index] ?? 4,
    fir: null,
    putts: 2,
    penalties: 0,
  }))
}

function parsForScheduledRound(round: ScheduledRound, layouts: CourseLayout[], userId?: string | null, name?: string | null) {
  const segments = courseSegmentsForScheduledRound(round, layouts, userId, name)
  const pars = segments.flatMap((segment) => {
    const layout = layouts.find((item) => item.id === segment.layoutId)
    const length = segment.end - segment.start + 1
    return Array.from({ length }, (_, index) => layout?.pars[index] ?? 4)
  }).slice(0, 18)
  return pars.length === 18 ? pars : [...pars, ...Array.from({ length: 18 - pars.length }, () => 4)]
}

function groupForScheduledRound(round: ScheduledRound, userId?: string | null, name?: string | null) {
  return round.groups.find((item) =>
    item.members.some((member) => member.userId === userId || member.name === name)
  ) ?? round.groups.find((item) => item.members.length > 0) ?? round.groups[0]
}

function shortRoundDate(date?: string) {
  return date && date.length >= 10 ? date.slice(2) : date ?? ''
}

function courseSegmentsForScheduledRound(round: ScheduledRound, layouts: CourseLayout[], userId?: string | null, name?: string | null): PersonalCourseSegment[] {
  const group = groupForScheduledRound(round, userId, name)
  const candidates = [
    { id: group?.frontLayoutId, name: group?.frontLayoutName ?? '전반' },
    { id: group?.backLayoutId, name: group?.backLayoutName ?? '후반' },
    { id: round.layoutId, name: round.layoutName ?? '추가' },
  ].filter((item, index, list) => item.id || (item.name && index < 2))
    .filter((item, index, list) => list.findIndex((target) => target.id === item.id && target.name === item.name) === index)

  if (candidates.length === 0) {
    return [
      { label: '전반', start: 0, end: 8 },
      { label: '후반', start: 9, end: 17 },
    ]
  }

  let cursor = 0
  const segments: PersonalCourseSegment[] = []
  for (const candidate of candidates) {
    if (cursor >= 18) break
    const layout = layouts.find((item) => item.id === candidate.id)
    const length = Math.max(1, Math.min(layout?.holes ?? layout?.pars.length ?? 9, 18 - cursor))
    segments.push({
      label: layout?.name ?? candidate.name,
      layoutId: candidate.id,
      start: cursor,
      end: cursor + length - 1,
    })
    cursor += length
  }
  return segments
}

function teeDistanceItems(guide: CourseHoleGuide | null) {
  return guide
    ? [
        { color: '#2f67c7', value: guide.blueTeeM },
        { color: '#f7f7f2', value: guide.whiteTeeM, border: C.border },
        { color: '#d94f45', value: guide.redTeeM },
      ].filter((item): item is { color: string; value: number; border?: string } => typeof item.value === 'number')
    : []
}

function findSection(text: string, labels: string[], stopLabels: string[]) {
  const starts = labels
    .map((label) => ({ label, index: text.indexOf(label) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
  const start = starts[0]
  if (!start) return ''
  const end = stopLabels
    .map((label) => text.indexOf(label, start.index + start.label.length))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0]
  return text.slice(start.index, end ?? text.length).trim()
}

function splitGuideText(guide: CourseHoleGuide | null) {
  if (!guide) return { summary: '', strategy: '', caddie: '' }
  const source = guide.summary.trim()
  const strategyMatch = source.match(/(?:💡\s*)?공략\s*포인트\s*([\s\S]*)/i)
  const summary = strategyMatch && typeof strategyMatch.index === 'number'
    ? source.slice(0, strategyMatch.index).trim()
    : source
  const strategySource = guide.strategy?.trim() || strategyMatch?.[1]?.trim() || ''
  const cautionSource = guide.caution?.trim() || ''
  const combinedGuide = [strategySource, cautionSource].filter(Boolean).join('\n\n')
  const stopLabels = ['공략 전략', '골퍼 맞춤 전략', '티샷', '세컨샷', '세컨드샷', '세컨드 샷', '그린 공략', '주의사항', '캐디 한마디']
  const strategySections = [
    findSection(combinedGuide, ['공략 전략', '골퍼 맞춤 전략'], stopLabels),
    findSection(combinedGuide, ['티샷'], stopLabels),
    findSection(combinedGuide, ['세컨샷', '세컨드샷', '세컨드 샷', '그린 공략'], stopLabels),
  ].filter(Boolean)
  const caddieSections = [
    findSection(combinedGuide, ['주의사항'], stopLabels),
    findSection(combinedGuide, ['캐디 한마디'], stopLabels),
  ].filter(Boolean)
  return {
    summary,
    strategy: strategySections.join('\n\n') || strategySource,
    caddie: caddieSections.join('\n\n') || cautionSource,
  }
}

function difficultyFactorLabels(factors: CourseHoleGuide['difficultyFactors']) {
  if (!factors) return []
  if (Array.isArray(factors)) return factors.filter(Boolean)
  const labels: Record<string, string> = {
    length: '거리',
    ob: 'OB',
    hazard: '해저드',
    bunker: '벙커',
    dogleg: '도그렉',
    elevation: '고저차',
    green: '그린',
  }
  return Object.entries(factors)
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${labels[key] ?? key} ${value}`)
}

const emptyLottoSelection = (): LottoSelection => ({ par3: [], par4: [], par5: [] })

function lottoPurchaseSummary(selection?: LottoSelection) {
  if (!selection) return ''
  return [...selection.par3, ...selection.par4, ...selection.par5].sort((a, b) => a - b).join(',')
}

function weightedLottoScore(par: number): { score: number; label: string } {
  const rand = Math.random()
  const weights = par === 3
    ? [
        { limit: 0.1, diff: -1, label: '버디' },
        { limit: 0.6, diff: 0, label: '파' },
        { limit: 0.9, diff: 1, label: '보기' },
        { limit: 1, diff: 2, label: '더블+' },
      ]
    : [
        { limit: 0.1, diff: -1, label: '버디' },
        { limit: 0.6, diff: 0, label: '파' },
        { limit: 0.85, diff: 1, label: '보기' },
        { limit: 0.95, diff: 2, label: '더블' },
        { limit: 1, diff: par, label: '양파+' },
      ]
  const result = weights.find((item) => rand <= item.limit) ?? weights[weights.length - 1]
  return { score: Math.max(1, par + result.diff), label: result.label }
}

function generateLottoDrawScores(pars: number[]): Record<string, RoundLottoDrawScore> {
  return Object.fromEntries(pars.slice(0, 18).map((par, index) => {
    const hole = index + 1
    const result = weightedLottoScore(par)
    return [String(hole), { hole, par, score: result.score, label: result.label }]
  }))
}

function scoreName(score: number | undefined, par: number) {
  if (!score) return '-'
  const diff = score - par
  if (diff <= -1) return '버디'
  if (diff === 0) return '파'
  if (diff === 1) return '보기'
  if (diff === 2) return '더블'
  if (score >= par * 2) return '양파'
  return '트리플'
}

function lottoPrizeForHits(hits: number, config: LottoAwardConfig, jackpot: number) {
  if (hits === 6) return jackpot
  if (hits === 3 || hits === 4 || hits === 5) return config.prizes[String(hits) as '3' | '4' | '5']
  return 0
}

const AWARD_LABELS = new Map(AWARD_CATEGORIES.flatMap((category) => category.items).map((item) => [item.id, item.label]))

function awardSummaryFor(round?: ScheduledRound | null) {
  const items = round?.awardConfig?.items ?? []
  if (items.length === 0) return '시상 미설정'
  return items.map((id) => AWARD_LABELS.get(id) ?? id).join(', ')
}

function isVisibleUpcomingRound(round: ScheduledRound) {
  const status = String(round.status).trim()
  return status !== 'closed' && status !== 'finished'
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

function formatGroupCourse(group: { frontLayoutName?: string; backLayoutName?: string }, extraLayoutName?: string) {
  return [
    group.frontLayoutName ?? '전반 미정',
    group.backLayoutName ?? '후반 미정',
    extraLayoutName,
  ].filter(Boolean).join(' / ')
}

export default function HomeScreen() {
  const { palette, skinId } = useSkin()
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const [refreshKey, setRefreshKey] = useState(0)
  const [roundRefreshKey, setRoundRefreshKey] = useState(0)
  const roundRealtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundRealtimeKey = useRef(`home-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const noticeRealtimeKey = useRef(`notice-${Date.now()}-${Math.random().toString(36).slice(2)}`)
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
  const { data: lottoAwardConfigData } = useAsync(
    () => (club ? getClubLottoAwardConfig(club.id) : Promise.resolve(DEFAULT_LOTTO_AWARD_CONFIG)),
    [club?.id, refreshKey],
  )
  const rounds = data ?? []
  const { name: myName, userId: myUserId } = useUserProfile()
  const [personalDetail, setPersonalDetail] = useState<PersonalDetailType | null>(null)
  const [h2hPlayer, setH2hPlayer] = useState<string | null>(null)
  const [recentRoundOpen, setRecentRoundOpen] = useState(false)
  const [roundAttendance, setRoundAttendance] = useState<Record<string, RoundAttendanceLabel>>({})
  const [myRoundAttendance, setMyRoundAttendance] = useState<Record<string, RoundAttendanceLabel>>({})
  const [showUpcomingCard, setShowUpcomingCard] = useState(true)
  const [attendanceSheetOpen, setAttendanceSheetOpen] = useState(false)
  const [roundSheetMode, setRoundSheetMode] = useState<'attendance' | 'groups'>('attendance')
  const [scheduledRounds, setScheduledRounds] = useState<ScheduledRound[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [roundWeatherMap, setRoundWeatherMap] = useState<Record<string, RoundWeather | null>>({})
  const [personalInputRound, setPersonalInputRound] = useState<ScheduledRound | null>(null)
  const [personalHoleStats, setPersonalHoleStats] = useState<PersonalRoundHoleStat[]>([])
  const [personalHoleGuides, setPersonalHoleGuides] = useState<Record<number, CourseHoleGuide>>({})
  const [personalCourseSegments, setPersonalCourseSegments] = useState<PersonalCourseSegment[]>([])
  const [personalPage, setPersonalPage] = useState(0)
  const [personalLoading, setPersonalLoading] = useState(false)
  const [personalSaving, setPersonalSaving] = useState(false)
  const [personalEditable, setPersonalEditable] = useState(false)
  const [lottoRound, setLottoRound] = useState<ScheduledRound | null>(null)
  const [lottoPars, setLottoPars] = useState<number[]>([])
  const [lottoSelection, setLottoSelection] = useState<LottoSelection>(emptyLottoSelection)
  const [lottoDraw, setLottoDraw] = useState<RoundLottoDraw | null>(null)
  const [lottoEntries, setLottoEntries] = useState<RoundLottoEntry[]>([])
  const [lottoAwardConfigOverride, setLottoAwardConfigOverride] = useState<LottoAwardConfig | null>(null)
  const [myLottoPurchases, setMyLottoPurchases] = useState<Record<string, LottoSelection>>({})
  const [lottoLoading, setLottoLoading] = useState(false)
  const [lottoSaving, setLottoSaving] = useState(false)
  const [lottoDrawSaving, setLottoDrawSaving] = useState(false)
  const [noticeReadIds, setNoticeReadIds] = useState<string[]>([])
  const [noticePopup, setNoticePopup] = useState<ClubNotice | null>(null)
  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
    setRoundRefreshKey((k) => k + 1)
  }, [])

  const [handicapBasis, setHandicapBasis] = useState<HandicapBasis>(5)
  const { data: myFeeHistory, loading: myFeeHistoryLoading } = useAsync(
    () => (club && myUserId ? getFeeMemberHistory(club.id, myUserId) : Promise.resolve([])),
    [club?.id, myUserId, refreshKey],
  )
  const { data: homeNotices } = useAsync(
    () => (club ? getClubNotices(club.id) : Promise.resolve([])),
    [club?.id, refreshKey],
  )

  useEffect(() => {
    if (!club?.id) {
      setNoticeReadIds([])
      setNoticePopup(null)
      return
    }
    AsyncStorage.getItem(noticeReadKey(club.id, myUserId))
      .then((value) => setNoticeReadIds(value ? JSON.parse(value) : []))
      .catch(() => setNoticeReadIds([]))
  }, [club?.id, myUserId, refreshKey])

  useEffect(() => {
    if (!club?.id || noticePopup) return
    const unreadNotice = (homeNotices ?? [])
      .filter((notice) => notice.isPublished && !noticeReadIds.includes(notice.id))
      .sort((a, b) => {
        if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1
        return b.createdAt.localeCompare(a.createdAt)
      })[0]
    if (unreadNotice) setNoticePopup(unreadNotice)
  }, [club?.id, homeNotices, noticeReadIds, noticePopup])

  useEffect(() => {
    if (!club?.id) return
    const channel = supabase
      .channel(`club-notices:${club.id}:${noticeRealtimeKey.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_notices', filter: `club_id=eq.${club.id}` }, () => {
        setRefreshKey((value) => value + 1)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [club?.id])

  const reloadHandicapBasis = useCallback(() => {
    loadHandicapBasis(club?.id).then(setHandicapBasis)
  }, [club?.id])

  useEffect(() => {
    reloadHandicapBasis()
  }, [reloadHandicapBasis])

  useFocusEffect(
    useCallback(() => {
      reloadHandicapBasis()
    }, [reloadHandicapBasis]),
  )

  useEffect(() => {
    setLottoAwardConfigOverride(null)
  }, [club?.id])

  useEffect(() => {
    if (!club?.id) {
      setScheduledRounds([])
      setSelectedRoundId(null)
      return
    }
    getRoundSchedules(club.id).then((items) => {
      const activeItems = items.filter(isVisibleUpcomingRound)
      setScheduledRounds(activeItems)
      setSelectedRoundId((current) => {
        if (current && activeItems.some((item) => item.id === current)) return current
        return getUpcomingRound(activeItems)?.id ?? activeItems[0]?.id ?? null
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
    if (!club?.id || !myUserId || scheduledRounds.length === 0) {
      setMyRoundAttendance({})
      return
    }
    Promise.all(scheduledRounds.map(async (round) => {
      const map = await getRoundAttendanceMap(club.id, round.id)
      return [round.id, map[myUserId] ?? '미정'] as const
    }))
      .then((items) => setMyRoundAttendance(Object.fromEntries(items)))
      .catch(() => setMyRoundAttendance({}))
  }, [club?.id, myUserId, scheduledRounds, roundRefreshKey])

  useEffect(() => {
    if (!myUserId || scheduledRounds.length === 0) {
      setMyLottoPurchases({})
      return
    }
    Promise.all(scheduledRounds.map((round) => getRoundLottoEntry(round.id, myUserId)))
      .then((items) => {
        const next: Record<string, LottoSelection> = {}
        items.forEach((entry) => {
          if (entry) next[entry.scheduleId] = entry.selectedHoles
        })
        setMyLottoPurchases(next)
      })
      .catch(() => setMyLottoPurchases({}))
  }, [myUserId, scheduledRounds, roundRefreshKey])

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
  const visibleScheduledRounds = scheduledRounds.filter(isVisibleUpcomingRound)
  const today = todayKey()
  const todayScheduledRounds = visibleScheduledRounds.filter((item) => item.date === today)
  const upcomingScheduledRounds = todayScheduledRounds.length > 0
    ? []
    : visibleScheduledRounds.filter((item) => item.date > today)
  const activeScheduledRounds = todayScheduledRounds.length > 0 ? todayScheduledRounds : upcomingScheduledRounds
  const nextRound = activeScheduledRounds.find((item) => item.id === selectedRoundId) ?? activeScheduledRounds[0] ?? null
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
    ? formatGroupCourse(myRoundGroup, nextRound?.layoutName)
    : (roundGroups[0]?.frontLayoutName || roundGroups[0]?.backLayoutName)
      ? formatGroupCourse(roundGroups[0], nextRound?.layoutName)
      : (nextRound?.layoutName ?? '코스 미정')
  const teeTime = myRoundGroup?.time || nextRound?.time || '티오프 미정'
  const allGroupSummary = hasAssignedGroups ? `${assignedGroups.length}개 조 편성` : '조 미편성'


  useEffect(() => {
    const targets = activeScheduledRounds.slice(0, 3)
    if (targets.length === 0) {
      setRoundWeatherMap({})
      return
    }
    let cancelled = false
    Promise.all(targets.map(async (round) => {
      const summaryCourse = round.courseName ?? round.course
      const weather = await getOpenWeatherForRound({
        roundId: round.id,
        courseName: summaryCourse,
        date: round.date,
        time: round.groups[0]?.time || round.time,
      }).catch(() => null)
      return [round.id, weather] as const
    })).then((items) => {
      if (!cancelled) setRoundWeatherMap(Object.fromEntries(items))
    })
    return () => {
      cancelled = true
    }
  }, [activeScheduledRounds.map((round) => `${round.id}:${round.date}:${round.time}:${round.courseName ?? round.course}`).join('|')])
  const canApplyRound = hasUpcomingRound && !hasAssignedGroups
  const canOpenAttendance = hasUpcomingRound
  const canOpenGroupResult = hasUpcomingRound && hasAssignedGroups
  const roundCollapsedSummary = !nextRound
    ? '현재 예정된 라운딩이 없습니다'
    : activeScheduledRounds.length > 1
      ? `${activeScheduledRounds.length}개 일정 · ${nextRound.date} · ${roundCourseName}`
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
      ? formatGroupCourse(myGroup, round.layoutName)
      : (groups[0]?.frontLayoutName || groups[0]?.backLayoutName)
        ? formatGroupCourse(groups[0], round.layoutName)
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
  const lottoMyStrokes = (() => {
    if (!lottoRound || !myName) return null
    const round = rounds.find((item) => item.scheduleId === lottoRound.id)
    const player = round?.players.find((item) => item.name === myName)
    return player?.strokes ?? null
  })()
  const lottoRoundRecord = lottoRound ? rounds.find((item) => item.scheduleId === lottoRound.id) : undefined
  const lottoAwardConfig = lottoAwardConfigOverride ?? lottoAwardConfigData ?? DEFAULT_LOTTO_AWARD_CONFIG
  const lottoJackpot = lottoAwardConfig.prizes['6'] + (lottoAwardConfig.rollover ? lottoAwardConfig.carryoverAmount : 0)
  const lottoAwardRows = (() => {
    if (!lottoRound || !lottoDraw?.drawnScores) return []
    const rows = lottoEntries.map((entry) => {
      const member = (clubMembers ?? []).find((item) => item.userId === entry.userId)
      const name = member?.name ?? '이름 없음'
      const selectedHoles = [...entry.selectedHoles.par3, ...entry.selectedHoles.par4, ...entry.selectedHoles.par5].sort((a, b) => a - b)
      const player = lottoRoundRecord?.players.find((item) => item.name === name)
      const hits = player
        ? selectedHoles.filter((hole) => player.strokes[hole - 1] === lottoDraw.drawnScores?.[String(hole)]?.score).length
        : 0
      return {
        userId: entry.userId,
        name,
        hits,
        total: selectedHoles.length,
        hasScore: !!player,
        prize: player ? lottoPrizeForHits(hits, lottoAwardConfig, lottoJackpot) : 0,
      }
    })
    return rows
      .filter((row) => isAdmin || row.userId === myUserId)
      .sort((a, b) => b.hits - a.hits || b.prize - a.prize || a.name.localeCompare(b.name))
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
  const openRoundEditor = (round: ScheduledRound) => {
    nav.navigate('RoundSchedulePrototype', { editScheduleId: round.id, modalOnly: true })
  }
  const openPersonalRoundModal = async (round: ScheduledRound, editable: boolean, loadSaved: boolean) => {
    if (!club?.id) return
    setPersonalInputRound(round)
    setPersonalEditable(editable)
    setPersonalPage(0)
    setPersonalHoleGuides({})
    setPersonalCourseSegments([])
    setPersonalLoading(true)
    try {
      const layouts = round.courseId ? await getCourseLayouts(round.courseId) : []
      const segments = courseSegmentsForScheduledRound(round, layouts, myUserId, myName)
      setPersonalCourseSegments(segments)
      const baseStats = defaultHoleStats(parsForScheduledRound(round, layouts, myUserId, myName))
      const saved = loadSaved && myUserId ? await getPersonalRoundStat(round.id, myUserId) : null
      setPersonalHoleStats(saved?.holeStats?.length === 18 ? saved.holeStats : baseStats)
      try {
        const guides = await getCourseHoleGuides(segments.map((segment) => segment.layoutId).filter((id): id is string => !!id))
        const nextGuides: Record<number, CourseHoleGuide> = {}
        for (const guide of guides) {
          const segment = segments.find((item) => item.layoutId === guide.layoutId)
          const segmentLength = segment ? segment.end - segment.start + 1 : 0
          if (segment && guide.holeNo >= 1 && guide.holeNo <= segmentLength) {
            nextGuides[segment.start + guide.holeNo] = guide
          }
        }
        setPersonalHoleGuides(nextGuides)
      } catch {
        setPersonalHoleGuides({})
      }
    } catch {
      setPersonalHoleStats(defaultHoleStats(Array.from({ length: 18 }, () => 4)))
      setPersonalHoleGuides({})
      setPersonalCourseSegments([])
    } finally {
      setPersonalLoading(false)
    }
  }
  const openPersonalInput = async (round: ScheduledRound) => {
    if (!club?.id || !myUserId) {
      Alert.alert('확인', '로그인 정보가 필요합니다.')
      return
    }
    const assignedToRound = round.groups.some((group) =>
      group.members.some((member) => member.userId === myUserId || member.name === myName)
    )
    if (!isAdmin && !assignedToRound) return
    openPersonalRoundModal(round, assignedToRound, true)
  }
  const openCourseMap = (round: ScheduledRound) => {
    openPersonalRoundModal(round, false, false)
  }
  const updatePersonalHole = (hole: number, patch: Partial<PersonalRoundHoleStat>) => {
    setPersonalHoleStats((current) =>
      current.map((item) => item.hole === hole ? { ...item, ...patch } : item)
    )
  }
  const savePersonalInput = async () => {
    if (!club?.id || !myUserId || !personalInputRound || !personalEditable) return
    setPersonalSaving(true)
    try {
      await savePersonalRoundStat({
        clubId: club.id,
        scheduleId: personalInputRound.id,
        userId: myUserId,
        holeStats: personalHoleStats,
      })
      setPersonalInputRound(null)
      Alert.alert('저장 완료', '내 경기 입력을 저장했습니다.')
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : String(e))
    } finally {
      setPersonalSaving(false)
    }
  }
  const openLottoSelection = async (round: ScheduledRound) => {
    if (!club?.id || !myUserId) {
      Alert.alert('확인', '로그인 정보가 필요합니다.')
      return
    }
    const assignedToRound = round.groups.some((group) =>
      group.members.some((member) => member.userId === myUserId || member.name === myName)
    )
    if (!isAdmin && !assignedToRound) return
    setLottoRound(round)
    setLottoLoading(true)
    try {
      const layouts = round.courseId ? await getCourseLayouts(round.courseId) : []
      setLottoPars(parsForScheduledRound(round, layouts, myUserId, myName))
      const [saved, draw, entries, awardConfig] = await Promise.all([
        getRoundLottoEntry(round.id, myUserId),
        getRoundLottoDraw(round.id),
        getRoundLottoEntries(round.id),
        getClubLottoAwardConfig(club.id),
      ])
      setLottoSelection(saved?.selectedHoles ?? emptyLottoSelection())
      if (saved) {
        setMyLottoPurchases((current) => ({ ...current, [round.id]: saved.selectedHoles }))
      }
      setLottoDraw(draw)
      setLottoEntries(entries)
      setLottoAwardConfigOverride(awardConfig)
    } catch {
      setLottoPars(Array.from({ length: 18 }, () => 4))
      setLottoSelection(emptyLottoSelection())
      setLottoDraw(null)
      setLottoEntries([])
    } finally {
      setLottoLoading(false)
    }
  }
  const toggleLottoHole = (parKey: keyof LottoSelection, hole: number) => {
    const limits: Record<keyof LottoSelection, number> = { par3: 1, par4: 3, par5: 2 }
    setLottoSelection((current) => {
      const selected = current[parKey]
      if (selected.includes(hole)) {
        return { ...current, [parKey]: selected.filter((item) => item !== hole) }
      }
      if (selected.length >= limits[parKey]) return current
      return { ...current, [parKey]: [...selected, hole].sort((a, b) => a - b) }
    })
  }
  const isLottoReady = lottoSelection.par3.length === 1 && lottoSelection.par4.length === 3 && lottoSelection.par5.length === 2
  const saveLottoSelection = async () => {
    const assignedToRound = lottoRound?.groups.some((group) =>
      group.members.some((member) => member.userId === myUserId || member.name === myName)
    )
    if (!assignedToRound) return
    if (!club?.id || !myUserId || !lottoRound || !isLottoReady) return
    setLottoSaving(true)
    try {
      await saveRoundLottoEntry({
        clubId: club.id,
        scheduleId: lottoRound.id,
        userId: myUserId,
        selectedHoles: lottoSelection,
      })
      setMyLottoPurchases((current) => ({ ...current, [lottoRound.id]: lottoSelection }))
      setLottoEntries((current) => [
        ...current.filter((entry) => entry.userId !== myUserId),
        { clubId: club.id, scheduleId: lottoRound.id, userId: myUserId, selectedHoles: lottoSelection },
      ])
      setLottoRound(null)
      Alert.alert('구매 완료', 'Lotto 6/18 구매가 완료되었습니다.')
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : String(e))
    } finally {
      setLottoSaving(false)
    }
  }
  const runLottoDraw = async () => {
    if (!club?.id || !myUserId || !lottoRound) return
    if (lottoDraw?.drafterUserId !== myUserId) return
    setLottoDrawSaving(true)
    try {
      const drawnScores = generateLottoDrawScores(lottoPars.length === 18 ? lottoPars : Array.from({ length: 18 }, () => 4))
      await saveRoundLottoDrawResult(club.id, lottoRound.id, drawnScores)
      const nextDraw = await getRoundLottoDraw(lottoRound.id)
      setLottoDraw(nextDraw)
      Alert.alert('추첨 완료', '로또 추첨 결과를 저장했습니다.')
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : String(e))
    } finally {
      setLottoDrawSaving(false)
    }
  }
  const markNoticeRead = async (notice: ClubNotice) => {
    if (club?.id && !noticeReadIds.includes(notice.id)) {
      const next = [...noticeReadIds, notice.id]
      setNoticeReadIds(next)
      await AsyncStorage.setItem(noticeReadKey(club.id, myUserId), JSON.stringify(next))
    }
  }
  const closeNoticePopup = async () => {
    if (noticePopup) await markNoticeRead(noticePopup)
    setNoticePopup(null)
  }
  const openNoticePopupDetail = async () => {
    if (noticePopup) await markNoticeRead(noticePopup)
    setNoticePopup(null)
    nav.navigate('NoticePrototype')
  }

  // 클럽 로딩 전: 빈 화면 (모든 hook 호출 후)
  if (!clubsLoaded) return <View style={{ flex: 1, backgroundColor: palette.bg }} />

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
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
      {noticePopup && (
        <Modal transparent animationType="fade" visible={!!noticePopup} onRequestClose={closeNoticePopup}>
          <View style={s.noticePopupOverlay}>
            <View style={s.noticePopupCard}>
              <View style={s.noticePopupHeader}>
                <View style={s.noticePopupIcon}>
                  <Icon name="mail" size={18} color={C.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.noticePopupTitle}>공지사항</Text>
                  <Text style={s.noticePopupDate}>{formatShortDate(noticePopup.createdAt)}</Text>
                </View>
                {noticePopup.isImportant && <Text style={s.noticePopupImportant}>중요</Text>}
              </View>
              <Text style={s.noticePopupSubject}>{noticePopup.title}</Text>
              <Text style={s.noticePopupBody} numberOfLines={5}>{noticePopup.body || '내용 없음'}</Text>
              <View style={s.noticePopupActions}>
                <TouchableOpacity style={s.noticePopupCloseBtn} onPress={closeNoticePopup}>
                  <Text style={s.noticePopupCloseText}>닫기</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.noticePopupPrimaryBtn} onPress={openNoticePopupDetail}>
                  <Text style={s.noticePopupPrimaryText}>공지사항 보기</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.green} />}
      >
        {/* 헤더 (공용) */}
        <AppHeader myName={myName} />

        <View style={s.content}>
          {skinId === 'cuteGolf' ? (
            <GPMascotHero
              title={`${myName || '회원'}님, 오늘도 굿샷!`}
              message={hasUpcomingRound ? `${roundCourseName} 일정이 준비되어 있어요. 캐디북과 조편성을 확인해보세요.` : '아직 예정된 라운드가 없어요. 새 라운드를 잡아볼까요?'}
              stat={myHandicap !== null ? `현재 핸디 ${diffText(myHandicap)}` : '첫 기록을 기다리는 중'}
            />
          ) : null}

          {/* 상단 요약 카드 */}
          <View style={s.designStatsGrid}>
            <GPStatCard label="핸디캡" value={myHandicap !== null ? diffText(myHandicap) : '-'} sub={`최근 ${handicapBasis}경기`} onPress={() => setPersonalDetail('handicap')} />
            <GPStatCard label="평균" value={myAverage !== null ? `${myAverage}타` : '-'} sub="전체 경기 평균" onPress={() => setPersonalDetail('average')} />
            <GPStatCard label="베스트" value={myBest ? `${myBest.total}타` : '-'} sub={myBest?.courseName.slice(0, 5) ?? ''} accent={palette.gold} onPress={() => setPersonalDetail('best')} />
            <GPStatCard label="최근라운드" value={recentRoundSummary.value} sub={recentRoundSummary.sub} onPress={() => recent3[0] && setRecentRoundOpen(true)} />
            <GPStatCard label="상대전적" value={`${diffText(headToHeadHandicapDiff)}타`} sub="핸디차이" onPress={() => setH2hPlayer(myName)} />
            <GPStatCard label="보유기록" value={`${ginnessRecords.length}개`} sub="클럽 기준" onPress={() => setPersonalDetail('records')} />
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
            {todayScheduledRounds.length > 0 ? (
              <View style={s.protoCard}>
                <View style={s.protoTopRow}>
                  <Text style={s.protoTitle}>오늘의 라운딩</Text>
                </View>
                <View style={s.roundList}>
                  {todayScheduledRounds.map((round) => {
                    const summary = roundSummaryFor(round)
                    const purchaseSummary = lottoPurchaseSummary(myLottoPurchases[round.id])
                    const assignedToGroup = round.groups.some((group) =>
                      group.members.some((member) => member.userId === myUserId || member.name === myName)
                    )
                    const canEnterTodayPlayerActions = isAdmin || assignedToGroup
                    const canEditTodayPlayerActions = assignedToGroup
                    return (
                      <GPRoundTicket
                        key={round.id}
                        date={round.date}
                        course={summary.courseName}
                        status="진행일"
                        sub={summary.groupSummary}
                        award={`시상계획: ${awardSummaryFor(round)}${purchaseSummary ? `\n구매현황 : ${purchaseSummary} 구매 완료` : ''}`}
                        weather={roundWeatherMap[round.id]}
                        actions={(
                          <>
                            <TouchableOpacity
                              style={[s.todayActionBtn, !canEnterTodayPlayerActions && s.todayActionBtnDisabled]}
                              onPress={() => openPersonalInput(round)}
                              disabled={!canEnterTodayPlayerActions}
                              activeOpacity={0.82}
                            >
                              <Text style={[s.todayActionText, !canEditTodayPlayerActions && s.todayActionTextDisabled]}>캐디북</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.todayActionBtn, !canEnterTodayPlayerActions && s.todayActionBtnDisabled]}
                              onPress={() => openLottoSelection(round)}
                              disabled={!canEnterTodayPlayerActions}
                              activeOpacity={0.82}
                            >
                              <Text style={[s.todayActionText, !canEditTodayPlayerActions && s.todayActionTextDisabled]}>Lotto 6/18</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.todayActionBtn} onPress={() => openRoundSheetFor(round)} activeOpacity={0.82}>
                              <Text style={s.todayActionText}>조편성 결과</Text>
                            </TouchableOpacity>
                            {isAdmin ? (
                              <TouchableOpacity style={s.todayActionBtn} onPress={() => openRoundEditor(round)} activeOpacity={0.82}>
                                <Text style={s.todayActionText}>수정</Text>
                              </TouchableOpacity>
                            ) : null}
                          </>
                        )}
                      />
                    )
                  })}
                </View>
              </View>
            ) : (
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
                    {upcomingScheduledRounds.length > 0 ? (
                      <View style={s.roundList}>
                        {upcomingScheduledRounds.map((round) => {
                          const summary = roundSummaryFor(round)
                          const selected = round.id === selectedRoundId
                          return (
                            <GPRoundTicket
                              key={round.id}
                              date={round.date}
                              course={summary.courseName}
                              status={summary.hasGroups ? '조편성 완료' : '참석 확인중'}
                              sub={summary.groupSummary}
                              award={`시상계획: ${awardSummaryFor(round)}`}
                              selected={selected}
                              onPress={() => openRoundSheetFor(round)}
                              weather={roundWeatherMap[round.id]}
                              actions={(
                                <>
                                  <TouchableOpacity style={s.todayActionBtn} onPress={() => openCourseMap(round)} activeOpacity={0.82}>
                                    <Text style={s.todayActionText}>캐디북</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[s.todayActionBtn, s.todayActionBtnDisabled]}
                                    onPress={() => Alert.alert('안내', '라운딩 당일 구매 가능합니다')}
                                    activeOpacity={0.82}
                                  >
                                    <Text style={[s.todayActionText, s.todayActionTextDisabled]}>Lotto 6/18</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={s.todayActionBtn} onPress={() => openRoundSheetFor(round)} activeOpacity={0.82}>
                                    <Text style={s.todayActionText}>조편성 결과</Text>
                                  </TouchableOpacity>
                                  {isAdmin ? (
                                    <TouchableOpacity style={s.todayActionBtn} onPress={() => openRoundEditor(round)} activeOpacity={0.82}>
                                      <Text style={s.todayActionText}>수정</Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </>
                              )}
                            />
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
            )}

            {isAdmin ? (
              <TouchableOpacity
                style={s.adminRoundAddCard}
                onPress={() => nav.navigate('RoundSchedulePrototype', { openCreate: true, modalOnly: true })}
                activeOpacity={0.86}
              >
                <View style={s.adminRoundAddIcon}>
                  <Icon name="plus" size={20} color={C.green} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.adminRoundAddTitle}>라운드 일정 등록</Text>
                  <Text style={s.adminRoundAddSub}>새 일정을 바로 추가합니다.</Text>
                </View>
                <Icon name="chevronRight" size={18} color={C.muted} />
              </TouchableOpacity>
            ) : null}

            <View style={s.protoCard}>
              <View style={s.protoTopRow}>
                <Text style={s.protoTitle}>회비관리 현황</Text>
              </View>
              <View style={s.feeInlineRow}>
                <Text style={[s.feeStatusText, myHasUnpaidFee && s.feeStatusTextWarn]}>{feeStatusSummary}</Text>
                <TouchableOpacity style={s.feeLinkBtn} onPress={() => nav.navigate('FeePrototype')}>
                  <Text style={s.feeLinkText}>관리현황 확인 →</Text>
                </TouchableOpacity>
              </View>
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
                      <View style={s.awardSummaryBox}>
                        <Text style={s.awardSummaryLabel}>클럽시상</Text>
                        <Text style={s.awardSummaryText}>{awardSummaryFor(nextRound)}</Text>
                      </View>
                      {assignedGroups.map((group) => (
                        <View key={group.id} style={s.groupSummaryCard}>
                          <View style={s.groupSummaryHeader}>
                            <Text style={s.groupSummaryTitle}>{group.name}</Text>
                            <Text style={s.groupSummaryTime}>{group.time || '미정'}</Text>
                          </View>
                          <Text style={s.groupSummaryCourse}>
                            {formatGroupCourse(group, nextRound?.layoutName)}
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

          <PersonalRoundInputModal
            round={personalInputRound}
            stats={personalHoleStats}
            guides={personalHoleGuides}
            courseSegments={personalCourseSegments}
            page={personalPage}
            loading={personalLoading}
            saving={personalSaving}
            editable={personalEditable}
            onChangePage={setPersonalPage}
            onChangeHole={updatePersonalHole}
            onSave={savePersonalInput}
            onClose={() => setPersonalInputRound(null)}
          />
          <LottoSelectionModal
            round={lottoRound}
            pars={lottoPars}
            selection={lottoSelection}
            draw={lottoDraw}
            myUserId={myUserId}
            myStrokes={lottoMyStrokes}
            awardRows={lottoAwardRows}
            awardReady={!!lottoRoundRecord}
            awardConfig={lottoAwardConfig}
            jackpot={lottoJackpot}
            purchased={!!(lottoRound && myLottoPurchases[lottoRound.id])}
            canPurchase={!!lottoRound?.groups.some((group) =>
              group.members.some((member) => member.userId === myUserId || member.name === myName)
            )}
            loading={lottoLoading}
            saving={lottoSaving}
            drawSaving={lottoDrawSaving}
            ready={isLottoReady}
            onToggle={toggleLottoHole}
            onSave={saveLottoSelection}
            onDraw={runLottoDraw}
            onClose={() => setLottoRound(null)}
          />

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

function PersonalRoundInputModal({
  round,
  stats,
  guides,
  courseSegments,
  page,
  loading,
  saving,
  editable,
  onChangePage,
  onChangeHole,
  onSave,
  onClose,
}: {
  round: ScheduledRound | null
  stats: PersonalRoundHoleStat[]
  guides: Record<number, CourseHoleGuide>
  courseSegments: PersonalCourseSegment[]
  page: number
  loading: boolean
  saving: boolean
  editable: boolean
  onChangePage: (page: number) => void
  onChangeHole: (hole: number, patch: Partial<PersonalRoundHoleStat>) => void
  onSave: () => void
  onClose: () => void
}) {
  const currentStat = stats[page]
  const maxPage = 17
  const holeGuide = currentStat ? guides[currentStat.hole] ?? null : null
  const visibleCourseSegments = courseSegments.length > 0 ? courseSegments : [
    { label: '전반', start: 0, end: 8 },
    { label: '후반', start: 9, end: 17 },
  ]
  const activeSegment = visibleCourseSegments.find((item) => page >= item.start && page <= item.end) ?? visibleCourseSegments[0]
  const displayHoleNo = activeSegment ? page - activeSegment.start + 1 : currentStat?.hole ?? page + 1
  const modalCourseLine = round
    ? `${shortRoundDate(round.date)} ${(round.courseName ?? round.course).trim()} ${visibleCourseSegments.map((item) => item.label).join(' ')}`
    : ''
  const currentTeeDistances = teeDistanceItems(holeGuide)

  return (
    <Modal transparent animationType="fade" visible={!!round} onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[s.modalCard, s.personalModalCard]} activeOpacity={1} onPress={() => {}}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>내 경기 입력</Text>
              <Text style={s.personalModalSub}>{modalCourseLine}</Text>
            </View>
            {editable ? (
              <TouchableOpacity
                style={[s.closeBtn, (saving || loading) && { opacity: 0.6 }]}
                onPress={onSave}
                disabled={saving || loading}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.closeBtnText}>저장</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                <Text style={s.closeBtnText}>닫기</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={s.personalLoadingBox}>
              <ActivityIndicator color={C.green} />
              <Text style={s.muted}>불러오는 중</Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.personalPageScroll} contentContainerStyle={s.personalPageTabs}>
                {visibleCourseSegments.map((segment) => (
                  <TouchableOpacity
                    key={`${segment.label}-${segment.start}`}
                    style={[s.personalPageTab, activeSegment?.start === segment.start && s.personalPageTabActive]}
                    onPress={() => onChangePage(segment.start)}
                    activeOpacity={0.82}
                  >
                    <Text style={[s.personalPageTabText, activeSegment?.start === segment.start && s.personalPageTabTextActive]}>
                      {segment.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={s.currentHoleSummary}>
                <Text style={s.currentHoleTitle}>
                  {activeSegment?.label ?? ''} {displayHoleNo}번 {currentStat ? `(Par ${currentStat.par})` : ''}
                </Text>
                {currentTeeDistances.length > 0 ? (
                  <View style={s.teeDistanceRow}>
                    {currentTeeDistances.map((item) => (
                      <View key={item.value} style={s.teeDistanceItem}>
                        <View style={[s.teeDistanceDot, { backgroundColor: item.color, borderColor: item.border ?? item.color }]} />
                        <Text style={s.teeDistanceText}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
              {currentStat ? (
                <PersonalHoleCard
                  stat={currentStat}
                  guide={holeGuide}
                  editable={editable}
                  onChange={(patch) => editable && onChangeHole(currentStat.hole, patch)}
                />
              ) : null}
              <View style={s.personalFooter}>
                <TouchableOpacity
                  style={[s.personalNavBtn, page === 0 && s.personalNavBtnDisabled]}
                  onPress={() => onChangePage(Math.max(activeSegment?.start ?? 0, page - 1))}
                  disabled={page === (activeSegment?.start ?? 0)}
                >
                  <Text style={s.personalNavText}>이전</Text>
                </TouchableOpacity>
                {page < (activeSegment?.end ?? maxPage) ? (
                  <TouchableOpacity style={s.personalSaveBtn} onPress={() => onChangePage(page + 1)}>
                    <Text style={s.personalSaveText}>다음</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[s.personalSaveBtn, (!editable || saving) && { opacity: 0.6 }]} onPress={onSave} disabled={!editable || saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.personalSaveText}>저장 완료</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

function PersonalHoleCard({ stat, guide, editable, onChange }: {
  stat: PersonalRoundHoleStat
  guide: CourseHoleGuide | null
  editable: boolean
  onChange: (patch: Partial<PersonalRoundHoleStat>) => void
}) {
  const firDisabled = stat.par === 3
  const [guideTab, setGuideTab] = useState<'summary' | 'strategy' | 'caddie'>('summary')
  const guideText = splitGuideText(guide)
  const difficultyFactors = difficultyFactorLabels(guide?.difficultyFactors)
  const guideBody = !guide
    ? '등록된 코스 공략 정보가 없습니다.'
    : guideTab === 'summary'
      ? (guideText.summary || '등록된 코스 설명이 없습니다.')
      : guideTab === 'strategy'
        ? (guideText.strategy || '등록된 공략 전략이 없습니다.')
        : (guideText.caddie || '등록된 캐디 한마디가 없습니다.')
  return (
    <View style={s.personalHoleCard}>
      <ScrollView style={s.personalGuideScroll} showsVerticalScrollIndicator>
        <View style={s.personalGuideTabs}>
          {[
            { key: 'summary', label: '코스설명' },
            { key: 'strategy', label: '공략전략' },
            { key: 'caddie', label: '캐디 한마디' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[s.personalGuideTab, guideTab === tab.key && s.personalGuideTabActive]}
              onPress={() => setGuideTab(tab.key as 'summary' | 'strategy' | 'caddie')}
              activeOpacity={0.85}
            >
              <Text style={[s.personalGuideTabText, guideTab === tab.key && s.personalGuideTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.personalHoleGuide}>
          {guide?.baseDifficulty || difficultyFactors.length > 0 ? (
            <View style={s.personalDifficultyBox}>
              {guide?.baseDifficulty ? (
                <Text style={s.personalDifficultyText}>기본 난이도 {guide.baseDifficulty}</Text>
              ) : null}
              {difficultyFactors.length > 0 ? (
                <View style={s.personalDifficultyFactors}>
                  {difficultyFactors.slice(0, 4).map((factor) => (
                    <Text key={factor} style={s.personalDifficultyFactor}>{factor}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={s.personalHoleGuideText}>{guideBody}</Text>
        </View>
      </ScrollView>
      <View style={s.personalFixedInputs}>
        {firDisabled ? (
          <View style={s.firDisabledBox}>
            <Text style={s.personalDisabledText}>파3는 티샷 방향 기록을 생략합니다.</Text>
          </View>
        ) : (
          <View style={s.statTagRow}>
            <Text style={s.personalFieldLabel}>티샷</Text>
            <FirPicker value={stat.fir} disabled={!editable} onChange={(fir) => onChange({ fir })} />
          </View>
        )}
        <StatTagRow label="퍼팅수" value={stat.putts} options={[0, 1, 2, 3, 4]} disabled={!editable} onChange={(putts) => onChange({ putts })} />
      </View>
    </View>
  )
}

function FirPicker({ value, disabled, onChange }: { value: PersonalRoundFir; disabled?: boolean; onChange: (value: PersonalRoundFir) => void }) {
  const options: Array<{ label: string; value: PersonalRoundFir }> = [
    { label: '좌OB', value: 'left_ob' },
    { label: '우OB', value: 'right_ob' },
    { label: '해저드', value: 'hazard' },
  ]

  return (
    <View style={s.firWrap}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <TouchableOpacity
            key={option.label}
            style={[s.firButton, active && s.firButtonActive, disabled && { opacity: 0.5 }]}
            onPress={() => onChange(active ? null : option.value)}
            disabled={disabled}
            activeOpacity={0.82}
          >
            <Text style={[s.firButtonText, active && s.firButtonTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function StatTagRow({ label, value, options, disabled, onChange }: { label: string; value: number; options: number[]; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <View style={s.statTagRow}>
      <Text style={s.personalFieldLabel}>{label}</Text>
      <View style={s.statTagList}>
        {options.map((option) => {
          const active = value === option
          return (
            <TouchableOpacity
              key={`${label}-${option}`}
              style={[s.statTag, active && s.statTagActive, disabled && { opacity: 0.5 }]}
              onPress={() => onChange(option)}
              disabled={disabled}
              activeOpacity={0.82}
            >
              <Text style={[s.statTagText, active && s.statTagTextActive]}>{option}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function LottoSelectionModal({
  round,
  pars,
  selection,
  draw,
  myUserId,
  myStrokes,
  awardRows,
  awardReady,
  awardConfig,
  jackpot,
  purchased,
  canPurchase,
  loading,
  saving,
  drawSaving,
  ready,
  onToggle,
  onSave,
  onDraw,
  onClose,
}: {
  round: ScheduledRound | null
  pars: number[]
  selection: LottoSelection
  draw: RoundLottoDraw | null
  myUserId: string | null
  myStrokes: number[] | null
  awardRows: LottoAwardRow[]
  awardReady: boolean
  awardConfig: LottoAwardConfig
  jackpot: number
  purchased: boolean
  canPurchase: boolean
  loading: boolean
  saving: boolean
  drawSaving: boolean
  ready: boolean
  onToggle: (parKey: keyof LottoSelection, hole: number) => void
  onSave: () => void
  onDraw: () => void
  onClose: () => void
}) {
  const isDrafter = !!myUserId && draw?.drafterUserId === myUserId
  const isCompleted = draw?.drawStatus === 'COMPLETED'
  const selectedHoleList = [...selection.par3, ...selection.par4, ...selection.par5].sort((a, b) => a - b)
  const isPurchased = purchased && selectedHoleList.length === 6
  const resultRows = selectedHoleList.map((hole) => draw?.drawnScores?.[String(hole)]).filter((item): item is RoundLottoDrawScore => !!item)
  const hitCount = resultRows.filter((row) => myStrokes?.[row.hole - 1] === row.score).length
  const allResultRows = Object.values(draw?.drawnScores ?? {}).sort((a, b) => a.hole - b.hole)
  const isPlaying = !myStrokes
  const lottoAwardGroups = (() => {
    if (!awardReady) return []
    const rowsWithScore = awardRows.filter((row) => row.hasScore)
    const missRows = rowsWithScore.filter((row) => row.prize <= 0)
    const groups = [
      {
        label: '낙첨',
        rows: missRows,
        format: (row: LottoAwardRow) => `${row.name} ${row.hits}개`,
      },
      ...([3, 4, 5, 6] as const).map((hits) => ({
        label: `${hits}개`,
        rows: rowsWithScore.filter((row) => row.hits === hits && row.prize > 0),
        format: (row: LottoAwardRow) => `${row.name} ${formatWon(row.prize)}`,
      })),
    ]
    return groups.filter((group) => group.rows.length > 0)
  })()
  const groups: Array<{ key: keyof LottoSelection; label: string; limit: number; holes: number[] }> = [
    { key: 'par3', label: '파 3', limit: 1, holes: pars.map((par, index) => par === 3 ? index + 1 : null).filter((hole): hole is number => !!hole) },
    { key: 'par4', label: '파 4', limit: 3, holes: pars.map((par, index) => par === 4 ? index + 1 : null).filter((hole): hole is number => !!hole) },
    { key: 'par5', label: '파 5', limit: 2, holes: pars.map((par, index) => par === 5 ? index + 1 : null).filter((hole): hole is number => !!hole) },
  ]
  const renderStatusTable = (start: number) => {
    const holes = Array.from({ length: 9 }, (_, index) => start + index)
    return (
      <View style={s.lottoStatusTable}>
        <View style={s.lottoStatusRow}>
          <Text style={s.lottoStatusLabel}></Text>
          {holes.map((hole) => {
            const selected = selectedHoleList.includes(hole)
            return <Text key={hole} style={[s.lottoStatusCell, s.lottoStatusHole, selected && s.lottoStatusSelectedText]}>{hole}</Text>
          })}
        </View>
        <View style={s.lottoStatusRow}>
          <Text style={s.lottoStatusLabel}>추첨</Text>
          {holes.map((hole) => {
            const selected = selectedHoleList.includes(hole)
            const row = draw?.drawnScores?.[String(hole)]
            return (
              <Text key={hole} style={[s.lottoStatusCell, selected && s.lottoStatusSelectedCell, selected && s.lottoStatusSelectedText]}>
                {row ? scoreName(row.score, row.par) : '-'}
              </Text>
            )
          })}
        </View>
        <View style={s.lottoStatusRow}>
          <Text style={s.lottoStatusLabel}>결과</Text>
          {holes.map((hole) => {
            const selected = selectedHoleList.includes(hole)
            const row = draw?.drawnScores?.[String(hole)]
            return (
              <Text key={hole} style={[s.lottoStatusCell, selected && s.lottoStatusSelectedCell, selected && s.lottoStatusSelectedText]}>
                {row ? scoreName(myStrokes?.[hole - 1], row.par) : '-'}
              </Text>
            )
          })}
        </View>
      </View>
    )
  }

  return (
    <Modal transparent animationType="fade" visible={!!round} onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[s.modalCard, s.lottoModalCard]} activeOpacity={1} onPress={() => {}}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>로또 홀 선택</Text>
              <Text style={s.personalModalSub}>{round ? `${round.date} · ${round.courseName ?? round.course}` : ''}</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={s.personalLoadingBox}>
              <ActivityIndicator color={C.green} />
              <Text style={s.muted}>불러오는 중</Text>
            </View>
          ) : (
            <>
              <View style={s.lottoPrizeBox}>
                <Text style={s.lottoPrizeTitle}>Lotto 6/18 시상 기준</Text>
                <Text style={s.lottoPrizeJackpot}>현재 누적 당첨금 {formatWon(jackpot)}</Text>
                <View style={s.lottoPrizeGrid}>
                  <Text style={s.lottoPrizeItem}>3개 {formatWon(awardConfig.prizes['3'])}</Text>
                  <Text style={s.lottoPrizeItem}>4개 {formatWon(awardConfig.prizes['4'])}</Text>
                  <Text style={s.lottoPrizeItem}>5개 {formatWon(awardConfig.prizes['5'])}</Text>
                  <Text style={s.lottoPrizeItem}>6개 {formatWon(jackpot)}</Text>
                </View>
              </View>
              {isPurchased ? (
                <View style={s.lottoPurchaseBox}>
                  <Text style={s.lottoPurchaseTitle}>구매 및 추첨 결과</Text>
                  <View style={s.lottoPurchaseHoles}>
                    {selectedHoleList.map((hole) => {
                      const row = draw?.drawnScores?.[String(hole)]
                      const hit = isCompleted && !isPlaying && !!row && myStrokes?.[hole - 1] === row.score
                      const missed = isCompleted && !isPlaying && !!row && myStrokes?.[hole - 1] !== row.score
                      return (
                        <View
                          key={hole}
                          style={[
                            s.lottoPurchaseHole,
                            hit && s.lottoPurchaseHoleHit,
                            missed && s.lottoPurchaseHoleMiss,
                          ]}
                        >
                          <Text style={[
                            s.lottoPurchaseMark,
                            hit && s.lottoPurchaseMarkHit,
                            missed && s.lottoPurchaseMarkMiss,
                          ]}>
                            {isCompleted && !isPlaying ? (hit ? 'O' : 'X') : '-'}
                          </Text>
                          <Text style={[
                            s.lottoPurchaseHoleText,
                            hit && s.lottoPurchaseTextHit,
                            missed && s.lottoPurchaseTextMiss,
                          ]}>
                            {hole}H
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              ) : canPurchase ? (
                <>
                  <View style={s.lottoCounterRow}>
                    <Text style={[s.lottoCounter, selection.par3.length === 1 && s.lottoCounterDone]}>파3 {selection.par3.length}/1</Text>
                    <Text style={[s.lottoCounter, selection.par4.length === 3 && s.lottoCounterDone]}>파4 {selection.par4.length}/3</Text>
                    <Text style={[s.lottoCounter, selection.par5.length === 2 && s.lottoCounterDone]}>파5 {selection.par5.length}/2</Text>
                  </View>
                  <ScrollView style={s.lottoBody}>
                    {groups.map((group) => (
                      <View key={group.key} style={s.lottoGroup}>
                        <View style={s.lottoGroupHeader}>
                          <Text style={s.lottoGroupTitle}>{group.label}</Text>
                          <Text style={s.lottoGroupLimit}>{selection[group.key].length}/{group.limit}</Text>
                        </View>
                        <View style={s.lottoHoleGrid}>
                          {group.holes.map((hole) => {
                            const selected = selection[group.key].includes(hole)
                            return (
                              <TouchableOpacity
                                key={hole}
                                style={[s.lottoHoleBtn, selected && s.lottoHoleBtnActive]}
                                onPress={() => onToggle(group.key, hole)}
                                activeOpacity={0.82}
                              >
                                <Text style={[s.lottoHoleText, selected && s.lottoHoleTextActive]}>{hole}H</Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={[s.lottoSaveBtn, (!ready || saving) && s.lottoSaveBtnDisabled]}
                    onPress={onSave}
                    disabled={!ready || saving}
                  >
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.lottoSaveText}>구매 완료</Text>}
                  </TouchableOpacity>
                </>
              ) : null}
              <View style={s.lottoDrawBox}>
                {isCompleted ? (
                  <>
                    <Text style={s.lottoDrawDoneText}>
                      추첨상태 : {isPlaying ? '경기중' : `추첨완료 · ${hitCount}/${resultRows.length}개 적중`}
                    </Text>
                    {allResultRows.length > 0 && (
                      <View style={s.lottoStatusBox}>
                        {renderStatusTable(1)}
                        {renderStatusTable(10)}
                      </View>
                    )}
                    <View style={s.lottoAwardBox}>
                      <Text style={s.lottoAwardTitle}>추첨 결과 및 시상금</Text>
                      {!awardReady ? (
                        <Text style={s.lottoDrawWaitText}>스코어 입력 후 당첨자를 확인할 수 있습니다.</Text>
                      ) : lottoAwardGroups.length === 0 ? (
                        <Text style={s.lottoDrawWaitText}>참여 확정한 회원이 없습니다.</Text>
                      ) : (
                        <View style={s.lottoAwardList}>
                          {lottoAwardGroups.map((group) => (
                            <View key={group.label} style={s.lottoAwardRow}>
                              <Text style={s.lottoAwardName}>
                                {group.label} : {group.rows.map(group.format).join(', ')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </>
                ) : isDrafter ? (
                  <TouchableOpacity
                    style={[s.lottoDrawBtn, drawSaving && { opacity: 0.6 }]}
                    onPress={onDraw}
                    disabled={drawSaving}
                    activeOpacity={0.86}
                  >
                    {drawSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.lottoDrawBtnText}>로또 추첨 시작</Text>}
                  </TouchableOpacity>
                ) : (
                  <Text style={s.lottoDrawWaitText}>
                    {draw?.drafterUserId ? '추첨 대기 중...' : '추첨자가 아직 지정되지 않았습니다.'}
                  </Text>
                )}
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

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
  designStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14, justifyContent: 'space-between' },
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
  protoTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
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
  adminRoundAddCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.greenLight,
    padding: 14,
  },
  adminRoundAddIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.greenLight,
  },
  adminRoundAddTitle: { fontSize: 14, fontWeight: '900', color: C.text },
  adminRoundAddSub: { marginTop: 3, fontSize: 12, fontWeight: '700', color: C.muted },
  feeInlineRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  feeStatusText: { flex: 1, fontSize: 14, fontWeight: '900', color: C.text },
  feeStatusTextWarn: { color: C.warn },
  feeLinkBtn: { paddingVertical: 4 },
  feeLinkText: { color: C.green, fontWeight: '800', fontSize: 13 },
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
  roundRowAttendanceReady: { borderColor: C.green, backgroundColor: '#f6fbf7' },
  roundRowGroupReady: { borderColor: C.green, backgroundColor: '#f6fbf7' },
  roundRowSelected: { borderWidth: 2, borderColor: C.green },
  todayRoundRow: { borderColor: '#d65b4a', backgroundColor: '#fff8f6' },
  todayRoundBadge: { backgroundColor: '#f8d6cf', borderWidth: 1, borderColor: '#d65b4a' },
  todayRoundBadgeText: { fontSize: 11, fontWeight: '900', color: '#b94b3d' },
  todayActionRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  todayActionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: C.greenLight,
  },
  todayActionBtnDisabled: { backgroundColor: '#f1f3f1', opacity: 0.75 },
  todayActionText: { fontSize: 11, fontWeight: '900', color: C.green },
  todayActionTextDisabled: { color: C.muted },
  roundRowDisabled: { opacity: 0.65 },
  roundLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundCourse: { flex: 1, fontSize: 14, color: C.text, fontWeight: '800' },
  roundInfoText: { fontSize: 12, color: C.text, fontWeight: '700' },
  roundAwardText: { marginTop: 3, fontSize: 12, color: '#d65b4a', fontWeight: '800' },
  roundLottoPurchaseText: { marginTop: 3, fontSize: 12, color: C.green, fontWeight: '900' },
  roundHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  roundStageBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  roundStagePending: { backgroundColor: '#f3f5f3' },
  roundStageDone: { backgroundColor: C.greenLight },
  roundStageText: { fontSize: 10, fontWeight: '900' },
  roundStageTextPending: { color: C.muted },
  roundStageTextDone: { color: C.green },
  roundEditBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: C.greenDark },
  roundEditBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },
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
  awardSummaryBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#f6fbf7',
    gap: 4,
  },
  awardSummaryLabel: { fontSize: 12, color: '#d65b4a', fontWeight: '900' },
  awardSummaryText: { fontSize: 13, color: '#d65b4a', fontWeight: '800', lineHeight: 19 },
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
  noticePopupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.46)', justifyContent: 'center', padding: 22 },
  noticePopupCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18 },
  noticePopupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  noticePopupIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  noticePopupTitle: { fontSize: 13, fontWeight: '900', color: C.text },
  noticePopupDate: { fontSize: 11, color: C.muted, marginTop: 2 },
  noticePopupImportant: { fontSize: 11, fontWeight: '900', color: '#fff', backgroundColor: C.danger, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  noticePopupSubject: { fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 8 },
  noticePopupBody: { fontSize: 13, color: C.muted, lineHeight: 20 },
  noticePopupActions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  noticePopupCloseBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f2f4f6' },
  noticePopupCloseText: { fontSize: 13, fontWeight: '900', color: C.muted },
  noticePopupPrimaryBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: C.green },
  noticePopupPrimaryText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  homeNoticeCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  homeNoticeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  homeNoticeTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  homeNoticeMore: { fontSize: 12, fontWeight: '900', color: C.green },
  homeNoticeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  homeNoticeUnread: { backgroundColor: '#f8fff8', marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 12 },
  homeNoticeIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  homeNoticeLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  homeNoticeText: { flex: 1, fontSize: 13, fontWeight: '800', color: C.text },
  homeNoticeTextUnread: { color: C.green },
  homeNoticeMeta: { fontSize: 11, color: C.muted, marginTop: 2 },
  homeNoticeImportant: { fontSize: 10, fontWeight: '900', color: '#fff', backgroundColor: C.danger, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  homeNoticeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
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
  personalModalCard: { maxHeight: '88%' },
  personalModalSub: { fontSize: 12, color: C.muted, marginTop: 3 },
  personalLoadingBox: { paddingVertical: 30, alignItems: 'center', gap: 10 },
  personalPageScroll: { marginBottom: 8 },
  personalPageTabs: { flexDirection: 'row', gap: 6, paddingRight: 4 },
  personalPageTab: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#f2f4f6', borderWidth: 1, borderColor: C.border },
  personalPageTabActive: { backgroundColor: C.greenLight, borderColor: C.green },
  personalPageTabText: { fontSize: 11, fontWeight: '800', color: C.muted },
  personalPageTabTextActive: { color: C.green },
  personalProgress: { fontSize: 12, fontWeight: '800', color: C.muted, marginBottom: 8 },
  currentHoleSummary: {
    minHeight: 38, borderRadius: 13, backgroundColor: '#f6fbf7', borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  currentHoleTitle: { flex: 1, fontSize: 13, fontWeight: '900', color: C.text },
  personalHoleCard: { height: 470, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: '#fff' },
  personalHoleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  personalHoleTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  personalHolePar: { fontSize: 12, fontWeight: '800', color: C.muted },
  teeDistanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teeDistanceItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  teeDistanceDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1 },
  teeDistanceText: { fontSize: 12, fontWeight: '900', color: C.muted },
  personalGuideScroll: { flex: 1, marginBottom: 10 },
  personalGuideTabs: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  personalGuideTab: { flex: 1, minHeight: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f4f6', borderWidth: 1, borderColor: C.border },
  personalGuideTabActive: { backgroundColor: C.greenLight, borderColor: C.green },
  personalGuideTabText: { fontSize: 12, fontWeight: '900', color: C.muted },
  personalGuideTabTextActive: { color: C.green },
  personalHoleGuide: { borderRadius: 14, backgroundColor: '#f6fbf7', borderWidth: 1, borderColor: C.border, padding: 12 },
  personalHoleGuideTitle: { fontSize: 12, fontWeight: '900', color: C.green, marginBottom: 5 },
  personalDifficultyBox: { marginBottom: 10, gap: 7 },
  personalDifficultyText: { fontSize: 13, fontWeight: '900', color: C.green },
  personalDifficultyFactors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  personalDifficultyFactor: { borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '900', color: C.muted },
  personalHoleGuideText: { fontSize: 14, fontWeight: '700', color: C.text, lineHeight: 23 },
  personalHoleGuideDistance: { marginTop: 6, fontSize: 12, fontWeight: '900', color: C.green },
  personalFieldLabel: { fontSize: 12, fontWeight: '900', color: C.text },
  firDisabledBox: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalDisabledText: { fontSize: 12, color: C.muted, fontWeight: '800' },
  personalFixedInputs: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  firWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  firMiddle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  firExtraRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  firButton: { flex: 1, minHeight: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f5f3', borderWidth: 1, borderColor: C.border, paddingHorizontal: 8 },
  firButtonActive: { backgroundColor: C.greenLight, borderColor: C.green },
  firButtonText: { fontSize: 12, fontWeight: '900', color: C.muted },
  firButtonTextActive: { color: C.green },
  firTop: { borderTopLeftRadius: 28, borderTopRightRadius: 28, width: 74 },
  firBottom: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, width: 74 },
  firSide: { backgroundColor: '#fff2ef', borderColor: '#f0cbc4' },
  firCenter: { width: 66, minHeight: 42 },
  firExtra: { minWidth: 92 },
  firHazard: { minWidth: 82, backgroundColor: '#eef6ff', borderColor: '#cfe1f5' },
  statTagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  statTagList: { flex: 1, flexDirection: 'row', gap: 7 },
  statTag: { flex: 1, minHeight: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f5f3', borderWidth: 1, borderColor: C.border },
  statTagActive: { backgroundColor: C.greenLight, borderColor: C.green },
  statTagText: { fontSize: 13, fontWeight: '900', color: C.muted },
  statTagTextActive: { color: C.green },
  personalFooter: { flexDirection: 'row', gap: 10, marginTop: 12 },
  personalNavBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f2f4f6' },
  personalNavBtnDisabled: { opacity: 0.4 },
  personalNavText: { fontSize: 13, fontWeight: '900', color: C.muted },
  personalSaveBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: C.green },
  personalSaveText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  lottoModalCard: { maxHeight: '82%' },
  lottoCounterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  lottoCounter: {
    flex: 1,
    textAlign: 'center',
    borderRadius: 999,
    paddingVertical: 7,
    backgroundColor: '#f2f4f6',
    color: C.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  lottoCounterDone: { backgroundColor: C.greenLight, color: C.green },
  lottoBody: { maxHeight: 430 },
  lottoGroup: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginBottom: 14 },
  lottoGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  lottoGroupTitle: { fontSize: 14, fontWeight: '900', color: C.text },
  lottoGroupLimit: { fontSize: 12, fontWeight: '900', color: C.muted },
  lottoHoleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lottoHoleBtn: {
    width: 52,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f7f6',
    borderWidth: 1,
    borderColor: C.border,
  },
  lottoHoleBtnActive: { backgroundColor: C.greenLight, borderColor: C.green },
  lottoHoleText: { fontSize: 12, fontWeight: '900', color: C.muted },
  lottoHoleTextActive: { color: C.green },
  lottoPrizeBox: { borderRadius: 14, padding: 12, backgroundColor: '#f6f7f6', borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  lottoPrizeTitle: { fontSize: 13, fontWeight: '900', color: C.text },
  lottoPrizeJackpot: { fontSize: 14, fontWeight: '900', color: C.green, marginTop: 5 },
  lottoPrizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  lottoPrizeItem: {
    minWidth: '47%',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    fontSize: 11,
    fontWeight: '800',
    color: C.text,
  },
  lottoPurchaseBox: { borderWidth: 1, borderColor: C.border, backgroundColor: '#f6f7f6', borderRadius: 14, padding: 12 },
  lottoPurchaseTitle: { fontSize: 13, fontWeight: '900', color: C.text, marginBottom: 8 },
  lottoPurchaseHoles: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  lottoPurchaseHole: {
    minWidth: 42,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 9,
    backgroundColor: '#eef0ee',
    borderWidth: 1,
    borderColor: C.border,
  },
  lottoPurchaseHoleHit: { backgroundColor: C.greenLight, borderColor: C.green },
  lottoPurchaseHoleMiss: { backgroundColor: '#fff8f6', borderColor: '#d65b4a' },
  lottoPurchaseMark: { fontSize: 10, fontWeight: '900', color: C.muted, lineHeight: 12 },
  lottoPurchaseMarkHit: { color: C.green },
  lottoPurchaseMarkMiss: { color: '#d65b4a' },
  lottoPurchaseHoleText: { fontSize: 12, fontWeight: '900', color: C.muted, marginTop: 1 },
  lottoPurchaseTextHit: { color: C.green },
  lottoPurchaseTextMiss: { color: '#d65b4a' },
  lottoSaveBtn: { marginTop: 12, borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: C.green },
  lottoSaveBtnDisabled: { opacity: 0.45 },
  lottoSaveText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  lottoDrawBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  lottoDrawTitle: { fontSize: 12, fontWeight: '900', color: C.muted, marginBottom: 8 },
  lottoDrawBtn: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: '#d65b4a' },
  lottoDrawBtnText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  lottoDrawWaitText: { fontSize: 13, fontWeight: '800', color: C.muted },
  lottoDrawDoneText: { fontSize: 13, fontWeight: '900', color: C.green },
  lottoStatusBox: { gap: 12, marginTop: 10 },
  lottoStatusTable: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
  },
  lottoStatusRow: { flexDirection: 'row', alignItems: 'center', minHeight: 30 },
  lottoStatusLabel: { width: 42, fontSize: 11, fontWeight: '900', color: C.text },
  lottoStatusCell: {
    flex: 1,
    minHeight: 24,
    borderRadius: 8,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: C.muted,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  lottoStatusHole: { fontSize: 11, color: C.text },
  lottoStatusSelectedCell: { backgroundColor: '#fff8f6' },
  lottoStatusSelectedText: { color: '#d65b4a', fontWeight: '900' },
  lottoResultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  lottoResultCard: {
    width: '48%',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#fff',
  },
  lottoResultCardHit: { borderColor: '#d65b4a', backgroundColor: '#fff8f6' },
  lottoResultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lottoResultHole: { fontSize: 14, fontWeight: '900', color: C.text },
  lottoResultPar: { fontSize: 11, fontWeight: '800', color: C.muted },
  lottoHitBadge: { fontSize: 10, fontWeight: '900', color: '#fff', backgroundColor: '#d65b4a', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  lottoResultCompare: { gap: 2, marginTop: 5 },
  lottoResultLabel: { fontSize: 10, fontWeight: '900', color: C.muted },
  lottoResultPending: { fontSize: 12, fontWeight: '800', color: C.muted },
  lottoResultMyScore: { fontSize: 13, fontWeight: '900', color: C.text },
  lottoResultScore: { fontSize: 13, fontWeight: '900', color: '#d65b4a' },
  lottoAllResultBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  lottoAllResultTitle: { fontSize: 12, fontWeight: '900', color: C.text, marginBottom: 8 },
  lottoAllResultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lottoAllResultCell: {
    width: '31%',
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#f6f7f6',
    borderWidth: 1,
    borderColor: C.border,
  },
  lottoAllResultCellActive: { backgroundColor: '#fff8f6', borderColor: '#d65b4a' },
  lottoAllResultHole: { fontSize: 11, fontWeight: '900', color: C.muted },
  lottoAllResultScore: { fontSize: 13, fontWeight: '900', color: C.text, marginTop: 2 },
  lottoAllResultLabel: { fontSize: 10, fontWeight: '800', color: C.muted, marginTop: 1 },
  lottoAllResultTextActive: { color: '#d65b4a' },
  lottoAwardBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  lottoAwardTitle: { fontSize: 12, fontWeight: '900', color: C.text, marginBottom: 8 },
  lottoAwardList: { gap: 7 },
  lottoAwardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  lottoAwardWinnerRow: { borderColor: '#d65b4a', backgroundColor: '#fff8f6' },
  lottoAwardName: { fontSize: 13, fontWeight: '900', color: C.text },
  lottoAwardWinnerText: { color: '#d65b4a' },
  lottoAwardMeta: { fontSize: 11, fontWeight: '800', color: C.muted, marginTop: 2 },
  lottoAwardBadge: { fontSize: 11, fontWeight: '900', color: '#fff', backgroundColor: '#d65b4a', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
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
