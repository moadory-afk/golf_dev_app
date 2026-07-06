import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { GPButton, GPCard, GPSection } from '../design'
import { useSkin, type SkinId } from '../skins'
import { useAsync } from '../lib/useAsync'
import { useClub } from '../lib/ClubContext'
import { useUserProfile } from '../lib/UserProfileContext'
import {
  computeHandicaps,
  getRounds,
  playerTotal,
  totalPar,
  type SavedRound,
} from '../lib/store'
import {
  getRoundSchedules,
  getUpcomingRound,
  type ScheduledRound,
} from '../lib/roundSchedule'
import type { RootStackParamList } from '../navigation/types'
import { PremiumGogoCaddieCard, PremiumHomeHeroSection, PremiumHomeMotion, PremiumQuickMenuSection, PremiumRecentStatsSection, PremiumUpcomingRoundCard, type PremiumQuickMenuItem, type PremiumRecentStatItem } from '../features/home/components'

type Nav = NativeStackNavigationProp<RootStackParamList>

function todayLabel() {
  const now = new Date()
  return now.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

function timeGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return '좋은 아침입니다'
  if (hour < 17) return '좋은 오후입니다'
  return '좋은 저녁입니다'
}

function formatRoundDate(date?: string) {
  if (!date) return '일정 미정'
  const normalized = date.includes('T') ? date.slice(0, 10) : date
  const target = new Date(normalized)
  if (Number.isNaN(target.getTime())) return normalized
  return target.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function formatDday(date?: string) {
  if (!date || date.length < 10) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date.slice(0, 10))
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'D-DAY'
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`
}


function roundStatusLabel(status?: ScheduledRound['status']) {
  if (status === 'recruiting') return '모집중'
  if (status === 'closed') return '마감'
  if (status === 'finished') return '완료'
  return '예정 라운드'
}

function roundMemberCount(round?: ScheduledRound | null) {
  return round?.groups?.reduce((sum, group) => sum + group.members.length, 0) ?? 0
}

function isVisibleUpcomingRound(round: ScheduledRound) {
  const status = String(round.status).trim()
  return status !== 'closed' && status !== 'finished'
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function statText(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return '-'
  return value.toFixed(digits)
}

function roundTotalForUser(round: SavedRound, userName?: string | null) {
  const player = round.players.find((item) => item.name === userName) ?? round.players[0]
  if (!player) return null
  return playerTotal(player.strokes)
}


function scoreDisplay(value: number | null, suffix = '타') {
  if (value === null || !Number.isFinite(value)) return '-'
  return `${Math.round(value)}${suffix}`
}

function handicapDisplay(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '-'
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)
}

function recentTrendFromScores(scores: number[]): PremiumRecentStatItem['trend'] {
  if (scores.length < 2) return ['flat', 'flat', 'flat', 'flat', 'flat']
  return scores.slice(0, 5).map((score, index, list) => {
    const next = list[index + 1]
    if (typeof next !== 'number') return 'flat'
    if (score < next) return 'up'
    if (score > next) return 'down'
    return 'flat'
  })
}

function currentMonthRoundCount(rounds: SavedRound[]) {
  const now = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return rounds.filter((round) => round.date?.startsWith(prefix)).length
}

function HomeHeader({ name, onProfile }: { name?: string | null; onProfile: () => void }) {
  const { palette } = useSkin()
  return (
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.dateText, { color: palette.muted }]}>{todayLabel()}</Text>
        <Text style={[styles.greeting, { color: palette.text }]}>{timeGreeting()}, {name || '골퍼'}님 👋</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.84}
        onPress={onProfile}
        style={[styles.profileButton, { backgroundColor: palette.card, borderColor: palette.border }]}
      >
        <Text style={[styles.profileText, { color: palette.text }]}>MY</Text>
      </TouchableOpacity>
    </View>
  )
}

function HeroExperienceCard({
  handicap,
  averageScore,
  monthRounds,
  recentRounds,
}: {
  handicap: string
  averageScore: string
  monthRounds: number
  recentRounds: number
}) {
  const { palette } = useSkin()
  return (
    <View style={[styles.heroCard, { backgroundColor: palette.headerBg, borderColor: palette.border }]}> 
      <View style={styles.heroTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroEyebrow, { color: palette.accent }]}>GogoPar</Text>
          <Text style={[styles.heroTitle, { color: palette.headerText }]}>골프의 모든 순간을{`\n`}GogoPar가 함께합니다.</Text>
        </View>
        <View style={[styles.heroBadge, { backgroundColor: palette.accent }]}> 
          <Text style={[styles.heroBadgeText, { color: palette.accentText }]}>Golf OS</Text>
        </View>
      </View>
      <View style={styles.heroStatsRow}>
        <HeroStat label="핸디" value={handicap} />
        <HeroStat label="평균" value={averageScore} />
        <HeroStat label="이번달" value={`${monthRounds}`} suffix="R" />
        <HeroStat label="최근" value={`${recentRounds}`} suffix="R" />
      </View>
    </View>
  )
}

function HeroStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const { palette } = useSkin()
  return (
    <View style={styles.heroStatItem}>
      <Text style={[styles.heroStatLabel, { color: 'rgba(255,255,255,0.66)' }]}>{label}</Text>
      <Text style={[styles.heroStatValue, { color: palette.headerText }]}>
        {value}<Text style={styles.heroStatSuffix}>{suffix ?? ''}</Text>
      </Text>
    </View>
  )
}

function TodayRoundCard({ round, onCreate, onOpen }: { round?: ScheduledRound | null; onCreate: () => void; onOpen: () => void }) {
  const { palette } = useSkin()

  if (!round) {
    return (
      <GPCard style={styles.emptyRoundCard}>
        <Text style={styles.emptyRoundIcon}>⛳</Text>
        <Text style={[styles.emptyRoundTitle, { color: palette.text }]}>예정된 라운드가 없습니다</Text>
        <Text style={[styles.emptyRoundText, { color: palette.muted }]}>다음 라운드를 등록하고 멤버들과 일정을 공유해보세요.</Text>
        <GPButton label="라운드 일정 만들기" onPress={onCreate} style={{ marginTop: 16 }} />
      </GPCard>
    )
  }

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onOpen}>
      <GPCard style={styles.todayRoundCard}>
        <View style={styles.todayRoundTop}>
          <View>
            <Text style={[styles.roundDday, { color: palette.green }]}>{formatDday(round.date)}</Text>
            <Text style={[styles.roundCourse, { color: palette.text }]} numberOfLines={1}>{round.course}</Text>
          </View>
          <View style={[styles.teeTimePill, { backgroundColor: palette.greenLight }]}> 
            <Text style={[styles.teeTimeText, { color: palette.green }]}>{round.time || '시간 미정'}</Text>
          </View>
        </View>
        <Text style={[styles.roundDate, { color: palette.muted }]}>{formatRoundDate(round.date)}</Text>
        {!!round.note && <Text style={[styles.roundNote, { color: palette.muted }]} numberOfLines={2}>{round.note}</Text>}
        <View style={styles.roundMetaRow}>
          <RoundMeta label="조" value={`${round.groups?.length ?? 0}`} />
          <RoundMeta label="멤버" value={`${round.groups?.reduce((sum, group) => sum + group.members.length, 0) ?? 0}`} />
          <RoundMeta label="상태" value={round.status === 'recruiting' ? '모집중' : '예정'} />
        </View>
      </GPCard>
    </TouchableOpacity>
  )
}

function RoundMeta({ label, value }: { label: string; value: string }) {
  const { palette } = useSkin()
  return (
    <View style={[styles.roundMeta, { backgroundColor: palette.greenLight }]}> 
      <Text style={[styles.roundMetaLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.roundMetaValue, { color: palette.text }]}>{value}</Text>
    </View>
  )
}

function AICaddieCard({ upcoming, averageScore }: { upcoming?: ScheduledRound | null; averageScore: string }) {
  const { palette } = useSkin()
  const message = upcoming
    ? `${upcoming.course} 라운드가 다가오고 있어요. 오늘은 티샷보다 세컨샷 위치를 먼저 생각해보세요.`
    : `최근 평균 스코어는 ${averageScore}입니다. 다음 라운드에서는 파5 세컨샷 전략을 먼저 준비해보세요.`

  return (
    <GPCard style={[styles.aiCard, { backgroundColor: palette.greenLight }]}> 
      <View style={[styles.aiIconWrap, { backgroundColor: palette.card }]}> 
        <Text style={styles.aiIcon}>🤖</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.aiTitle, { color: palette.text }]}>AI 캐디 브리핑</Text>
        <Text style={[styles.aiMessage, { color: palette.muted }]}>{message}</Text>
      </View>
    </GPCard>
  )
}

function RecentRoundList({ rounds, userName, onOpenHistory }: { rounds: SavedRound[]; userName?: string | null; onOpenHistory: () => void }) {
  const { palette } = useSkin()
  const items = rounds.slice(0, 3)
  return (
    <GPCard style={{ padding: 4 }}>
      {items.length === 0 ? (
        <View style={styles.emptyRecentBox}>
          <Text style={[styles.emptyRoundText, { color: palette.muted }]}>아직 등록된 라운드 기록이 없습니다.</Text>
        </View>
      ) : items.map((round, index) => {
        const total = roundTotalForUser(round, userName)
        const par = totalPar(round.pars)
        const diff = total === null ? null : total - par
        return (
          <View key={round.id} style={[styles.recentRow, index < items.length - 1 && { borderBottomColor: palette.border, borderBottomWidth: 1 }]}> 
            <View style={{ flex: 1 }}>
              <Text style={[styles.recentCourse, { color: palette.text }]} numberOfLines={1}>{round.courseName}</Text>
              <Text style={[styles.recentDate, { color: palette.muted }]}>{formatRoundDate(round.date)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.recentScore, { color: palette.text }]}>{total ?? '-'}</Text>
              <Text style={[styles.recentDiff, { color: palette.muted }]}>{diff === null ? '-' : diff > 0 ? `+${diff}` : `${diff}`}</Text>
            </View>
          </View>
        )
      })}
      <TouchableOpacity activeOpacity={0.84} onPress={onOpenHistory} style={styles.moreButton}>
        <Text style={[styles.moreText, { color: palette.green }]}>전체 기록 보기</Text>
      </TouchableOpacity>
    </GPCard>
  )
}

function ThemeSelectorCompact() {
  const { skinId, skins, setSkinId, palette } = useSkin()
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScroll}>
      {skins.map((skin) => {
        const selected = skin.id === skinId
        return (
          <TouchableOpacity
            key={skin.id}
            activeOpacity={0.84}
            onPress={() => setSkinId(skin.id as SkinId)}
            style={[
              styles.themeChip,
              { backgroundColor: selected ? palette.green : palette.card, borderColor: selected ? palette.green : palette.border },
            ]}
          >
            <Text style={[styles.themeChipText, { color: selected ? palette.accentText : palette.text }]}>{skin.name}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

export default function HomeExperienceScreen() {
  const { palette } = useSkin()
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const { activeClub: club, clubsLoaded } = useClub()
  const { name: myName } = useUserProfile()
  const [refreshKey, setRefreshKey] = useState(0)

  const { data: rounds, loading: roundsLoading } = useAsync(
    () => (club ? getRounds(club.id) : Promise.resolve([])),
    [club?.id, refreshKey],
  )

  const { data: schedules, loading: scheduleLoading } = useAsync(
    () => (club ? getRoundSchedules(club.id) : Promise.resolve([])),
    [club?.id, refreshKey],
  )

  const visibleSchedules = useMemo(
    () => (schedules ?? []).filter(isVisibleUpcomingRound),
    [schedules],
  )
  const upcoming = getUpcomingRound(visibleSchedules) ?? visibleSchedules[0] ?? null
  const safeRounds = rounds ?? []
  const handicaps = useMemo(() => computeHandicaps(safeRounds, 5), [safeRounds])
  const myHandicap = myName ? handicaps.get(myName) ?? null : null
  const myTotals = safeRounds
    .map((round) => roundTotalForUser(round, myName))
    .filter((value): value is number => typeof value === 'number')
  const myAverage = average(myTotals.slice(0, 10))
  const recentScore = myTotals[0] ?? null
  const bestScore = myTotals.length ? Math.min(...myTotals) : null
  const monthRoundCount = currentMonthRoundCount(safeRounds)
  const recentStats: PremiumRecentStatItem[] = [
    {
      key: 'handicap',
      icon: '⭐',
      label: '핸디캡',
      value: handicapDisplay(myHandicap),
      caption: myTotals.length ? '최근 5경기 기준' : '기록 등록 필요',
      tone: 'primary',
      trend: recentTrendFromScores(myTotals),
      onPress: () => nav.navigate('Main', { screen: 'History' }),
    },
    {
      key: 'average',
      icon: '📈',
      label: '평균 스코어',
      value: scoreDisplay(myAverage),
      caption: myTotals.length ? '전체 경기 평균' : '첫 라운드를 기록하세요',
      tone: 'info',
      trend: recentTrendFromScores(myTotals.slice(0, 5)),
      onPress: () => nav.navigate('Main', { screen: 'History' }),
    },
    {
      key: 'recent',
      icon: '⛳',
      label: '최근 라운드',
      value: scoreDisplay(recentScore),
      caption: safeRounds[0]?.date ? formatRoundDate(safeRounds[0].date) : '최근 기록 없음',
      tone: 'success',
      trend: recentTrendFromScores(myTotals.slice(0, 5)),
      onPress: () => nav.navigate('Main', { screen: 'History' }),
    },
    {
      key: 'best',
      icon: '🏆',
      label: '베스트 스코어',
      value: scoreDisplay(bestScore),
      caption: monthRoundCount ? `이번 달 ${monthRoundCount}R` : '도전 기록 대기',
      tone: 'gold',
      trend: recentTrendFromScores([...myTotals].sort((a, b) => a - b).slice(0, 5)),
      onPress: () => nav.navigate('Main', { screen: 'History' }),
    },
  ]
  const loading = roundsLoading || scheduleLoading

  const onRefresh = useCallback(() => setRefreshKey((value) => value + 1), [])

  const quickActions: PremiumQuickMenuItem[] = [
    { key: 'round-record', icon: 'edit', title: '라운드 기록', subtitle: '스코어 입력', featured: true, onPress: () => nav.navigate('RoundSetup', {}) },
    { key: 'score-stats', icon: 'chart', title: '스코어 통계', subtitle: '최근 기록', onPress: () => nav.navigate('Main', { screen: 'History' }) },
    { key: 'club-board', icon: 'mail', title: '클럽 게시판', subtitle: '공지 확인', onPress: () => nav.navigate('NoticePrototype') },
    { key: 'club-friends', icon: 'users', title: '친구/동호회', subtitle: '멤버 관리', onPress: () => nav.navigate('Main', { screen: 'Club' }) },
    { key: 'club-skin', icon: 'settings', title: '동호회 스킨', subtitle: '테마 설정', badge: 'Skin', onPress: () => nav.navigate('Profile') },
  ]

  if (clubsLoaded && !club) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg, paddingTop: insets.top + 24 }]}> 
        <Text style={styles.emptyRoundIcon}>⛳</Text>
        <Text style={[styles.emptyRoundTitle, { color: palette.text }]}>소속 클럽이 필요합니다</Text>
        <Text style={[styles.emptyRoundText, { color: palette.muted }]}>GogoPar 홈을 사용하려면 클럽을 만들거나 참여해 주세요.</Text>
        <GPButton label="클럽으로 이동" onPress={() => nav.navigate('Main', { screen: 'Club' })} style={{ marginTop: 16 }} />
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}> 
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 34 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={palette.green} />}
        showsVerticalScrollIndicator={false}
      >
        <PremiumHomeMotion index={0}>
          <PremiumHomeHeroSection
            greeting={timeGreeting()}
            userName={myName || '골퍼'}
            clubName={club?.name || 'GogoPar Club'}
            courseName={upcoming?.courseName || upcoming?.course || '보문CC'}
            address={upcoming?.layoutName ? `${upcoming.layoutName} 코스` : '코스 주소는 캐디북에서 연결 예정'}
            weatherText="맑음"
            temperature="24°"
            dday={formatDday(upcoming?.date) || 'D-1'}
            roundDate={upcoming?.date ? formatRoundDate(upcoming.date) : '다음 라운드'}
            teeTime={upcoming?.time || '12:12'}
            totalCount={Math.max(1, Math.min(3, visibleSchedules.length || 3))}
            onClubPress={() => nav.navigate('Main', { screen: 'Club' })}
            onNotificationPress={() => nav.navigate('NoticePrototype')}
          />
        </PremiumHomeMotion>

        <PremiumHomeMotion index={1}>
          <GPSection title="테마">
            <ThemeSelectorCompact />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={2}>
          <GPSection title="Quick Menu">
            <PremiumQuickMenuSection items={quickActions} />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={3}>
          <GPSection title="Upcoming Round" right={loading ? <ActivityIndicator color={palette.green} /> : null}>
            <PremiumUpcomingRoundCard
              empty={!upcoming}
              statusLabel={roundStatusLabel(upcoming?.status)}
              courseName={upcoming?.courseName || upcoming?.course || '다음 라운드'}
              layoutName={upcoming?.layoutName}
              dateLabel={upcoming?.date ? formatRoundDate(upcoming.date) : '일정 미정'}
              teeTime={upcoming?.time || '시간 미정'}
              memberCount={roundMemberCount(upcoming)}
              weatherText="맑음"
              temperature="24°"
              onCreate={() => nav.navigate('RoundSchedulePrototype', { openCreate: true })}
              onPress={() => nav.navigate('RoundSchedulePrototype')}
              actions={[
                { key: 'course-map', icon: '🗺️', label: '코스맵', onPress: () => nav.navigate('RoundSchedulePrototype') },
                { key: 'groups', icon: '👥', label: '조편성', onPress: () => nav.navigate('RoundSchedulePrototype') },
                { key: 'lotto', icon: '🎱', label: 'Lotto 6/18', onPress: () => nav.navigate('RoundSchedulePrototype') },
              ]}
            />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={4}>
          <GPSection title="AI Caddie">
            <PremiumGogoCaddieCard
              courseName={upcoming?.courseName || upcoming?.course}
              teeTime={upcoming?.time}
              dday={formatDday(upcoming?.date) || 'D-1'}
              averageScore={statText(myAverage, 1)}
              hasUpcomingRound={!!upcoming}
              onPress={() => nav.navigate('RoundSchedulePrototype')}
            />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={5}>
          <GPSection title="Recent Stats">
            <PremiumRecentStatsSection stats={recentStats} />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={6}>
          <GPSection title="최근 라운드">
            <RecentRoundList rounds={safeRounds} userName={myName} onOpenHistory={() => nav.navigate('Main', { screen: 'History' })} />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={7}>
          <GPSection title="Community">
            <GPCard style={styles.communityCard}>
              <Text style={[styles.communityTitle, { color: palette.text }]}>함께 치면 더 즐거운 라운드</Text>
              <Text style={[styles.communityText, { color: palette.muted }]}>클럽 공지, 회비, 대회, 친구 활동을 하나의 흐름으로 연결할 예정입니다.</Text>
              <GPButton label="클럽 관리" variant="soft" onPress={() => nav.navigate('Main', { screen: 'Club' })} style={{ marginTop: 14 }} />
            </GPCard>
          </GPSection>
        </PremiumHomeMotion>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 14 },
  dateText: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  greeting: { fontSize: 23, fontWeight: '900', letterSpacing: -0.7 },
  profileButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profileText: { fontSize: 12, fontWeight: '900' },
  heroCard: { borderWidth: 1, borderRadius: 28, padding: 22, marginBottom: 18, overflow: 'hidden' },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroEyebrow: { fontSize: 13, fontWeight: '900', marginBottom: 8, letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { fontSize: 25, lineHeight: 32, fontWeight: '900', letterSpacing: -0.9 },
  heroBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  heroBadgeText: { fontSize: 11, fontWeight: '900' },
  heroStatsRow: { flexDirection: 'row', marginTop: 24, gap: 10 },
  heroStatItem: { flex: 1 },
  heroStatLabel: { fontSize: 11, fontWeight: '800', marginBottom: 5 },
  heroStatValue: { fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  heroStatSuffix: { fontSize: 12, fontWeight: '900' },
  emptyRoundCard: { alignItems: 'center', paddingVertical: 24 },
  emptyRoundIcon: { fontSize: 34, marginBottom: 10 },
  emptyRoundTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  emptyRoundText: { fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  todayRoundCard: { padding: 18 },
  todayRoundTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  roundDday: { fontSize: 12, fontWeight: '900', marginBottom: 5 },
  roundCourse: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8, maxWidth: 210 },
  teeTimePill: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  teeTimeText: { fontSize: 13, fontWeight: '900' },
  roundDate: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  roundNote: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 8 },
  roundMetaRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  roundMeta: { flex: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 11 },
  roundMetaLabel: { fontSize: 10, fontWeight: '800', marginBottom: 3 },
  roundMetaValue: { fontSize: 14, fontWeight: '900' },
  aiCard: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  aiIconWrap: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  aiIcon: { fontSize: 25 },
  aiTitle: { fontSize: 16, fontWeight: '900', marginBottom: 5 },
  aiMessage: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  recentCourse: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  recentDate: { fontSize: 12, fontWeight: '700' },
  recentScore: { fontSize: 22, fontWeight: '900' },
  recentDiff: { fontSize: 12, fontWeight: '800' },
  emptyRecentBox: { padding: 18, alignItems: 'center' },
  moreButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  moreText: { fontSize: 13, fontWeight: '900' },
  communityCard: { padding: 18 },
  communityTitle: { fontSize: 17, fontWeight: '900', marginBottom: 7 },
  communityText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  themeScroll: { gap: 8, paddingRight: 20 },
  themeChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
  themeChipText: { fontSize: 12, fontWeight: '900' },
})
