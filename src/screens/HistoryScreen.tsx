import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Modal, Dimensions, TextInput, ImageBackground, Animated, Alert, ActivityIndicator,
} from 'react-native'
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import Svg, { Polyline, Circle, Line, Text as SvgText, G } from 'react-native-svg'
import { DEFAULT_LOTTO_AWARD_CONFIG, getClubAwardConfig, getClubAwardSnapshots, getClubLottoAwardConfig, getClubMembers, getRoundLottoDraw, getRoundLottoEntries, getRoundHistoryCards, getRound, getPersonalRoundStats, playerTotal, totalPar, getHandicapsForRound, computeHandicaps, shortName, updateRound, type ClubAwardSnapshot, type LottoAwardConfig, type PersonalRoundHoleStat, type RoundLottoDraw, type RoundLottoEntry, type SavedRound } from '../lib/store'
import { supabase } from '../lib/supabase'
import { getPersonalRecordGoal, savePersonalRecordGoal } from '../lib/personalRecordGoal'
import { useClub } from '../lib/ClubContext'
import { useUserProfile } from '../lib/UserProfileContext'
import { useAsync } from '../lib/useAsync'
import { loadHandicapBasis, type HandicapBasis } from '../lib/handicapBasis'
import { AWARD_CATEGORIES } from '../lib/awardConfig'
import { getRoundSchedules, type ScheduledRound } from '../lib/roundSchedule'
import {
  buildRoundAwardMoneySummary,
  buildRoundDetailSummary,
  buildRoundFrontSummary,
} from '../features/history/roundSummaries'
import {
  buildPlayerRoundsByName,
  resolvePersonalPlayerName,
} from '../features/history/personalRoundStats'
import {
  buildPersonalReportSummary,
  getPersonalReportModalTitle,
  type PersonalReportModal,
} from '../features/history/personalReportSummary'
import { C } from '../theme'
import { EmojiIcon } from '../components/EmojiIcon'
import { SwipeDownSheet } from '../components/SwipeDownSheet'
import { TopActionButtons } from '../components/TopActionButtons'
import { ImageCropModal, type ImageCropRect } from '../components/ImageCropModal'
import { SegmentedIconTabs, type SegmentedIconTab } from '../components/SegmentedIconTabs'
import { RoundHistoryCarousel } from '../components/history/RoundHistoryCarousel'
import { RegularRankTab, RoundAwardTab, ScoreSummaryTab, ShinperioRankTab } from '../components/history/RoundDetailTabs'
import {
  BulletText,
  DonutGauge,
  MetricCard,
  ObDistribution,
  PuttBars,
  RadarChart,
  ScoreDist,
  ScoreDonut,
  StackedScoreBars,
} from '../components/history/PersonalReportWidgets'
import { getCourseHeroImageSource } from '../data/courseHeroImages'
import { uploadRoundPhoto } from '../lib/roundPhotos'
import { getOptimizedRemoteImageUrl } from '../lib/imageOptimization'
import type { MainTabParamList, RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type HistoryRoute = RouteProp<MainTabParamList, 'History'>
type Tab = 'byRound' | 'byPlayer' | 'club' | 'hall'
type RankingType = 'wins' | 'streak' | 'lowestHandicap' | 'birdie' | 'singleBirdie' | 'frontBack' | 'avgImprove' | 'handicapImprove' | 'singlePar' | 'roundsPlayed' | 'lowestScore' | 'highestScore'
type RoundDetailTab = 'regular' | 'peoria' | 'score' | 'award'
type HistoryMember = { userId: string; name: string; role: string }
type HistoryRoundCard = SavedRound & { isScheduleOnly?: boolean }
const MULTI_SPECIAL_AWARD_KEYS = new Set(
  (AWARD_CATEGORIES.find((category) => category.label === '특별상')?.items ?? [])
    .filter((item) => item.id !== 'last')
    .map((item) => item.id),
)
const HISTORY_TABS: Array<SegmentedIconTab<Tab>> = [
  { value: 'byRound', label: '라운딩', icon: 'flag' },
  { value: 'club', label: '클럽랭킹', icon: 'chart' },
  { value: 'hall', label: '기네스북', icon: 'trophy' },
  { value: 'byPlayer', label: '개인', icon: 'user' },
]

function formatWon(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString('ko-KR')}원`
}

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

function formatWinners(names: string[], value: string): string {
  if (names.length === 0) return '-'
  const label = names.length <= 3
    ? names.map(shortName).join(', ')
    : `${shortName(names[0])} 외 ${names.length - 1}명`
  return `${label} (${value})`
}

function emptyHallEntry() {
  return { record: '-', member: '-' }
}

function splitHallValue(value: string) {
  if (!value || value === '-') return emptyHallEntry()
  const match = value.match(/^(.*)\s+\((.*)\)$/)
  if (!match) return { record: '-', member: value }
  return { record: match[2], member: match[1] }
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
  const ranked = r.players
    .map((p) => {
      const total = playerTotal(p.strokes)
      return { name: p.name, net: total - (handicaps.get(p.name) ?? 0), total }
    })
    .sort((a, b) => {
      const netDiff = a.net - b.net
      return netDiff !== 0 ? netDiff : a.total - b.total
    })
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
  const nav = useNavigation<Nav>()
  const route = useRoute<HistoryRoute>()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('byRound')
  const [renderedTab, setRenderedTab] = useState<Tab>('byRound')
  const [tabPending, setTabPending] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { name: myName, userId: myUserId } = useUserProfile()
  const [handicapBasis, setHandicapBasis] = useState<HandicapBasis>(5)
  const { activeClub, clubsLoaded } = useClub()
  const { data, loading } = useAsync(
    () => (activeClub ? getRoundHistoryCards(activeClub.id) : Promise.resolve([])),
    [refreshKey, activeClub?.id],
  )
  const [allClubMembers, setAllClubMembers] = useState<HistoryMember[]>([])

  // getClubMembers 결과가 일부 인원만 반환되는 환경에서도 클럽 소속 회원 전체를 확보한다.
  // club_members를 페이지 단위로 모두 읽은 뒤 profiles와 결합한다.
  useEffect(() => {
    let cancelled = false

    const loadAllClubMembers = async () => {
      if (!activeClub?.id) {
        if (!cancelled) setAllClubMembers([])
        return
      }

      try {
        const pageSize = 1000
        const rows: Array<{ user_id: string; role?: string | null }> = []

        for (let from = 0; ; from += pageSize) {
          const { data: page, error } = await supabase
            .from('club_members')
            .select('user_id, role')
            .eq('club_id', activeClub.id)
            .range(from, from + pageSize - 1)

          if (error) throw error
          const current = (page ?? []) as Array<{ user_id: string; role?: string | null }>
          rows.push(...current)
          if (current.length < pageSize) break
        }

        const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)))
        const profileById = new Map<string, { name?: string | null; nickname?: string | null }>()

        // Supabase의 IN 조건 길이 제한을 피하기 위해 작은 묶음으로 조회한다.
        for (let index = 0; index < userIds.length; index += 100) {
          const chunk = userIds.slice(index, index + 100)
          const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, name, nickname')
            .in('id', chunk)

          if (error) throw error
          for (const profile of profiles ?? []) {
            profileById.set(profile.id, profile)
          }
        }

        const loaded = rows.map((row) => {
          const profile = profileById.get(row.user_id)
          const displayName = profile?.name?.trim() || profile?.nickname?.trim() || '이름 미등록'
          return {
            userId: row.user_id,
            name: displayName,
            role: row.role ?? 'member',
          }
        })

        if (!cancelled) setAllClubMembers(loaded)
      } catch (error) {
        console.warn('[HistoryScreen] 전체 클럽 회원 조회 실패', error)
        if (!cancelled) setAllClubMembers([])
      }
    }

    loadAllClubMembers()
    return () => { cancelled = true }
  }, [activeClub?.id, refreshKey])
  const { data: scheduleData } = useAsync(
    () => (activeClub ? getRoundSchedules(activeClub.id) : Promise.resolve([])),
    [refreshKey, activeClub?.id],
  )
  const rounds = data ?? []
  const members = useMemo(() => {
    const merged = new Map<string, HistoryMember>()
    for (const member of allClubMembers) {
      const key = member.userId || member.name.trim().toLocaleLowerCase()
      if (!key) continue
      merged.set(key, member)
    }
    return Array.from(merged.values())
  }, [allClubMembers])
  const schedules = scheduleData ?? []
  const hiddenScheduleIds = useMemo(
    () => new Set(schedules.filter((schedule) => schedule.isPublished === false && activeClub?.role !== 'admin').map((schedule) => schedule.id)),
    [activeClub?.role, schedules],
  )
  const visibleSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.isPublished !== false || activeClub?.role === 'admin'),
    [activeClub?.role, schedules],
  )
  const visibleRounds = useMemo(
    () => rounds.filter((round) => !round.scheduleId || !hiddenScheduleIds.has(round.scheduleId)),
    [hiddenScheduleIds, rounds],
  )
  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // 단순 화면 복귀만으로 전체 데이터를 다시 조회하지 않는다.
  // 실제 갱신은 당겨서 새로고침으로 수행한다.
  useFocusEffect(useCallback(() => {
    if (route.params?.initialTab) setTab(route.params.initialTab)
  }, [route.params?.initialTab]))

  useEffect(() => {
    loadHandicapBasis(activeClub?.id).then(setHandicapBasis)
  }, [activeClub?.id])

  useEffect(() => {
    if (renderedTab === tab) {
      setTabPending(false)
      return
    }

    setTabPending(true)
    const timer = setTimeout(() => {
      setRenderedTab(tab)
      setTabPending(false)
    }, 80)

    return () => clearTimeout(timer)
  }, [renderedTab, tab])

  return (
    <>
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.topActions, { paddingTop: insets.top + 10 }]}>
        <TopActionButtons />
      </View>
      <SegmentedIconTabs items={HISTORY_TABS} value={tab} onChange={setTab} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.green} />}
      >
        {!clubsLoaded || loading ? (
          <Text style={s.muted}>데이터를 불러오는 중입니다.</Text>
        ) : tabPending ? (
          <Text style={s.muted}>기록을 준비하는 중입니다.</Text>
        ) : (
          <>
            {renderedTab === 'byRound' && <ByRound rounds={visibleRounds} schedules={visibleSchedules} handicapBasis={handicapBasis} members={members} />}
            {renderedTab === 'byPlayer' && <ByPlayer rounds={visibleRounds} handicapBasis={handicapBasis} myName={myName} myUserId={myUserId} />}
            {renderedTab === 'club' && <Club rounds={visibleRounds} handicapBasis={handicapBasis} members={members} />}
            {renderedTab === 'hall' && <HallOfFame rounds={visibleRounds} handicapBasis={handicapBasis} />}
          </>
        )}
      </ScrollView>
    </View>
    </>
  )
}

// ─── 라운딩별 ────────────────────────────────────────────────────────────────

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonthKey(key: string, offset: number) {
  const [year, month] = key.split('-').map(Number)
  const next = new Date(year, month - 1 + offset, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [year, month] = key.split('-')
  return `${year}년 ${Number(month)}월`
}

function memberPlaceholders(members: HistoryMember[]) {
  const names = members
    .map((member) => shortName(member.name || ''))
    .filter((name) => name.length > 0)
  return names.length > 0 ? names : ['회원']
}

function EmptyByRound({ members }: { members: HistoryMember[] }) {
  const [containerWidth, setContainerWidth] = useState(0)
  const cardWidth = containerWidth > 0 ? Math.min(Math.max(containerWidth - 48, 280), 430) : 0
  const cardHeight = Math.max(500, Math.min(590, Dimensions.get('window').height - 220))
  return (
    <View
      style={s.roundCarouselWrap}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width)
        if (nextWidth > 0 && nextWidth !== containerWidth) setContainerWidth(nextWidth)
      }}
    >
      {cardWidth > 0 ? (
        <View style={[s.roundCardShell, { width: cardWidth, height: cardHeight }]}>
          <View style={s.roundHero}>
            <View style={[s.roundPhotoHeader, { backgroundColor: C.greenLight }]}>
              <View style={s.roundHeroTopRow}>
                <View style={s.roundCounter}><Text style={s.roundCounterText}>0 / 0</Text></View>
                <View style={s.heroProgressBadge}><Text style={s.heroStatusText}>기록 대기</Text></View>
              </View>
              <View>
                <Text style={s.heroDate}>----.--.--</Text>
                <Text style={s.heroCourseName}>라운드 기록</Text>
              </View>
            </View>
            <View style={s.roundSummaryBody}>
              <View style={s.heroSummaryPanel}>
                <View style={s.summaryCell}><Text style={s.summaryLabel}>우승</Text><Text style={s.summaryValue}>-</Text></View>
                <View style={s.summaryCell}><Text style={s.summaryLabel}>스코어</Text><Text style={s.summaryValue}>-</Text></View>
                <View style={[s.summaryCell, { borderRightWidth: 0 }]}><Text style={s.summaryLabel}>참가</Text><Text style={s.summaryValue}>{members.length}명</Text></View>
              </View>
              <View style={s.heroInfoPanel}>
                <Text style={s.heroSectionTitle}>기네스 북 갱신 현황</Text>
                <Text style={s.muted}>라운드 결과가 등록되면 기존 카드 양식에 맞춰 표시됩니다.</Text>
              </View>
              <View style={s.highlightRow}>
                <View style={s.highlightCard}><Text style={s.highlightLabel}>정규</Text><Text style={s.highlightValue}>-</Text></View>
                <View style={s.highlightCard}><Text style={s.highlightLabel}>신페리오</Text><Text style={s.highlightValue}>-</Text></View>
                <View style={s.highlightCard}><Text style={s.highlightLabel}>시상</Text><Text style={s.highlightValue}>-</Text></View>
              </View>
            </View>
          </View>
        </View>
      ) : <View style={[s.roundCarouselPlaceholder, { height: cardHeight }]} />}
      <Text style={s.roundSwipeHint}>라운드 결과가 등록되면 좌우로 넘겨볼 수 있습니다</Text>
    </View>
  )
}

function EmptyByPlayer() {
  const [selectedCard, setSelectedCard] = useState<{ title: string; rows: Array<{ label: string; value: string }> } | null>(null)
  const emptyReportCards = [
    { key: 'target', icon: '🎯', title: '목표 설정', subtitle: '', rows: [{ label: '목표 타수', value: '' }, { label: '현재 평균', value: '' }] },
    { key: 'trend', icon: '📈', title: '스코어 추이', subtitle: '', rows: [{ label: '최근 평균', value: '' }, { label: '최저 타수', value: '' }] },
    { key: 'shot', icon: '🏌️', title: '샷·퍼팅', subtitle: '', rows: [{ label: 'FIR', value: '' }, { label: '평균 퍼팅', value: '' }] },
    { key: 'hole', icon: '⛳', title: '홀 유형', subtitle: '', rows: [{ label: 'Par 3', value: '' }, { label: 'Par 4', value: '' }, { label: 'Par 5', value: '' }] },
    { key: 'score', icon: '📊', title: '스코어 분포', subtitle: '', rows: [{ label: '버디', value: '' }, { label: '파', value: '' }, { label: '보기', value: '' }] },
  ]
  return (
    <>
      {selectedCard && (
        <Modal transparent animationType="none" onRequestClose={() => setSelectedCard(null)}>
          <SwipeDownSheet visible onClose={() => setSelectedCard(null)} overlayStyle={s.personalReportSheetOverlay} sheetStyle={s.personalReportSheet}>
              <View style={s.personalReportSheetHandle} />
              <View style={s.modalHeader}>
                <Text style={s.personalReportSheetTitle}>{selectedCard.title}</Text>
                <TouchableOpacity style={s.closeBtn} onPress={() => setSelectedCard(null)}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
              </View>
              {selectedCard.rows.map((row) => (
                <View key={row.label} style={s.analysisRow}>
                  <Text style={s.analysisLabel}>{row.label}</Text>
                  <Text style={s.analysisValue}>{row.value}</Text>
                </View>
              ))}
          </SwipeDownSheet>
        </Modal>
      )}
      <View style={s.aiCaddieCard}>
        <View style={s.aiCaddieHeader}>
          <View style={s.aiCaddieIconWrap}><Text style={s.aiCaddieIcon}>🤖</Text></View>
          <View style={s.aiCaddieTitleBlock}>
            <Text style={s.aiCaddieEyebrow}>AI Caddie</Text>
            <Text style={s.aiCaddieTitle}>개인 기록 분석</Text>
          </View>
        </View>
        <View style={s.aiCaddieInsightBox}>
          <Text style={s.aiCaddieLead}></Text>
          <View style={s.aiCaddieBulletRow}><Text style={s.aiCaddieBulletText}></Text></View>
          <View style={s.aiCaddieBulletRow}><Text style={s.aiCaddieBulletText}></Text></View>
        </View>
        <View style={s.aiCaddieRecommendRow}>
          <Text style={s.aiCaddieRecommendLabel}>추천</Text>
          <Text style={s.aiCaddieRecommendText}></Text>
        </View>
      </View>

      <View style={s.personalReportSection}>
        <View style={s.personalReportHeader}>
          <View>
            <Text style={s.personalReportEyebrow}>Personal Report</Text>
            <Text style={s.personalReportTitle}>개인 리포트</Text>
          </View>
          <Text style={s.personalReportHint}>좌우로 넘겨보기</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={280} contentContainerStyle={s.personalReportCarousel}>
          {emptyReportCards.map((card) => (
            <TouchableOpacity key={card.key} activeOpacity={0.86} onPress={() => setSelectedCard({ title: card.title, rows: card.rows })} style={[s.personalReportCard, { width: 270 }]}>
              <Text style={s.personalReportCardAction}>자세히 보기 ›</Text>
              <View style={s.personalReportIconWrap}><Text style={s.personalReportIcon}>{card.icon}</Text></View>
              <Text style={s.personalReportCardTitle}>{card.title}</Text>
              <Text style={s.personalReportCardSubtitle} numberOfLines={1}>{card.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  )
}

function EmptyClub({ members, handicapBasis }: { members: HistoryMember[]; handicapBasis: HandicapBasis }) {
  const names = memberPlaceholders(members)
  return (
    <>
      <View style={s.card}>
        <Text style={s.cardTitle}>통합 통계</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>0</Text><Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>총 라운드</Text></View>
          <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>0</Text><Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>연인원</Text></View>
          <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 22, fontWeight: '700', color: C.green }}>-</Text><Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>클럽 평균</Text></View>
          <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>-</Text><Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>최저타</Text></View>
        </View>
      </View>
      <View style={s.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={s.clubRankingTitle}>클럽 랭킹</Text>
          <Text style={s.clubRankingBasisLabel}>핸디 {handicapBasis}경기</Text>
        </View>
        <View style={s.tableHeader}>
          <Text style={[s.th, { flex: 0.6 }]}>순위</Text>
          <Text style={[s.th, { flex: 2 }]}>이름</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>경기</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>평균</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>핸디</Text>
        </View>
        <ScrollView
          style={s.clubRankingScroll}
          contentContainerStyle={s.clubRankingScrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {names.map((name, index) => (
            <View key={`${name}-${index}`} style={s.tableRow}>
              <Text style={[s.td, { flex: 0.6, textAlign: 'center', color: C.muted }]}>{index + 1}</Text>
              <Text style={[s.td, { flex: 2, fontWeight: '700' }]}>{name}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'center', color: C.muted }]}>-</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'right', color: C.muted }]}>-</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'right', color: C.muted }]}>-</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </>
  )
}

function EmptyHallOfFame() {
  const sections = [
    { title: '우승 기록', items: ['최다 우승', '최다 연속 우승'] },
    { title: '스코어 기록', items: ['최저타', '최고타', '버디왕 (전체)', '버디왕 (1경기)', '파왕 (1경기)'] },
    { title: '성장 기록', items: ['최저 핸디', '전후반 개선', '평균타 개선', '핸디 개선'] },
    { title: '참가 기록', items: ['최다 라운드 참가'] },
  ]
  return (
    <View style={s.card}>
      {sections.map((section) => (
        <View key={section.title} style={s.hallSection}>
          <Text style={s.hallSectionTitle}>{section.title}</Text>
          {section.items.map((label) => (
            <HallRecordRow key={label} icon="🏆" label={label} value="-" />
          ))}
        </View>
      ))}
    </View>
  )
}

function scheduleParticipantCount(schedule: ScheduledRound) {
  return new Set(schedule.groups.flatMap((group) => group.members.map((member) => member.userId || member.name))).size
}

function ScheduledRoundCard({ schedule, index, totalCount, width, height }: { schedule: ScheduledRound; index: number; totalCount: number; width: number; height: number }) {
  const nav = useNavigation<Nav>()
  const { activeClub } = useClub()
  const isAdmin = activeClub?.role === 'admin'
  const [flipped, setFlipped] = useState(false)
  const [detailTab, setDetailTab] = useState<RoundDetailTab>('regular')
  const flip = useRef(new Animated.Value(0)).current
  const participantCount = scheduleParticipantCount(schedule)
  const courseName = schedule.courseName || schedule.course || ''
  const layoutName = schedule.layoutName || ''
  const courseLabel = [courseName, layoutName].filter(Boolean).join(' · ')
  const optimizedHeroImageUrl = useMemo(
    () => getOptimizedRemoteImageUrl(schedule.heroImageUrl, { width: 720, height: 360, quality: 76 }),
    [schedule.heroImageUrl],
  )
  const toggleFlip = () => {
    const next = !flipped
    Animated.spring(flip, { toValue: next ? 1 : 0, friction: 8, tension: 72, useNativeDriver: true }).start()
    setFlipped(next)
  }
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] })
  const backOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] })
  const detailTabs: { key: RoundDetailTab; label: string }[] = [
    { key: 'regular', label: '정규' },
    { key: 'peoria', label: '신페리오' },
    { key: 'award', label: '시상' },
  ]
  return (
    <View style={[s.flipCardScene, { width, height }]}>
      <Animated.View pointerEvents={flipped ? 'none' : 'auto'} style={[s.flipFace, { opacity: frontOpacity, transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}>
        <TouchableOpacity activeOpacity={0.96} style={s.flipTouch} onPress={toggleFlip}>
          <View style={s.roundHero}>
            <ImageBackground source={optimizedHeroImageUrl ? { uri: optimizedHeroImageUrl } : getCourseHeroImageSource(courseName)} style={s.roundPhotoHeader} imageStyle={s.roundHeroImage}>
              <View style={s.roundHeroShade} />
              <View style={s.roundHeroTopRow}>
                <View style={s.roundCounter}><Text style={s.roundCounterText}>{index + 1} / {totalCount}</Text></View>
                <View style={s.heroProgressBadge}><Text style={s.heroStatusText}>기록 대기</Text></View>
              </View>
              {isAdmin ? (
                <TouchableOpacity
                  style={s.roundManageButton}
                  onPress={(event) => {
                    event.stopPropagation()
                    nav.navigate('RoundSchedulePrototype', { editScheduleId: schedule.id, modalOnly: true })
                  }}
                  activeOpacity={0.84}
                >
                  <Text style={s.roundManageButtonText}>수정</Text>
                </TouchableOpacity>
              ) : null}
              <View style={s.heroCourseBlock}>
                <Text style={s.heroDate}>{schedule.date ? schedule.date.replace(/-/g, '.') : ''}{schedule.time ? `  ${schedule.time}` : ''}</Text>
                <Text style={s.heroCourseName} numberOfLines={2}>{courseLabel}</Text>
              </View>
            </ImageBackground>
            <View style={s.roundSummaryBody}>
              <View style={s.heroSummaryPanel}>
                <View style={s.summaryCell}><Text style={s.summaryLabel}>우승</Text><Text style={s.summaryValue}></Text></View>
                <View style={s.summaryCell}><Text style={s.summaryLabel}>스코어</Text><Text style={s.summaryValue}></Text></View>
                <View style={[s.summaryCell, { borderRightWidth: 0 }]}><Text style={s.summaryLabel}>참가</Text><Text style={s.summaryValue}>{participantCount > 0 ? `${participantCount}명` : ''}</Text></View>
              </View>
              <View style={s.heroInfoPanel}>
                <Text style={s.heroSectionTitle}>기네스 북 갱신 현황</Text>
                <Text style={s.muted}></Text>
              </View>
              <View style={s.highlightRow}>
                <View style={s.highlightCard}><Text style={s.highlightLabel}>정규</Text><Text style={s.highlightValue}></Text></View>
                <View style={s.highlightCard}><Text style={s.highlightLabel}>신페리오</Text><Text style={s.highlightValue}></Text></View>
                <View style={s.highlightCard}><Text style={s.highlightLabel}>시상</Text><Text style={s.highlightValue}></Text></View>
              </View>
              <Text style={s.flipHint}>카드를 눌러 상세 기록 보기  ↻</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View pointerEvents={flipped ? 'auto' : 'none'} style={[s.flipFace, s.flipBackFace, { opacity: backOpacity, transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}>
        <TouchableOpacity activeOpacity={1} style={s.backCard} onPress={toggleFlip}>
          <View style={s.backHeader}>
            <TouchableOpacity onPress={toggleFlip} style={s.backIconBtn}><Text style={s.backIconText}>↻</Text></TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.backCourseName} numberOfLines={1}>{courseName}</Text>
              <Text style={s.backDate}>{schedule.date ? schedule.date.replace(/-/g, '.') : ''}{schedule.time ? ` · ${schedule.time}` : ''}{participantCount > 0 ? ` · 참가 ${participantCount}명` : ''}</Text>
            </View>
          </View>
          <View style={s.backTabs}>
            {detailTabs.map((item) => (
              <TouchableOpacity key={item.key} style={[s.backTab, detailTab === item.key && s.backTabActive]} onPress={() => setDetailTab(item.key)}>
                <Text style={[s.backTabText, detailTab === item.key && s.backTabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.backBody}>
            <View style={s.detailPanel}>
              <Text style={s.detailPanelTitle}>{detailTab === 'regular' ? '정규 순위' : detailTab === 'peoria' ? '신페리오 순위' : '시상'}</Text>
              <Text style={s.detailLoadingText}>경기 결과 등록 후 표시됩니다.</Text>
            </View>
          </View>
          <TouchableOpacity style={s.flipBackHint} onPress={toggleFlip}><Text style={s.flipBackHintText}>↻ 앞면으로 돌아가기</Text></TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}
function ByRound({ rounds, schedules = [], handicapBasis = 5, members = [] }: { rounds: SavedRound[]; schedules?: ScheduledRound[]; handicapBasis?: number; members?: HistoryMember[] }) {
  return (
    <RoundHistoryCarousel
      rounds={rounds}
      schedules={schedules}
      emptyFallback={<EmptyByRound members={members} />}
      renderRoundCard={({ round, index, totalCount, width, height }) => (
        <RoundFlipCard
          round={round}
          rounds={rounds}
          schedules={schedules}
          handicapBasis={handicapBasis}
          index={index}
          totalCount={totalCount}
          width={width}
          height={height}
        />
      )}
      renderScheduleCard={({ schedule, index, totalCount, width, height }) => (
        <ScheduledRoundCard
          schedule={schedule}
          index={index}
          totalCount={totalCount}
          width={width}
          height={height}
        />
      )}
    />
  )
}

function RoundFlipCard({
  round, rounds, schedules, handicapBasis, index, totalCount, width, height,
}: {
  round: SavedRound
  rounds: SavedRound[]
  schedules: ScheduledRound[]
  handicapBasis: number
  index: number
  totalCount: number
  width: number
  height: number
}) {
  const nav = useNavigation<Nav>()
  const { activeClub } = useClub()
  const isAdmin = activeClub?.role === 'admin'
  const [flipped, setFlipped] = useState(false)
  const [detailTab, setDetailTab] = useState<RoundDetailTab>('regular')
  const [regularBasis, setRegularBasis] = useState<'score' | 'handicap'>('score')
  const [shinperioBasis, setShinperioBasis] = useState<'score' | 'handicap'>('score')
  const [detailRound, setDetailRound] = useState<SavedRound | null>(null)
  const [awardSnapshots, setAwardSnapshots] = useState<ClubAwardSnapshot[]>([])
  const [lottoEntries, setLottoEntries] = useState<RoundLottoEntry[]>([])
  const [lottoDraw, setLottoDraw] = useState<RoundLottoDraw | null>(null)
  const [lottoAwardConfig, setLottoAwardConfig] = useState<LottoAwardConfig>(DEFAULT_LOTTO_AWARD_CONFIG)
  const [clubMembers, setClubMembers] = useState<Array<{ userId: string; name: string; role: string }>>([])
  const [roundSchedules, setRoundSchedules] = useState<ScheduledRound[]>([])
  const [clubAwardConfig, setClubAwardConfig] = useState<{ count: number; items: string[]; manualWinners?: Record<string, string[]> } | null>(null)
  const [photoData, setPhotoData] = useState<string[]>(round.photoData ?? [])
  const [photoSaving, setPhotoSaving] = useState(false)
  const [photoCropSource, setPhotoCropSource] = useState<{ uri: string; width: number; height: number } | null>(null)
  const flip = useRef(new Animated.Value(0)).current
  const effectiveRound = detailRound ?? round
  const isScheduleOnly = false
  const coverPhoto = photoData[0]
  const scheduleHeroImageUrl = round.scheduleId
    ? schedules.find((item) => item.id === round.scheduleId)?.heroImageUrl
    : undefined
  const optimizedScheduleHeroImageUrl = useMemo(
    () => getOptimizedRemoteImageUrl(scheduleHeroImageUrl, { width: 720, height: 360, quality: 76 }),
    [scheduleHeroImageUrl],
  )
  const frontSummary = useMemo(
    () => buildRoundFrontSummary(round, rounds, handicapBasis),
    [round, rounds, handicapBasis],
  )
  const {
    par,
    best,
    avg,
    bestPlayerName,
    winnerName,
    winnerDiff,
    runnerUpName,
    runnerUpDiff,
    clubRecordRows,
    records,
    frontHighlights,
  } = frontSummary

  const toggleFlip = async () => {
    const next = !flipped
    if (next && !detailRound && !isScheduleOnly) {
      const [full, snapshots, entries, draw, members, lottoConfig, schedules, awardConfig] = await Promise.all([
        getRound(round.id),
        getClubAwardSnapshots(round.id).catch(() => []),
        round.scheduleId ? getRoundLottoEntries(round.scheduleId).catch(() => []) : Promise.resolve([]),
        round.scheduleId ? getRoundLottoDraw(round.scheduleId).catch(() => null) : Promise.resolve(null),
        activeClub?.id ? getClubMembers(activeClub.id).catch(() => []) : Promise.resolve([]),
        activeClub?.id ? getClubLottoAwardConfig(activeClub.id).catch(() => DEFAULT_LOTTO_AWARD_CONFIG) : Promise.resolve(DEFAULT_LOTTO_AWARD_CONFIG),
        activeClub?.id && round.scheduleId
          ? getRoundSchedules(activeClub.id, { scheduleIds: [round.scheduleId] }).catch(() => [])
          : Promise.resolve([]),
        activeClub?.id ? getClubAwardConfig(activeClub.id).catch(() => null) : Promise.resolve(null),
      ])
      if (full) setDetailRound(full)
      setAwardSnapshots(snapshots)
      setLottoEntries(entries)
      setLottoDraw(draw)
      setClubMembers(members)
      setLottoAwardConfig(lottoConfig)
      setRoundSchedules(schedules)
      setClubAwardConfig(awardConfig)
    }
    Animated.spring(flip, { toValue: next ? 1 : 0, friction: 8, tension: 72, useNativeDriver: true }).start()
    setFlipped(next)
  }
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] })
  const backOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] })

  useEffect(() => {
    setPhotoData(round.photoData ?? [])
  }, [round.id, round.photoData])

  const handlePickRoundPhoto = async () => {
    if (isScheduleOnly) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setPhotoCropSource({
      uri: asset.uri,
      width: asset.width || 1200,
      height: asset.height || 900,
    })
  }

  const saveRoundPhoto = async (crop: ImageCropRect) => {
    if (!photoCropSource) return
    setPhotoSaving(true)
    try {
      const uploadedUrl = await uploadRoundPhoto(photoCropSource.uri, round.id, crop)
      const nextPhotoData = [uploadedUrl, ...photoData].slice(0, 8)
      const updated = await updateRound(round.id, {
        courseName: round.courseName,
        date: round.date,
        pars: round.pars,
        players: round.players,
        photoData: nextPhotoData,
        settlement: round.settlement,
        golfCourseId: round.golfCourseId,
        holeLabels: round.holeLabels,
      })
      setPhotoData(updated.photoData ?? nextPhotoData)
      setDetailRound((current) => current ? { ...current, photoData: updated.photoData ?? nextPhotoData } : current)
      setPhotoCropSource(null)
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : String(error))
    } finally {
      setPhotoSaving(false)
    }
  }

  const openRound = async () => {
    if (isScheduleOnly) return
    if (!round.isComplete) {
      const full = await getRound(round.id)
      if (full) nav.navigate('ScoreEntry', { date: full.date, courseName: full.courseName, pars: full.pars, golfCourseId: full.golfCourseId, players: full.players, editId: full.id, settlement: full.settlement })
      return
    }
    nav.navigate('RoundDetail', { id: round.id })
  }

  const detailSummary = useMemo(
    () => buildRoundDetailSummary(effectiveRound, rounds, handicapBasis),
    [effectiveRound, rounds, handicapBasis],
  )
  const {
    detailPar,
    actualRegularRank,
    handicapRegularRank,
    hiddenHoles,
    shinScoreRank,
    shinRank,
    scoreRows,
  } = detailSummary
  const awardMoneySummary = useMemo(
    () => buildRoundAwardMoneySummary({
      round: effectiveRound,
      rounds,
      handicapBasis,
      detailPar,
      roundSchedules,
      clubAwardConfig,
      awardSnapshots,
      lottoEntries,
      lottoDraw,
      lottoAwardConfig,
      clubMembers,
    }),
    [
      effectiveRound,
      rounds,
      handicapBasis,
      detailPar,
      roundSchedules,
      clubAwardConfig,
      awardSnapshots,
      lottoEntries,
      lottoDraw,
      lottoAwardConfig,
      clubMembers,
    ],
  )
  const { awardRows, lottoAwardGroups, moneyGame, moneyPairs } = awardMoneySummary
  const detailTabs: { key: RoundDetailTab; label: string }[] = [
    { key: 'regular', label: '정규' },
    { key: 'peoria', label: '신페리오' },
    { key: 'award', label: '시상' },
  ]

  return (
    <>
    <View style={[s.flipCardScene, { width, height }]}>
      <Animated.View pointerEvents={flipped ? 'none' : 'auto'} style={[s.flipFace, { opacity: frontOpacity, transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}>
        <TouchableOpacity activeOpacity={0.96} style={s.flipTouch} onPress={toggleFlip}>
          <View style={s.roundHero}>
            <ImageBackground source={coverPhoto ? { uri: coverPhoto } : optimizedScheduleHeroImageUrl ? { uri: optimizedScheduleHeroImageUrl } : getCourseHeroImageSource(round.courseName)} style={s.roundPhotoHeader} imageStyle={s.roundHeroImage}>
              <View style={s.roundHeroShade} />
              <View style={s.roundHeroTopRow}>
                <View style={s.roundCounter}><Text style={s.roundCounterText}>{index + 1} / {totalCount}</Text></View>
                <View style={{ alignItems: 'flex-end', gap: 7 }}>
                  <View style={round.isComplete ? s.heroCompleteBadge : s.heroProgressBadge}><Text style={s.heroStatusText}>{round.isComplete ? '라운드 완료' : isScheduleOnly ? '기록 대기' : '라운드 중'}</Text></View>
                </View>
              </View>
              {isAdmin && round.scheduleId ? (
                <TouchableOpacity
                  style={s.roundManageButton}
                  onPress={(event) => {
                    event.stopPropagation()
                    nav.navigate('RoundSchedulePrototype', { editScheduleId: round.scheduleId, modalOnly: true })
                  }}
                  activeOpacity={0.84}
                >
                  <Text style={s.roundManageButtonText}>수정</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.84}
                disabled={photoSaving || isScheduleOnly}
                onPress={(event) => {
                  event.stopPropagation()
                  handlePickRoundPhoto()
                }}
                style={s.roundPhotoButton}
              >
                {photoSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.roundPhotoButtonText}>{coverPhoto ? '사진 변경' : '사진 등록'}</Text>}
              </TouchableOpacity>
              <View style={s.heroCourseBlock}>
                <Text style={s.heroDate}>{round.date.replace(/-/g, '.')}</Text>
                <Text style={s.heroCourseName} numberOfLines={2}>{round.courseName}</Text>
              </View>
            </ImageBackground>
            <View style={s.roundSummaryBody}>
              <View style={s.heroSummaryPanel}>
                <SummaryCell icon={isScheduleOnly ? '' : '🏆'} label={isScheduleOnly ? '' : bestPlayerName} value={isScheduleOnly ? '' : String(best)} />
                <SummaryCell icon={isScheduleOnly ? '' : '🥇'} label={isScheduleOnly ? '' : winnerName} value={isScheduleOnly ? '' : winnerDiff} accent />
                <SummaryCell icon={isScheduleOnly ? '' : '🥈'} label={isScheduleOnly ? '' : runnerUpName} value={isScheduleOnly ? '' : runnerUpDiff} />
                <SummaryCell label={isScheduleOnly ? '' : '평균'} value={isScheduleOnly ? '' : String(avg)} />
              </View>
              <View style={s.heroInfoPanel}>
                <Text style={s.heroSectionTitle}>👑 기네스 북 갱신 현황</Text>
                <View style={s.recordGrid}>
                  {records.slice(0, 3).map((r, i) => <View key={`${r.label}-${i}`} style={s.recordMiniCard}><Text style={s.recordMiniIcon}>{r.icon}</Text><Text style={s.recordMiniLabel}>{r.label}</Text><Text style={s.recordMiniValue} numberOfLines={1}>{r.value}</Text></View>)}
                </View>
                <Text style={[s.heroSectionTitle, { marginTop: 7 }]}>⭐ 주요 하이라이트</Text>
                <View style={s.highlightRow}>
                  {frontHighlights.map((item) => (
                    <Highlight key={item.label} icon={item.icon} label={item.label} value={item.value} />
                  ))}
                </View>
              </View>
              <Text style={s.flipHint}>카드를 눌러 상세 기록 보기  ↻</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View pointerEvents={flipped ? 'auto' : 'none'} style={[s.flipFace, s.flipBackFace, { opacity: backOpacity, transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}>
        <TouchableOpacity activeOpacity={1} style={s.backCard} onPress={toggleFlip}>
          <View style={s.backHeader}>
            <TouchableOpacity onPress={toggleFlip} style={s.backIconBtn}><Text style={s.backIconText}>↻</Text></TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.backCourseName} numberOfLines={1}>{round.courseName}</Text>
              <Text style={s.backDate}>{round.date.replace(/-/g, '.')}{isScheduleOnly ? '' : ` · PAR ${par} · 참가 ${round.players.length}명`}</Text>
            </View>
            <TouchableOpacity onPress={openRound} style={s.detailOpenBtn}><Text style={s.detailOpenText}>전체 상세</Text></TouchableOpacity>
          </View>
          <View style={s.backTabs}>
            {detailTabs.map((item) => <TouchableOpacity key={item.key} style={[s.backTab, detailTab === item.key && s.backTabActive]} onPress={() => setDetailTab(item.key)}><Text style={[s.backTabText, detailTab === item.key && s.backTabTextActive]}>{item.label}</Text></TouchableOpacity>)}
          </View>
          <View style={s.backBody}>{!detailRound && !isScheduleOnly && <Text style={s.detailLoadingText}>라운드 상세 데이터를 불러오는 중입니다.</Text>}
            {detailTab === 'regular' && (
              <RegularRankTab
                basis={regularBasis}
                onBasisChange={setRegularBasis}
                actualRows={actualRegularRank}
                handicapRows={handicapRegularRank}
                styles={s}
              />
            )}
            {detailTab === 'peoria' && (
              <ShinperioRankTab
                basis={shinperioBasis}
                onBasisChange={setShinperioBasis}
                hiddenHoles={hiddenHoles}
                scoreRows={shinScoreRank}
                handicapRows={shinRank}
                styles={s}
              />
            )}
            {detailTab === 'score' && <ScoreSummaryTab rows={scoreRows} styles={s} />}
            {detailTab === 'award' && (
              <RoundAwardTab
                clubName={activeClub?.name}
                clubRecordRows={clubRecordRows}
                awardRows={awardRows}
                round={effectiveRound}
                lottoEntries={lottoEntries}
                lottoDraw={lottoDraw}
                lottoAwardGroups={lottoAwardGroups}
                moneyGame={moneyGame}
                moneyPairs={moneyPairs}
                multiSpecialAwardKeys={MULTI_SPECIAL_AWARD_KEYS}
                styles={s}
              />
            )}
          </View>
          <TouchableOpacity style={s.flipBackHint} onPress={toggleFlip}><Text style={s.flipBackHintText}>↻ 앞면으로 돌아가기</Text></TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </View>
    {photoCropSource ? (
      <ImageCropModal
        uri={photoCropSource.uri}
        width={photoCropSource.width}
        height={photoCropSource.height}
        aspect={[16, 10]}
        title="라운드 사진 맞추기"
        onCancel={() => setPhotoCropSource(null)}
        onConfirm={saveRoundPhoto}
      />
    ) : null}
    </>
  )

}

function SummaryCell({ icon, label, value, accent = false }: { icon?: string; label: string; value: string; accent?: boolean }) {
  return <View style={s.summaryCell}><Text style={s.summaryLabel}>{icon ? `${icon} ` : ''}{label}</Text><Text style={[s.summaryValue, accent && { color: '#52e39a' }]}>{value}</Text></View>
}
function Highlight({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <View style={s.highlightCard}><Text style={s.highlightIcon}>{icon}</Text><Text style={s.highlightLabel}>{label}</Text><Text style={s.highlightValue}>{value}</Text></View>
}

function RankingPanel({ title, rows }: { title: string; rows: { name: string; main: string; sub: string }[] }) {
  return <View style={s.detailPanel}><Text style={s.detailPanelTitle}>{title}</Text>{rows.map((row, i) => <View key={`${row.name}-${i}`} style={s.rankRow}><View style={[s.rankNo, i === 0 && s.rankNoFirst]}><Text style={[s.rankNoText, i === 0 && { color: '#fff' }]}>{i + 1}</Text></View><View style={{ flex: 1 }}><Text style={s.rankName}>{row.name}</Text><Text style={s.rankSub}>{row.sub}</Text></View><Text style={s.rankMain}>{row.main}</Text></View>)}</View>
}
// ─── 개인별 ──────────────────────────────────────────────────────────────────

function ByPlayer({ rounds, handicapBasis = 5, myName, myUserId }: { rounds: SavedRound[]; handicapBasis?: number; myName: string | null; myUserId: string | null }) {
  const [targetScore, setTargetScore] = useState('')
  const [targetScoreLoading, setTargetScoreLoading] = useState(false)
  const [targetScoreSaving, setTargetScoreSaving] = useState(false)
  const [detailModal, setDetailModal] = useState<PersonalReportModal | null>(null)
  const [reportSectionWidth, setReportSectionWidth] = useState(0)
  const [personalStatsBySchedule, setPersonalStatsBySchedule] = useState<Record<string, PersonalRoundHoleStat[]>>({})
  const [memberNamesBySchedule, setMemberNamesBySchedule] = useState<Record<string, string>>({})
  const byName = useMemo(() => buildPlayerRoundsByName(rounds), [rounds])

  useEffect(() => {
    if (!myUserId) {
      setTargetScore('')
      return
    }

    let cancelled = false
    setTargetScoreLoading(true)
    getPersonalRecordGoal(myUserId)
      .then((goal) => {
        if (!cancelled) setTargetScore(goal ? String(goal.targetScore) : '')
      })
      .catch(() => {
        if (!cancelled) setTargetScore('')
      })
      .finally(() => {
        if (!cancelled) setTargetScoreLoading(false)
      })

    return () => { cancelled = true }
  }, [myUserId])

  const handleSaveTargetScore = useCallback(async () => {
    const nextTarget = Number(targetScore.replace(/[^0-9]/g, ''))
    if (!myUserId) {
      Alert.alert('목표 설정', '로그인 사용자 정보를 확인할 수 없습니다.')
      return
    }
    if (!nextTarget || nextTarget < 1 || nextTarget > 300) {
      Alert.alert('목표 설정', '목표 타수는 1~300 사이로 입력해 주세요.')
      return
    }

    setTargetScoreSaving(true)
    try {
      await savePersonalRecordGoal(myUserId, nextTarget)
      setTargetScore(String(nextTarget))
      Alert.alert('목표 설정', '목표 타수가 저장되었습니다.')
    } catch (error: any) {
      Alert.alert('저장 실패', error?.message ?? '목표 타수를 저장하지 못했습니다.')
    } finally {
      setTargetScoreSaving(false)
    }
  }, [myUserId, targetScore])

  const allScheduleIds = useMemo(
    () => Array.from(new Set(rounds.map((round) => round.scheduleId).filter((id): id is string => !!id))),
    [rounds],
  )

  useEffect(() => {
    if (!myUserId || allScheduleIds.length === 0) {
      setMemberNamesBySchedule({})
      return
    }

    let cancelled = false
    supabase
      .from('club_round_group_members')
      .select('schedule_id, member_name')
      .eq('member_user_id', myUserId)
      .in('schedule_id', allScheduleIds)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setMemberNamesBySchedule({})
          return
        }

        const next: Record<string, string> = {}
        ;(data ?? []).forEach((item) => {
          if (item.schedule_id && item.member_name) next[item.schedule_id] = item.member_name
        })
        setMemberNamesBySchedule(next)
      })

    return () => { cancelled = true }
  }, [myUserId, allScheduleIds.join('|')])

  const scheduleMemberNames = useMemo(
    () => Array.from(new Set(Object.values(memberNamesBySchedule).filter(Boolean))),
    [memberNamesBySchedule],
  )
  const personalPlayerName = useMemo(
    () => resolvePersonalPlayerName(myName, byName, scheduleMemberNames),
    [byName, myName, scheduleMemberNames],
  )
  const playerRounds = useMemo(
    () => personalPlayerName ? [...(byName.get(personalPlayerName) ?? [])].sort((a, b) => b.date.localeCompare(a.date)) : [],
    [byName, personalPlayerName],
  )
  const scheduleIds = useMemo(
    () => playerRounds
      .map((round) => rounds.find((item) => item.id === round.roundId)?.scheduleId)
      .filter((id): id is string => !!id),
    [playerRounds, rounds],
  )

  useEffect(() => {
    if (!myUserId || scheduleIds.length === 0) {
      setPersonalStatsBySchedule({})
      return
    }
    let cancelled = false
    getPersonalRoundStats(scheduleIds, myUserId)
      .then((items) => {
        if (cancelled) return
        const next: Record<string, PersonalRoundHoleStat[]> = Object.fromEntries(
          scheduleIds.map((scheduleId) => [scheduleId, []]),
        )
        for (const item of items) next[item.scheduleId] = item.holeStats ?? []
        setPersonalStatsBySchedule(next)
      })
      .catch(() => {
        if (!cancelled) setPersonalStatsBySchedule({})
      })
    return () => { cancelled = true }
  }, [myUserId, scheduleIds.join('|')])

  const personalSummary = useMemo(() => buildPersonalReportSummary({
    playerRounds,
    byName,
    personalPlayerName: personalPlayerName ?? '',
    rounds,
    handicapBasis,
    scheduleIds,
    personalStatsBySchedule,
    targetScore,
    scoreColors: {
      birdie: C.info,
      par: C.green,
      bogey: C.warn,
      doublePlus: C.danger,
    },
  }), [byName, handicapBasis, personalPlayerName, personalStatsBySchedule, playerRounds, rounds, scheduleIds.join('|'), targetScore])
  const {
    avg,
    best,
    recent5Avg,
    trendText,
    avgParType,
    frontAvg,
    backAvg,
    strength,
    weakness,
    rankSummary,
    totalPlayers,
    target,
    targetGap,
    firRate,
    girRate,
    obCount,
    hazardCount,
    avgPutts,
    threePuttCount,
    penaltyTotal,
    mainMissText,
    trendRounds,
    puttTrendData,
    obDistributionData,
    parRadarData,
    scoreTotals,
    scoreDistributionData,
    scoreStackData,
    aiComments,
    improvementItems,
    personalReportCards,
  } = personalSummary
  const modalTitle = detailModal ? getPersonalReportModalTitle(detailModal) : ''

  if (!personalPlayerName || playerRounds.length === 0) return <EmptyByPlayer />

  const reportBaseWidth = reportSectionWidth > 0 ? reportSectionWidth : 360
  const reportCardWidth = Math.min(248, Math.max(206, reportBaseWidth * 0.52))

  return (
    <>
      {detailModal && (
        <Modal transparent animationType="none" onRequestClose={() => setDetailModal(null)}>
          <SwipeDownSheet visible onClose={() => setDetailModal(null)} overlayStyle={s.personalReportSheetOverlay} sheetStyle={s.personalReportSheet}>
              <View style={s.personalReportSheetHandle} />
              <View style={s.modalHeader}>
                <Text style={s.personalReportSheetTitle}>{modalTitle}</Text>
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
                        editable={!targetScoreLoading && !targetScoreSaving}
                      />
                      <Text style={s.goalUnit}>타 목표</Text>
                      <TouchableOpacity
                        style={[s.goalSaveButton, (targetScoreLoading || targetScoreSaving) && s.goalSaveButtonDisabled]}
                        disabled={targetScoreLoading || targetScoreSaving}
                        onPress={handleSaveTargetScore}
                      >
                        {targetScoreLoading || targetScoreSaving
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={s.goalSaveButtonText}>저장</Text>}
                      </TouchableOpacity>
                    </View>
                    <Text style={s.goalGlobalHint}>클럽과 관계없이 마지막으로 저장한 목표가 개인 기록에 적용됩니다.</Text>
                    <Text style={s.insightText}>
                      {target ? (targetGap > 0 ? `현재 평균에서 ${targetGap}타를 줄이면 목표에 도달합니다.` : '현재 평균이 목표 수준에 도달했습니다.') : '목표 타수를 입력하면 현재 평균과 비교합니다.'}
                    </Text>
                  </>
                )}
                {detailModal === 'trend' && (
                  <>
                    <Text style={s.insightText}>{trendText}</Text>
                    <View style={s.miniTrendRow}>
                      {trendRounds.map((round) => (
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
                    <RadarChart data={parRadarData}  styles={s} />
                    <View style={s.metricGrid}>
                      <MetricCard label="Par 3" value={`${avgParType[3]}타`}  styles={s} />
                      <MetricCard label="Par 4" value={`${avgParType[4]}타`}  styles={s} />
                      <MetricCard label="Par 5" value={`${avgParType[5]}타`}  styles={s} />
                    </View>
                    {strength && weakness && <Text style={s.insightText}>강점은 {strength.label}, 보완 포인트는 {weakness.label}입니다.</Text>}
                  </>
                )}
                {detailModal === 'score' && (
                  <>
                    <ScoreDonut data={scoreDistributionData}  styles={s} />
                    <StackedScoreBars data={scoreStackData}  styles={s} />
                    <View style={s.scoreDistRow}>
                      <ScoreDist label="버디" value={scoreTotals.birdie} color={C.info}  styles={s} />
                      <ScoreDist label="파" value={scoreTotals.par} color={C.green}  styles={s} />
                      <ScoreDist label="보기" value={scoreTotals.bogey} color={C.warn}  styles={s} />
                      <ScoreDist label="더블" value={scoreTotals.double} color={C.danger}  styles={s} />
                      <ScoreDist label="트리플+" value={scoreTotals.triplePlus} color={C.text}  styles={s} />
                    </View>
                  </>
                )}
                {detailModal === 'rank' && (
                  <>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>평균 순위</Text><Text style={s.analysisValue}>{rankSummary.avg} / {totalPlayers}</Text></View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>핸디 순위</Text><Text style={s.analysisValue}>{rankSummary.handicap} / {totalPlayers}</Text></View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>버디 순위</Text><Text style={s.analysisValue}>{rankSummary.birdie} / {totalPlayers}</Text></View>
                  </>
                )}
                {detailModal === 'shot' && (
                  <>
                    <View style={s.gaugeRow}>
                      <DonutGauge label="FIR" value={firRate}  styles={s} />
                      <DonutGauge label="GIR" value={girRate}  styles={s} />
                    </View>
                    <PuttBars data={puttTrendData}  styles={s} />
                    <ObDistribution data={obDistributionData}  styles={s} />
                    <View style={s.metricGrid}>
                      <MetricCard label="FIR 성공률" value={firRate === null ? '-' : `${firRate}%`}  styles={s} />
                      <MetricCard label="GIR 성공률" value={girRate === null ? '-' : `${girRate}%`}  styles={s} />
                      <MetricCard label="평균 퍼팅" value={avgPutts === '-' ? '-' : `${avgPutts}개`}  styles={s} />
                      <MetricCard label="OB/해저드" value={`${obCount}/${hazardCount}`}  styles={s} />
                      <MetricCard label="패널티" value={`${penaltyTotal}개`}  styles={s} />
                    </View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>주요 미스</Text><Text style={s.analysisValue}>{mainMissText}</Text></View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>3퍼트 이상</Text><Text style={s.analysisValue}>{threePuttCount}회</Text></View>
                    <Text style={s.insightText}>OB와 해저드는 티샷 리스크, 3퍼트는 그린 위 손실로 나눠 관리하면 개선 포인트가 더 선명해집니다.</Text>
                  </>
                )}
                {detailModal === 'improve' && improvementItems.map((item) => (
                  <BulletText key={item} text={item}  styles={s} />
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
          </SwipeDownSheet>
        </Modal>
      )}

      <View style={s.aiCaddieCard}>
        <View style={s.aiCaddieHeader}>
          <View style={s.aiCaddieIconWrap}>
            <Text style={s.aiCaddieIcon}>🤖</Text>
          </View>
          <View style={s.aiCaddieTitleBlock}>
            <Text style={s.aiCaddieEyebrow}>AI Caddie</Text>
            <Text style={s.aiCaddieTitle}>개인 기록 분석</Text>
          </View>
        </View>

        <View style={s.aiCaddieInsightBox}>
          <Text style={s.aiCaddieLead}>{trendText}</Text>
          {aiComments.slice(0, 3).map((comment) => (
            <View key={comment} style={s.aiCaddieBulletRow}>
              <Text style={s.aiCaddieBulletDot}>•</Text>
              <Text style={s.aiCaddieBulletText}>{comment}</Text>
            </View>
          ))}
        </View>

        <View style={s.aiCaddieRecommendRow}>
          <Text style={s.aiCaddieRecommendLabel}>추천</Text>
          <Text style={s.aiCaddieRecommendText} numberOfLines={2}>
            {weakness ? `${weakness.label} 공략을 안정적으로 가져가면 평균 스코어 개선 여지가 큽니다.` : '최근 라운드 패턴을 더 쌓으면 맞춤 개선 포인트를 제안할게요.'}
          </Text>
        </View>
      </View>

      <View
        style={s.personalReportSection}
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width)
          if (nextWidth > 0 && nextWidth !== reportSectionWidth) setReportSectionWidth(nextWidth)
        }}
      >
        <View style={s.personalReportHeader}>
          <View>
            <Text style={s.personalReportEyebrow}>Personal Report</Text>
            <Text style={s.personalReportTitle}>개인 리포트</Text>
          </View>
          <Text style={s.personalReportHint}>좌우로 넘겨보기</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={reportCardWidth + 10}
          contentContainerStyle={s.personalReportCarousel}
        >
          {personalReportCards.map((card) => (
            <TouchableOpacity
              key={card.key}
              activeOpacity={0.88}
              style={[s.personalReportCard, { width: reportCardWidth }]}
              onPress={() => setDetailModal(card.modal)}
            >
              <Text style={s.personalReportCardAction}>자세히 보기 ›</Text>
              <View style={s.personalReportIconWrap}>
                <Text style={s.personalReportIcon}>{card.icon}</Text>
              </View>
              <Text style={s.personalReportCardTitle}>{card.title}</Text>
              <Text style={s.personalReportCardSubtitle} numberOfLines={1}>{card.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  )
}

// ─── 클럽 전체 ───────────────────────────────────────────────────────────────

function Club({ rounds, handicapBasis: currentHandicapBasis, members = [] }: { rounds: SavedRound[]; handicapBasis: HandicapBasis; members?: HistoryMember[] }) {
  const [showChart, setShowChart] = useState<'avg' | 'best' | false>(false)
  const [handicapBasis, setHandicapBasis] = useState<HandicapBasis>(currentHandicapBasis)
  const [showBasisDropdown, setShowBasisDropdown] = useState(false)
  useEffect(() => {
    setHandicapBasis(currentHandicapBasis)
  }, [currentHandicapBasis])

  const clubStats = useMemo(() => {
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

    const recordedStats = Array.from(byName.entries())
      .map(([name, entries]) => {
        const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
        const totals = sorted.map((e) => e.total)
        const lastN = sorted.slice(-handicapBasis)
        const handicap = Math.ceil(lastN.reduce((sum, e) => sum + (e.total - e.par), 0) / lastN.length)
        return {
          name,
          rounds: totals.length,
          avg: Math.ceil(totals.reduce((a, b) => a + b, 0) / totals.length),
          worst: Math.max(...totals),
          best: Math.min(...totals),
          handicap,
          hasRecord: true as const,
        }
      })
      .sort((a, b) => a.avg - b.avg)

    const recordedNameKeys = new Set(recordedStats.map((stat) => stat.name.trim().toLocaleLowerCase()))
    const unrecordedStats = members
      .filter((member) => member.name?.trim())
      .filter((member) => !recordedNameKeys.has(member.name.trim().toLocaleLowerCase()))
      .map((member) => ({
        name: member.name.trim(),
        rounds: 0,
        avg: null,
        worst: null,
        best: null,
        handicap: null,
        hasRecord: false as const,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))

    const stats = [...recordedStats, ...unrecordedStats]
    const totalAttendance = rounds.reduce((sum, r) => sum + r.players.length, 0)
    const recordedRoundCount = recordedStats.reduce((sum, stat) => sum + stat.rounds, 0)
    const clubAvg = recordedRoundCount > 0
      ? Math.ceil(recordedStats.reduce((sum, stat) => sum + stat.avg * stat.rounds, 0) / recordedRoundCount)
      : null

    const roundsByDate = [...rounds].sort((a, b) => a.date.localeCompare(b.date))
    const roundAvgs = roundsByDate.map((r) => ({
      date: r.date,
      value: Math.ceil(r.players.reduce((sum, p) => sum + playerTotal(p.strokes), 0) / r.players.length),
    }))

    const bestByRound = roundsByDate.map((r) => ({
      date: r.date,
      value: Math.min(...r.players.map((p) => playerTotal(p.strokes))),
    }))

    return { bestRecord, stats, totalAttendance, clubAvg, roundAvgs, bestByRound }
  }, [handicapBasis, members, rounds])

  if (rounds.length === 0) return <EmptyClub members={members} handicapBasis={currentHandicapBasis} />

  const { bestRecord, stats, totalAttendance, clubAvg, roundAvgs, bestByRound } = clubStats

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
            <Text style={{ fontSize: 22, fontWeight: '700', color: C.green }}>{clubAvg ?? '-'}</Text>
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
          <Text style={s.clubRankingTitle}>클럽 랭킹</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 99 }}>
            <Text style={s.clubRankingBasisLabel}>핸디</Text>
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
        <ScrollView
          style={s.clubRankingScroll}
          contentContainerStyle={s.clubRankingScrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {stats.map((stat, i) => {
          const medalBg = ['#fffbe8', '#f4f6f8', '#fdf5f0']
          const rank = stat.hasRecord ? i + 1 : null
          const isMedal = rank !== null && rank <= 3
          const handicapText = stat.handicap === null
            ? '-'
            : stat.handicap > 0
              ? `+${stat.handicap}`
              : `${stat.handicap}`
          return (
            <View
              key={`${stat.name}-${stat.hasRecord ? 'recorded' : 'member'}`}
              style={[
                s.tableRow,
                { alignItems: 'center' },
                isMedal && { backgroundColor: medalBg[(rank ?? 1) - 1], borderRadius: 8, marginBottom: 2 },
              ]}
            >
              <View style={{ flex: 0.6, alignItems: 'center' }}>
                {isMedal
                  ? <EmojiIcon char={['🥇','🥈','🥉'][(rank ?? 1) - 1]} size={20} />
                  : <Text style={s.clubRankNumber}>{rank ?? '-'}</Text>}
              </View>
              <Text style={[s.td, s.clubRankName, { flex: 2, fontWeight: isMedal ? '900' : '700' }]}>{shortName(stat.name)}</Text>
              <Text style={[s.td, s.clubRankValue, { flex: 1, textAlign: 'center' }]}>{stat.rounds || '-'}</Text>
              <Text style={[s.td, s.clubRankAverage, { flex: 1.2, textAlign: 'center', color: rank === 1 ? C.gold : C.text }]}>{stat.avg ?? '-'}</Text>
              <Text style={[s.td, s.clubRankValue, { flex: 1, textAlign: 'center' }]}>{stat.worst ?? '-'}</Text>
              <Text style={[s.td, s.clubRankValue, { flex: 1, textAlign: 'center' }]}>{stat.best ?? '-'}</Text>
              <Text style={[s.td, {
                flex: 1.2,
                textAlign: 'center',
                fontSize: 16,
                fontWeight: '800',
                color: stat.handicap === null ? C.muted : stat.handicap > 0 ? C.warn : stat.handicap < 0 ? C.info : C.text,
              }]}>
                {handicapText}
              </Text>
            </View>
          )
          })}
        </ScrollView>
      </View>
    </>
  )
}

// ─── 기네스 북 ─────────────────────────────────────────────────────────────

function HallOfFame({ rounds, handicapBasis }: { rounds: SavedRound[]; handicapBasis: number }) {
  const [rankingType, setRankingType] = useState<RankingType | null>(null)

  if (rounds.length === 0) return <EmptyHallOfFame />

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
        { icon: '○', label: '버디왕 (전체)', value: topBirdieText, type: 'birdie' as RankingType },
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
        { icon: '▾', label: '핸디 개선', value: topHandicapImproveText, type: 'handicapImprove' as RankingType },
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
        {highlightSections.map((section) => (
          <View key={section.title} style={s.hallSection}>
            <Text style={s.hallSectionTitle}>{section.title}</Text>
            {section.items.map(({ icon, label, value, type }) => (
              <HallRecordRow
                key={label}
                icon={icon}
                label={label}
                value={value}
                onPress={() => setRankingType(type)}
              />
            ))}
          </View>
        ))}
      </View>
    </>
  )
}

function HallRecordRow({ icon, label, value, onPress }: { icon: string; label: string; value: string; onPress?: () => void }) {
  const { record, member } = splitHallValue(value)
  const content = (
    <>
      <View style={s.hallIconWrap}><EmojiIcon char={icon} size={20} color={C.green} /></View>
      <Text style={s.hallLabel}>{label}</Text>
      <Text style={s.hallRecord}>{record}</Text>
      <Text style={s.hallMember}>{member}</Text>
    </>
  )
  return onPress ? (
    <TouchableOpacity style={s.hallRow} onPress={onPress}>{content}</TouchableOpacity>
  ) : (
    <View style={s.hallRow}>{content}</View>
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
  topActions: {
    backgroundColor: C.greenDark,
    paddingBottom: 12,
  },
  appHeader: { backgroundColor: C.greenDark, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  profileBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  profileInitial: { color: '#fff', fontSize: 16, fontWeight: '900' },
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#1a6b44', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  aiCaddieCard: {
    backgroundColor: C.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(32,160,91,0.18)',
    shadowColor: '#1a6b44',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  aiCaddieHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  aiCaddieIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aiCaddieIcon: { fontSize: 24, lineHeight: 28 },
  aiCaddieTitleBlock: { flex: 1, minWidth: 0 },
  aiCaddieEyebrow: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: C.green, letterSpacing: 0.2 },
  aiCaddieTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: C.text, letterSpacing: -0.7, marginTop: 1 },
  aiCaddieInsightBox: {
    borderRadius: 16,
    backgroundColor: C.greenLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aiCaddieLead: { fontSize: 18, lineHeight: 25, fontWeight: '900', color: C.text, marginBottom: 7, letterSpacing: -0.35 },
  aiCaddieBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  aiCaddieBulletDot: { width: 15, fontSize: 15, lineHeight: 24, color: C.green, fontWeight: '900' },
  aiCaddieBulletText: { flex: 1, fontSize: 15, lineHeight: 24, color: C.muted, fontWeight: '800' },
  aiCaddieRecommendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 11,
    paddingTop: 10,
  },
  aiCaddieRecommendLabel: {
    width: 58,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '900',
    color: C.green,
  },
  aiCaddieRecommendText: { flex: 1, fontSize: 15, lineHeight: 23, fontWeight: '800', color: C.text },
  roundCarouselWrap: { width: '100%', alignSelf: 'stretch', marginHorizontal: 0, overflow: 'hidden' },
  roundCarouselPlaceholder: { marginHorizontal: 24, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.42)' },
  roundSwipeHint: { textAlign: 'center', marginTop: 10, fontSize: 11, fontWeight: '700', color: C.muted },
  roundCardShell: { marginHorizontal: 0, flexShrink: 0 },
  flipCardScene: { position: 'relative' },
  flipFace: { position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden' },
  flipBackFace: { backfaceVisibility: 'hidden' },
  flipTouch: { flex: 1 },
  roundHero: { flex: 1, borderRadius: 26, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  roundPhotoHeader: { height: 218, padding: 14, justifyContent: 'space-between', alignItems: 'stretch' },
  roundHeroImage: { borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  roundHeroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,30,18,0.34)' },
  roundHeroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  roundCounter: { backgroundColor: 'rgba(7,22,18,0.58)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  roundCounterText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  roundManageButton: { position: 'absolute', right: 14, bottom: 56, zIndex: 21, elevation: 21, minWidth: 66, minHeight: 36, borderRadius: 16, backgroundColor: 'rgba(221,245,231,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  roundManageButtonText: { color: '#123D2B', fontSize: 13, fontWeight: '900' },
  roundPhotoButton: { position: 'absolute', right: 14, bottom: 14, zIndex: 20, elevation: 20, minWidth: 84, minHeight: 36, borderRadius: 16, backgroundColor: 'rgba(7,22,18,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11 },
  roundPhotoButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  roundSummaryBody: { flex: 1, padding: 14, gap: 10, justifyContent: 'space-between' },
  heroCompleteBadge: { backgroundColor: 'rgba(237,248,242,0.9)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  heroProgressBadge: { backgroundColor: 'rgba(27,158,94,0.92)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  heroStatusText: { color: '#173c2b', fontSize: 14, fontWeight: '800' },
  heroDate: { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '800', textAlign: 'left', textShadowColor: 'rgba(0,0,0,0.36)', textShadowRadius: 5 },
  heroCourseBlock: { alignItems: 'flex-start' },
  heroCourseName: { color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: '900', textAlign: 'left', textShadowColor: 'rgba(0,0,0,0.38)', textShadowRadius: 7 },
  heroSummaryPanel: { flexDirection: 'row', backgroundColor: C.greenLight, borderWidth: 1, borderColor: C.border, borderRadius: 17, paddingVertical: 9 },
  summaryCell: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: C.border },
  summaryLabel: { color: C.muted, fontSize: 13, fontWeight: '800' },
  summaryValue: { color: C.text, fontSize: 23, lineHeight: 27, fontWeight: '900', marginTop: 5 },
  heroInfoPanel: { backgroundColor: '#f8faf8', borderWidth: 1, borderColor: C.border, borderRadius: 17, padding: 9 },
  heroSectionTitle: { color: C.text, fontSize: 18, fontWeight: '900' },
  recordGrid: { flexDirection: 'row', gap: 6, marginTop: 8 },
  recordMiniCard: { flex: 1, minHeight: 64, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, padding: 7, alignItems: 'center', justifyContent: 'center' },
  recordMiniIcon: { fontSize: 20 },
  recordMiniLabel: { fontSize: 12, color: C.muted, fontWeight: '800', textAlign: 'center', marginTop: 3 },
  recordMiniValue: { fontSize: 14, color: C.text, fontWeight: '900', textAlign: 'center', marginTop: 3 },
  highlightRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  highlightCard: { flex: 1, minHeight: 62, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', padding: 7 },
  highlightIcon: { fontSize: 19 },
  highlightLabel: { color: C.muted, fontSize: 12, fontWeight: '800', marginTop: 3 },
  highlightValue: { color: C.text, fontSize: 14, fontWeight: '900', textAlign: 'center', marginTop: 3 },
  flipHint: { color: C.muted, textAlign: 'center', fontSize: 13, fontWeight: '800' },
  backCard: { flex: 1, backgroundColor: '#fff', borderRadius: 26, padding: 13, shadowColor: '#163d2b', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  backHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  backIconText: { fontSize: 25, color: C.text, fontWeight: '600' },
  backCourseName: { fontSize: 23, fontWeight: '900', color: C.text },
  backDate: { fontSize: 14, color: C.muted, fontWeight: '700', marginTop: 2 },
  detailOpenBtn: { borderRadius: 14, backgroundColor: C.greenLight, paddingHorizontal: 10, paddingVertical: 7 },
  detailOpenText: { fontSize: 13, fontWeight: '900', color: C.green },
  backTabs: { flexDirection: 'row', backgroundColor: '#f3f5f4', borderRadius: 16, padding: 4, marginBottom: 10 },
  backTab: { flex: 1, minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  backTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  backTabText: { color: C.muted, fontSize: 17, fontWeight: '800' },
  backTabTextActive: { color: C.green, fontWeight: '900' },
  backBody: { flex: 1 },
  detailPanel: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  detailPanelTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  detailPanelTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900', color: C.text, marginBottom: 10 },
  detailPanelTitleInline: { marginBottom: 0 },
  detailBasisSwitch: { flexDirection: 'row', backgroundColor: C.greenLight, borderRadius: 16, padding: 3 },
  detailBasisBtn: { minWidth: 55, minHeight: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  detailBasisBtnActive: { backgroundColor: C.green },
  detailBasisText: { fontSize: 15, fontWeight: '900', color: C.muted },
  detailBasisTextActive: { color: '#fff' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 62, borderTopWidth: 1, borderTopColor: '#eef1ef' },
  rankNo: { width: 29, height: 29, borderRadius: 15, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  rankNoFirst: { backgroundColor: C.green },
  rankNoText: { fontSize: 14, fontWeight: '900', color: C.green },
  rankName: { fontSize: 16, fontWeight: '900', color: C.text },
  rankSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  rankMain: { fontSize: 19, fontWeight: '900', color: C.green },
  scorePlayerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderTopWidth: 1, borderTopColor: '#eef1ef' },
  scorePlayerName: { flex: 1, fontSize: 16, fontWeight: '900', color: C.text },
  scorePlayerTotal: { fontSize: 18, fontWeight: '900', color: C.text },
  scorePlayerDiff: { width: 52, textAlign: 'right', fontSize: 15, fontWeight: '900', color: C.green },
  scoreMiniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 12 },
  scoreHoleCell: { width: '10.3%', minHeight: 41, borderRadius: 8, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  scoreHoleNo: { fontSize: 11, fontWeight: '900', color: C.text },
  scoreHolePar: { fontSize: 10, color: C.muted, marginTop: 2 },
  backAwardScroll: { flex: 1 },
  backAwardStack: { gap: 10, paddingBottom: 8 },
  backAwardCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 10 },
  backAwardHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  backAwardHeaderIcon: { fontSize: 20 },
  backAwardTitle: { fontSize: 18, fontWeight: '900', color: C.text },
  backAwardMuted: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: C.muted },
  backMoneySummary: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  awardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, borderTopWidth: 1, borderTopColor: '#eef1ef' },
  awardIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fffbe8', borderWidth: 1, borderColor: '#f0e0a0', alignItems: 'center', justifyContent: 'center' },
  awardIcon: { fontSize: 22 },
  awardLabel: { width: 68, fontSize: 14, color: C.muted, fontWeight: '800' },
  awardWinner: { flex: 1, fontSize: 17, color: C.text, fontWeight: '900' },
  awardDetailWrap: { borderRadius: 12, backgroundColor: C.greenLight, paddingHorizontal: 9, paddingVertical: 5, maxWidth: 82 },
  awardDetail: { fontSize: 14, color: C.green, fontWeight: '900' },
  lottoAwardGroupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42, borderTopWidth: 1, borderTopColor: '#eef1ef' },
  lottoAwardGroupText: { flex: 1.35, fontSize: 12, lineHeight: 17, fontWeight: '900', color: C.text },
  lottoAwardGroupNames: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '800', color: C.green, textAlign: 'right' },
  moneyPairRow: { flexDirection: 'row', alignItems: 'center', minHeight: 38, borderTopWidth: 1, borderTopColor: '#eef1ef' },
  moneyPairName: { width: 48, fontSize: 13, fontWeight: '900', color: C.text },
  moneyPairArrow: { width: 22, fontSize: 13, color: C.muted, textAlign: 'center' },
  moneyPairAmount: { marginLeft: 'auto', fontSize: 13, fontWeight: '900' },
  flipBackHint: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  flipBackHintText: { fontSize: 13, fontWeight: '800', color: C.muted },
  roundDetailPreview: { flex: 1, gap: 10 },
  previewSection: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 12 },
  previewSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  previewSectionTitle: { fontSize: 14, fontWeight: '900', color: C.text, marginBottom: 8 },
  previewSectionMeta: { fontSize: 11, fontWeight: '800', color: C.green },
  previewMetricRow: { flexDirection: 'row', gap: 8 },
  previewMetricCard: { flex: 1, minHeight: 74, borderRadius: 13, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', padding: 8 },
  previewMetricLabel: { fontSize: 9, color: C.muted, fontWeight: '800' },
  previewMetricValue: { fontSize: 14, color: C.text, fontWeight: '900', marginTop: 4 },
  previewMetricSub: { fontSize: 10, color: C.green, fontWeight: '900', marginTop: 2 },
  previewPlayerRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#edf1ee' },
  previewRankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  previewRankBadgeFirst: { backgroundColor: C.green },
  previewRankText: { fontSize: 11, color: C.green, fontWeight: '900' },
  previewPlayerName: { fontSize: 13, color: C.text, fontWeight: '900' },
  previewPlayerSub: { fontSize: 9, color: C.muted, marginTop: 2 },
  previewPlayerTotal: { fontSize: 14, color: C.text, fontWeight: '900' },
  previewPlayerDiff: { fontSize: 10, color: C.green, fontWeight: '900', marginTop: 2 },
  previewScoreRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#edf1ee' },
  previewScoreLabel: { minHeight: 28, paddingHorizontal: 4, textAlignVertical: 'center', fontSize: 9, color: C.muted, fontWeight: '900' },
  previewScoreCell: { width: 28, minHeight: 28, textAlign: 'center', textAlignVertical: 'center', fontSize: 9, color: C.text },
  detailLoadingText: { fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 6 },
  shinperioHoleText: { fontSize: 12, lineHeight: 17, color: C.muted, fontWeight: '800', marginTop: 2, marginBottom: 5 },
  detailTableHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 31, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  detailRankScroll: { flex: 1 },
  detailTableRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf1ee', paddingHorizontal: 4 },
  detailPodiumRow: { backgroundColor: 'rgba(32,160,91,0.06)', borderRadius: 10 },
  detailTh: { fontSize: 13, fontWeight: '900', color: C.muted },
  detailRank: { fontSize: 16, fontWeight: '900', color: C.muted, textAlign: 'center' },
  detailPlayerName: { flex: 1, fontSize: 18, fontWeight: '900', color: C.text },
  detailScoreText: { width: 52, textAlign: 'right', fontSize: 18, fontWeight: '900', color: C.text },
  detailSmallScore: { width: 48, textAlign: 'right', fontSize: 16, fontWeight: '900', color: C.text },
  detailNetText: { width: 52, textAlign: 'right', fontSize: 17, fontWeight: '900', color: C.green },
  scoreSummaryGrid: { gap: 6 },
  scoreSummaryCard: { minHeight: 52, borderRadius: 12, backgroundColor: C.greenLight, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  scoreSummaryName: { fontSize: 13, fontWeight: '900', color: C.text },
  scoreSummarySub: { fontSize: 9, color: C.muted, marginTop: 2 },
  scoreSummaryTotal: { fontSize: 17, fontWeight: '900', color: C.text },
  scoreSummaryDiff: { fontSize: 10, fontWeight: '900', color: C.green, marginTop: 1 },
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
  metricGridCompact: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metricCard: { flexBasis: '47%', flexGrow: 1, backgroundColor: C.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.border },
  metricLabel: { fontSize: 11, fontWeight: '800', color: C.muted },
  metricValue: { fontSize: 18, fontWeight: '900', color: C.text, marginTop: 4 },
  compactMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  compactMetric: {
    flexBasis: '31%', flexGrow: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.greenLight, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  compactMetricLabel: { fontSize: 11, fontWeight: '900', color: C.muted },
  compactMetricValue: { fontSize: 15, fontWeight: '900', color: C.text },
  compactActionButton: {
    minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  compactActionText: { fontSize: 13, fontWeight: '900', color: C.text },
  compactActionArrow: { fontSize: 18, fontWeight: '700', color: C.muted },
  gaugeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  gaugeCard: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.greenLight },
  visualCard: { borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, backgroundColor: C.greenLight, marginBottom: 10 },
  visualHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  visualTitle: { fontSize: 12, fontWeight: '900', color: C.muted },
  visualValue: { fontSize: 12, fontWeight: '900', color: C.text },
  visualEmpty: { minHeight: 42, textAlign: 'center', textAlignVertical: 'center', color: C.muted, fontSize: 12 },
  puttBarRow: { minHeight: 84, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  puttBarItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  puttBarValue: { fontSize: 10, fontWeight: '900', color: C.text, marginBottom: 4 },
  puttBar: { width: '70%', borderRadius: 8, backgroundColor: C.green },
  puttBarDate: { fontSize: 9, color: C.muted, marginTop: 5 },
  obGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  obCell: { flexBasis: '48%', flexGrow: 1, minHeight: 42, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  obLabel: { fontSize: 11, fontWeight: '900', color: C.muted },
  obValue: { fontSize: 16, fontWeight: '900', color: C.text },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  donutLegend: { flex: 1, gap: 7 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 12, fontWeight: '800', color: C.muted },
  legendValue: { fontSize: 12, fontWeight: '900', color: C.text },
  stackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  stackDate: { width: 36, fontSize: 10, fontWeight: '800', color: C.muted },
  stackTrack: { flex: 1, height: 14, borderRadius: 8, overflow: 'hidden', backgroundColor: C.border, flexDirection: 'row' },
  stackSeg: { height: '100%' },
  trendChartGrid: { gap: 8, marginBottom: 12 },
  smallTrendCard: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingTop: 10, paddingHorizontal: 10, backgroundColor: C.greenLight },
  smallTrendHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  smallTrendTitle: { fontSize: 12, fontWeight: '900', color: C.muted },
  smallTrendValue: { fontSize: 13, fontWeight: '900', color: C.text },
  smallTrendEmpty: { minHeight: 48, textAlign: 'center', textAlignVertical: 'center', color: C.muted, fontSize: 12 },
  playerPanelTabs: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  playerPanelTab: { flex: 1, minHeight: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  playerPanelTabActive: { backgroundColor: C.green },
  playerPanelTabText: { fontSize: 13, fontWeight: '800', color: C.muted },
  playerPanelTabTextActive: { color: '#fff' },
  personalReportSection: { marginBottom: 14 },
  personalReportHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  personalReportEyebrow: { fontSize: 13, lineHeight: 17, fontWeight: '900', color: C.green, letterSpacing: 0.4 },
  personalReportTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: C.text, letterSpacing: -0.7, marginTop: 1 },
  personalReportHint: { fontSize: 13, lineHeight: 18, fontWeight: '800', color: C.muted },
  personalReportCarousel: { gap: 14, paddingRight: 18 },
  personalReportCard: {
    minHeight: 124,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    padding: 16,
    shadowColor: '#1a6b44',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  personalReportIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  personalReportIcon: { fontSize: 22, lineHeight: 27 },
  personalReportCardTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', color: C.text, letterSpacing: -0.6 },
  personalReportCardSubtitle: { minHeight: 21, fontSize: 14, lineHeight: 20, fontWeight: '800', color: C.muted, marginTop: 3, paddingRight: 4 },
  personalReportCardAction: { position: 'absolute', top: 16, right: 15, zIndex: 2, fontSize: 13, lineHeight: 18, fontWeight: '900', color: C.green },
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
  goalSaveButton: { minWidth: 62, height: 40, paddingHorizontal: 15, borderRadius: 13, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  goalSaveButtonDisabled: { opacity: 0.55 },
  goalSaveButtonText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  goalGlobalHint: { fontSize: 11, lineHeight: 17, color: C.muted, marginTop: 9, marginBottom: 4 },
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
  hallSection: { marginTop: 14 },
  hallSectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '900', color: C.text, marginBottom: 7, letterSpacing: -0.45 },
  hallRow: { flexDirection: 'row', alignItems: 'center', minHeight: 70, paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.border, gap: 11 },
  hallIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  hallLabel: { flex: 1.45, fontSize: 17, lineHeight: 22, fontWeight: '700', color: C.muted, textAlign: 'left', letterSpacing: -0.3 },
  hallRecord: { flex: 0.8, fontSize: 20, lineHeight: 25, fontWeight: '900', color: C.text, textAlign: 'center', letterSpacing: -0.35 },
  hallMember: { flex: 1.1, fontSize: 17, lineHeight: 22, fontWeight: '900', color: C.text, textAlign: 'right', letterSpacing: -0.3 },
  hallValue: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: C.text, textAlign: 'right', flexShrink: 1 },
  smallBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 10, marginBottom: 4 },
  yearBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 18 },
  yearBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  yearText: { fontWeight: '800', fontSize: 18, color: C.text },
  dropdownTrigger: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.green, backgroundColor: C.green },
  dropdownTriggerText: { fontSize: 15, color: '#fff', fontWeight: '800' },
  dropdownMenu: { position: 'absolute', top: 32, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 10, zIndex: 100, minWidth: 90 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 16 },
  dropdownItemText: { fontSize: 13, color: C.text },
  dropdownItemActive: { color: C.green, fontWeight: '700' } as const,
  clubRankingTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: C.text, marginBottom: 0, letterSpacing: -0.7 },
  clubRankingBasisLabel: { fontSize: 16, lineHeight: 21, color: C.muted, fontWeight: '800' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 38, borderBottomWidth: 1.5, borderBottomColor: C.border, paddingBottom: 8, marginBottom: 2 },
  clubRankingScroll: { maxHeight: 500 },
  clubRankingScrollContent: { paddingBottom: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 14, lineHeight: 18, color: C.muted, fontWeight: '800', letterSpacing: -0.15 },
  td: { fontSize: 16, lineHeight: 21, color: C.text },
  clubRankNumber: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: C.text },
  clubRankName: { fontSize: 17, lineHeight: 22, letterSpacing: -0.35 },
  clubRankValue: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  clubRankAverage: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.2 },
  personalReportSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.46)', justifyContent: 'flex-end' },
  personalReportSheet: {
    width: '100%',
    maxHeight: '84%',
    backgroundColor: C.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  personalReportSheetHandle: { width: 46, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginBottom: 14 },
  personalReportSheetTitle: { flex: 1, marginRight: 10, fontSize: 22, lineHeight: 28, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, width: '90%', maxHeight: '78%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  closeBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14 },
  closeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
