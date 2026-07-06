import { useCallback, useMemo, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { GPButton, GPCard } from '../design'
import { useSkin } from '../skins'
import { useClub } from '../lib/ClubContext'
import { useUserProfile } from '../lib/UserProfileContext'
import type { RootStackParamList } from '../navigation/types'
import {
  PremiumGogoCaddieCard,
  PremiumHomeHeroSection,
  PremiumHomeMotion,
  PremiumRecentStatsSection,
  type PremiumRecentStatItem,
} from '../features/home/components'
import { useHomeDashboard } from '../features/home/hooks/useHomeDashboard'
import type { HomeHeroRound, HomeUpcomingRound } from '../features/home/types/home'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COURSE_HERO_STORAGE_KEY, getCourseHeroAssetByKey, getCourseHeroImageSource } from '../data/courseHeroImages'
import { HomeLayoutRenderer, premiumGolfHomeLayout } from '../features/home/layout'

type Nav = NativeStackNavigationProp<RootStackParamList>

function caddieBookParams(round: HomeUpcomingRound | null) {
  if (!round) return undefined
  return {
    courseId: round.courseId,
    layoutId: round.layoutId,
    courseName: round.courseName,
    layoutName: round.layoutName,
    scheduleId: round.id,
  }
}

function caddieBookHeroParams(round: HomeHeroRound) {
  return {
    courseId: round.courseId,
    layoutId: round.layoutId,
    courseName: round.courseName,
    layoutName: round.layoutName,
    scheduleId: round.id,
  }
}

function resolveFeedNavigation(nav: Nav, actionType: string, round: HomeUpcomingRound | null) {
  if (actionType === 'open_caddie_map') {
    const params = caddieBookParams(round)
    if (params) return nav.navigate('CaddieBook', params)
    return nav.navigate('RoundSchedulePrototype', { openCreate: true })
  }
  if (actionType === 'open_groups' || actionType === 'open_lotto') return nav.navigate('RoundSchedulePrototype')
  if (actionType === 'open_notice') return nav.navigate('NoticePrototype')
  if (actionType === 'open_result') return nav.navigate('Main', { screen: 'History' })
  return nav.navigate('RoundSchedulePrototype', { openCreate: true })
}

function applyStatNavigation(stats: PremiumRecentStatItem[], nav: Nav): PremiumRecentStatItem[] {
  return stats.map((item) => ({
    ...item,
    onPress: () => nav.navigate('Main', { screen: 'History' }),
  }))
}

function HomeErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { palette } = useSkin()

  return (
    <GPCard style={styles.errorCard}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={[styles.errorTitle, { color: palette.text }]}>홈 데이터를 불러오지 못했습니다</Text>
      <Text style={[styles.errorMessage, { color: palette.muted }]}>{message}</Text>
      <GPButton label="다시 시도" variant="soft" onPress={onRetry} style={styles.errorButton} />
    </GPCard>
  )
}

export default function HomeExperienceScreen() {
  const { palette } = useSkin()
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const { activeClub: club, clubsLoaded } = useClub()
  const { name: myName, userId } = useUserProfile()
  const { dashboard, loading, error, refresh } = useHomeDashboard({ clubId: club?.id, userName: myName, userId })
  const [selectedHeroKey, setSelectedHeroKey] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let mounted = true
      AsyncStorage.getItem(COURSE_HERO_STORAGE_KEY)
        .then((value) => {
          if (mounted) setSelectedHeroKey(value)
        })
        .catch(() => {
          if (mounted) setSelectedHeroKey(null)
        })
      return () => { mounted = false }
    }, []),
  )

  const activeHeroImageSource = selectedHeroKey
    ? getCourseHeroAssetByKey(selectedHeroKey).source
    : getCourseHeroImageSource(dashboard.hero.rounds[0]?.courseName ?? dashboard.hero.courseName)

  const recentStats = useMemo(
    () => applyStatNavigation(dashboard.stats.items, nav),
    [dashboard.stats.items, nav],
  )

  const heroActions = useMemo(() => [
    { key: 'caddie-book', icon: '📖', label: '캐디북', onPress: (round: HomeHeroRound) => nav.navigate('CaddieBook', caddieBookHeroParams(round)) },
    { key: 'groups', icon: '👥', label: '조편성', onPress: () => nav.navigate('RoundSchedulePrototype') },
    { key: 'lotto', icon: '🎲', label: 'Lotto', onPress: () => nav.navigate('RoundSchedulePrototype') },
  ], [nav])

  const conciergeActions = useMemo(() => [
    { key: 'caddie-map', icon: '🗺️', title: '캐디맵', subtitle: '공략 보기', onPress: () => resolveFeedNavigation(nav, 'open_caddie_map', dashboard.upcomingRound) },
    { key: 'groups', icon: '👥', title: '조편성', subtitle: '멤버 확인', onPress: () => nav.navigate('RoundSchedulePrototype') },
    { key: 'lotto', icon: '🎱', title: 'Lotto', subtitle: '확인하기', onPress: () => nav.navigate('RoundSchedulePrototype') },
  ], [dashboard.upcomingRound, nav])

  if (clubsLoaded && !club) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg, paddingTop: insets.top + 24 }]}> 
        <Text style={styles.emptyRoundIcon}>⛳</Text>
        <Text style={[styles.emptyRoundTitle, { color: palette.text }]}>소속 클럽이 필요합니다</Text>
        <Text style={[styles.emptyRoundText, { color: palette.muted }]}>GogoPar 홈을 사용하려면 클럽을 만들거나 참여해 주세요.</Text>
        <GPButton label="클럽으로 이동" onPress={() => nav.navigate('Main', { screen: 'Club' })} style={styles.clubButton} />
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}> 
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.green} />}
        showsVerticalScrollIndicator={false}
      >
        <HomeLayoutRenderer
          layout={premiumGolfHomeLayout}
          slots={{
            hero: (
              <PremiumHomeMotion index={0}>
                <PremiumHomeHeroSection
                  greeting=""
                  userName={myName || '골퍼'}
                  clubName={club?.name || 'GogoPar Club'}
                  rounds={dashboard.hero.rounds}
                  fallbackCourseName={dashboard.hero.courseName}
                  fallbackAddress={dashboard.hero.address}
                  fallbackWeatherText={dashboard.hero.weatherText}
                  fallbackTemperature={dashboard.hero.temperature}
                  fallbackDday={dashboard.hero.dday}
                  fallbackRoundDate={dashboard.hero.roundDate}
                  fallbackTeeTime={dashboard.hero.teeTime}
                  isAdmin={club?.role === 'admin'}
                  actions={heroActions}
                  onClubPress={() => nav.navigate('Main', { screen: 'Club' })}
                  onNotificationPress={() => nav.navigate('NoticePrototype')}
                  onCreateRound={() => nav.navigate('RoundSchedulePrototype', { openCreate: true })}
                  heroImageSource={activeHeroImageSource}
                />
              </PremiumHomeMotion>
            ),
            error: error ? (
              <PremiumHomeMotion index={1}>
                <HomeErrorCard message={error} onRetry={refresh} />
              </PremiumHomeMotion>
            ) : null,
            concierge: (
              <PremiumHomeMotion index={2}>
                <PremiumGogoCaddieCard
                  userName={myName || '골퍼'}
                  courseName={dashboard.aiCaddie.courseName}
                  teeTime={dashboard.aiCaddie.teeTime}
                  averageScore={dashboard.aiCaddie.averageScore}
                  hasUpcomingRound={dashboard.aiCaddie.hasUpcomingRound}
                  feed={dashboard.feed}
                  actions={conciergeActions}
                  onPress={() => resolveFeedNavigation(nav, dashboard.feed.actionType, dashboard.upcomingRound)}
                />
              </PremiumHomeMotion>
            ),
            stats: recentStats.length > 0 ? (
              <PremiumHomeMotion index={3}>
                <PremiumRecentStatsSection stats={recentStats} />
              </PremiumHomeMotion>
            ) : null,
          }}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  clubButton: { marginTop: 16 },
  emptyRoundIcon: { fontSize: 34, marginBottom: 10 },
  emptyRoundTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  emptyRoundText: { fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  errorCard: { alignItems: 'center', padding: 18, marginBottom: 4 },
  errorIcon: { fontSize: 28, marginBottom: 8 },
  errorTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  errorMessage: { fontSize: 13, fontWeight: '600', lineHeight: 19, textAlign: 'center' },
  errorButton: { marginTop: 14 },
})
