import { useMemo } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
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
      <View style={styles.errorCopy}>
        <Text style={[styles.errorTitle, { color: palette.text }]}>홈 데이터를 불러오지 못했습니다</Text>
        <Text style={[styles.errorMessage, { color: palette.muted }]} numberOfLines={2}>{message}</Text>
      </View>
      <GPButton label="재시도" variant="soft" onPress={onRetry} style={styles.errorButton} />
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

  const recentStats = useMemo(
    () => applyStatNavigation(dashboard.stats.items, nav),
    [dashboard.stats.items, nav],
  )

  const heroActions = useMemo(() => [
    { key: 'groups', icon: '👥', label: '조편성', onPress: () => nav.navigate('RoundSchedulePrototype') },
    { key: 'lotto', icon: '🎱', label: 'Lotto', onPress: () => nav.navigate('RoundSchedulePrototype') },
    { key: 'start', icon: '▶', label: 'Start', onPress: () => nav.navigate('RoundSetup', {}) },
  ], [nav])

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
        scrollEnabled={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 76 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.green} />}
        showsVerticalScrollIndicator={false}
      >
        <PremiumHomeMotion index={0}>
          <PremiumHomeHeroSection
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
            onProfilePress={() => nav.navigate('Profile')}
            onCreateRound={() => nav.navigate('RoundSchedulePrototype', { openCreate: true })}
          />
        </PremiumHomeMotion>

        {!!error && (
          <PremiumHomeMotion index={1}>
            <HomeErrorCard message={error} onRetry={refresh} />
          </PremiumHomeMotion>
        )}

        <PremiumHomeMotion index={2}>
          <PremiumGogoCaddieCard
            userName={myName || '골퍼'}
            courseName={dashboard.aiCaddie.courseName}
            teeTime={dashboard.aiCaddie.teeTime}
            dday={dashboard.aiCaddie.dday}
            averageScore={dashboard.aiCaddie.averageScore}
            hasUpcomingRound={dashboard.aiCaddie.hasUpcomingRound}
            title={dashboard.aiCaddie.title}
            message={dashboard.aiCaddie.message}
            hasLiveAdvice={dashboard.aiCaddie.hasLiveAdvice}
            recommendedClub={dashboard.aiCaddie.recommendedClub}
            riskLabel={dashboard.aiCaddie.riskLabel}
            onCaddieBookPress={() => nav.navigate('CaddieBook', caddieBookParams(dashboard.upcomingRound))}
            onGroupPress={() => nav.navigate('RoundSchedulePrototype')}
            onLottoPress={() => nav.navigate('RoundSchedulePrototype')}
          />
        </PremiumHomeMotion>

        <PremiumHomeMotion index={3}>
          <PremiumRecentStatsSection stats={recentStats} />
        </PremiumHomeMotion>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  clubButton: { marginTop: 16 },
  emptyRoundIcon: { fontSize: 34, marginBottom: 10 },
  emptyRoundTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  emptyRoundText: { fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  errorCard: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorIcon: { fontSize: 22 },
  errorCopy: { flex: 1, minWidth: 0 },
  errorTitle: { fontSize: 14, fontWeight: '900', marginBottom: 2 },
  errorMessage: { fontSize: 11, fontWeight: '700', lineHeight: 15 },
  errorButton: { minWidth: 72 },
})
