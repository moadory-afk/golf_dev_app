import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '../components/AppHeader'
import { GPText } from '../components/ui'
import { SkinSwitcher } from '../components/SkinSwitcher'
import {
  AICaddieCard,
  CommunityPreviewSection,
  HomeHeroSection,
  QuickMenuSection,
  RecentStatsSection,
  TodayRoundCard,
} from '../features/home/components'
import { useClub } from '../lib/ClubContext'
import { useUserProfile } from '../lib/UserProfileContext'
import { computeHandicaps, getRounds, playerTotal, totalPar, type SavedRound } from '../lib/store'
import { getRoundSchedules, type ScheduledRound } from '../lib/roundSchedule'
import { useSkin } from '../skins'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

type HomeData = {
  rounds: SavedRound[]
  schedules: ScheduledRound[]
}

function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthKey() {
  return todayKey().slice(0, 7)
}

function timeGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function formatDday(date?: string) {
  if (!date || date.length < 10) return '일정 없음'
  const base = new Date(todayKey())
  const target = new Date(date.slice(0, 10))
  const diff = Math.round((target.getTime() - base.getTime()) / 86400000)
  if (diff === 0) return 'D-DAY'
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`
}

function formatDate(date?: string) {
  if (!date || date.length < 10) return '-'
  const target = new Date(date.slice(0, 10))
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const month = target.getMonth() + 1
  const day = target.getDate()
  return `${month}.${day}(${dayNames[target.getDay()]})`
}

function diffText(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-'
  return value > 0 ? `+${value}` : `${value}`
}

function safeAverage(values: number[]) {
  if (!values.length) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

function isVisibleUpcomingRound(round: ScheduledRound) {
  const status = String(round.status).trim()
  return status !== 'closed' && status !== 'finished'
}

function findMyPlayer(round: SavedRound, myName?: string | null) {
  if (!myName) return null
  return round.players.find((player) => player.name === myName) ?? null
}

function getGroupText(round?: ScheduledRound | null, myUserId?: string | null, myName?: string | null) {
  if (!round) return '조 편성 대기 중'
  const group = round.groups.find((item) =>
    item.members.some((member) => member.userId === myUserId || member.name === myName),
  ) ?? round.groups[0]
  if (!group) return '조 편성 대기 중'
  const members = group.members.map((member) => member.name).filter(Boolean).join(' · ')
  return `${group.name}${members ? ` · ${members}` : ''}`
}

function makeCaddieMessage(hasRound: boolean, handicap: number | null, average: number | null) {
  if (hasRound) {
    if (handicap !== null && handicap <= 10) return '오늘은 핀 공략보다 안전한 그린 중앙 공략이 스코어를 지켜줍니다.'
    return '첫 3홀은 무리하지 말고 페어웨이 안착률을 우선으로 가져가세요.'
  }
  if (average !== null) return `최근 평균은 ${average}타입니다. 다음 라운드는 퍼팅 수만 줄여도 체감이 큽니다.`
  return '라운드 기록이 쌓이면 코스별 추천 전략을 자동으로 보여드릴게요.'
}

export default function HomeScreen() {
  const { palette } = useSkin()
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const { activeClub: club, clubsLoaded } = useClub()
  const { name: myName, userId: myUserId } = useUserProfile()
  const [homeData, setHomeData] = useState<HomeData>({ rounds: [], schedules: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadHome = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!club?.id) {
      setHomeData({ rounds: [], schedules: [] })
      setLoading(false)
      setRefreshing(false)
      return
    }
    if (mode === 'initial') setLoading(true)
    if (mode === 'refresh') setRefreshing(true)
    try {
      const [rounds, schedules] = await Promise.all([
        getRounds(club.id),
        getRoundSchedules(club.id, { fromDate: new Date().toISOString().slice(0, 10), limit: 8 }),
      ])
      setHomeData({ rounds, schedules })
    } catch (error) {
      Alert.alert('홈 데이터 오류', error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [club?.id])

  useEffect(() => {
    if (clubsLoaded && !club) {
      nav.navigate('Main', { screen: 'Club' })
      return
    }
    if (clubsLoaded) loadHome('initial')
  }, [clubsLoaded, club, loadHome, nav])

  const stats = useMemo(() => {
    const myRounds = homeData.rounds
      .filter((round) => !!findMyPlayer(round, myName))
      .sort((a, b) => b.date.localeCompare(a.date))
    const scores = myRounds
      .map((round) => findMyPlayer(round, myName))
      .filter((player): player is NonNullable<typeof player> => !!player)
      .map((player) => playerTotal(player.strokes))
    const average = safeAverage(scores)
    const best = scores.length ? Math.min(...scores) : null
    const monthly = myRounds.filter((round) => round.date.startsWith(monthKey())).length
    const handicapMap = computeHandicaps(homeData.rounds, 5)
    const handicap = myName ? handicapMap.get(myName) ?? null : null
    const lastRound = myRounds[0]
    const lastPlayer = lastRound ? findMyPlayer(lastRound, myName) : null
    const lastDiff = lastRound && lastPlayer ? playerTotal(lastPlayer.strokes) - totalPar(lastRound.pars) : null

    return {
      myRounds,
      average,
      best,
      monthly,
      handicap,
      lastRound,
      lastDiff,
    }
  }, [homeData.rounds, myName])

  const nextRound = useMemo(() => {
    const today = todayKey()
    return homeData.schedules
      .filter((round) => isVisibleUpcomingRound(round) && round.date >= today)
      .sort((a, b) => `${a.date} ${a.time || '99:99'}`.localeCompare(`${b.date} ${b.time || '99:99'}`))[0] ?? null
  }, [homeData.schedules])

  const displayName = myName || '골퍼'
  const averageScore = stats.average !== null ? `${stats.average}` : '-'
  const handicapText = diffText(stats.handicap)
  const monthlyRounds = `${stats.monthly}R`
  const hasRound = !!nextRound
  const caddieMessage = makeCaddieMessage(hasRound, stats.handicap, stats.average)

  const quickMenuItems = [
    { key: 'round', icon: '🏌️', title: '라운드', subtitle: '일정', onPress: () => nav.navigate('RoundSchedulePrototype', { openCreate: true }) },
    { key: 'caddiebook', icon: '📒', title: '캐디북', subtitle: '공략', onPress: () => nav.navigate('RoundSchedulePrototype', {}) },
    { key: 'ai', icon: '🤖', title: 'AI', subtitle: '캐디', onPress: () => Alert.alert('AI 캐디', 'Smart Caddie Sprint에서 연결할 예정입니다.') },
    { key: 'stats', icon: '📊', title: '기록', subtitle: '통계', onPress: () => nav.navigate('Main', { screen: 'History' }) },
    { key: 'trophy', icon: '🏆', title: '대회', subtitle: '시상', onPress: () => Alert.alert('대회', 'Tournament Sprint에서 대회/시상 기능을 연결합니다.') },
    { key: 'club', icon: '👥', title: '클럽', subtitle: '관리', onPress: () => nav.navigate('Main', { screen: 'Club' }) },
  ]

  const recentStats = [
    { label: 'BEST', value: stats.best !== null ? `${stats.best}` : '-', sub: '최저타' },
    { label: 'LAST', value: stats.lastDiff !== null ? diffText(stats.lastDiff) : '-', sub: stats.lastRound?.courseName ?? '최근 경기' },
    { label: 'ROUNDS', value: `${stats.myRounds.length}`, sub: '누적 라운드' },
  ]

  if (!clubsLoaded || loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.green} size="large" />
        <GPText variant="body" tone="muted" style={{ marginTop: 12 }}>GogoPar를 준비하고 있습니다.</GPText>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 88 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHome('refresh')} tintColor={palette.green} />}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader myName={myName} />

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <GPText variant="caption" tone="muted" weight="bold">골프의 모든 순간을</GPText>
            <GPText variant="title" weight="black">GogoPar가 함께합니다.</GPText>
          </View>
          <SkinSwitcher compact />
        </View>

        <HomeHeroSection
          name={displayName}
          greeting={timeGreeting()}
          subtitle="오늘도 좋은 라운드 되세요."
          handicap={handicapText}
          averageScore={averageScore}
          monthlyRounds={monthlyRounds}
          onPrimaryPress={() => nav.navigate('RoundSchedulePrototype', {})}
        />

        <QuickMenuSection items={quickMenuItems} />

        <TodayRoundCard
          hasRound={hasRound}
          dday={formatDday(nextRound?.date)}
          course={nextRound?.courseName || nextRound?.course || '라운드 일정'}
          dateText={nextRound ? formatDate(nextRound.date) : ''}
          teeTime={nextRound?.time ?? ''}
          groupText={getGroupText(nextRound, myUserId, myName)}
          onPress={() => nav.navigate('RoundSchedulePrototype', {})}
        />

        <AICaddieCard
          message={caddieMessage}
          onPress={() => Alert.alert('AI 캐디', '다음 Sprint에서 AI 캐디 홈 카드와 연결합니다.')}
        />

        <RecentStatsSection stats={recentStats} />

        <CommunityPreviewSection
          clubName={club?.name ?? 'GogoPar Club'}
          onPress={() => nav.navigate('NoticePrototype')}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 6,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: -4,
  },
})
