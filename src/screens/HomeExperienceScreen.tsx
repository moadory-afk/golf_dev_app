import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { GPButton } from '../design'
import { createShadow, spacing } from '../design/tokens'
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

const gogoMark = require('../../assets/gogopar_i.png')

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

function HeaderBar({
  clubName,
  loading,
  onClubPress,
  onNoticePress,
  onProfilePress,
}: {
  clubName: string
  loading: boolean
  onClubPress: () => void
  onNoticePress: () => void
  onProfilePress: () => void
}) {
  const { palette } = useSkin()

  return (
    <View style={styles.headerRow}>
      <TouchableOpacity
        activeOpacity={0.84}
        onPress={onClubPress}
        style={[styles.clubPill, createShadow(palette, 1), { backgroundColor: palette.card, borderColor: palette.border }]}
      >
        <Text style={styles.clubIcon}>⛳</Text>
        <Text style={[styles.clubText, { color: palette.text }]} numberOfLines={1}>{clubName}</Text>
        <Text style={[styles.clubArrow, { color: palette.text }]}>⌄</Text>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        <TouchableOpacity
          activeOpacity={0.84}
          onPress={onNoticePress}
          style={[styles.circleButton, createShadow(palette, 1), { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          {loading ? <ActivityIndicator color={palette.green} /> : <Text style={styles.noticeIcon}>🔔</Text>}
          <View style={[styles.badge, { backgroundColor: palette.danger }]}> 
            <Text style={styles.badgeText}>3</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.84}
          onPress={onProfilePress}
          style={[styles.profileButton, createShadow(palette, 1), { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Image source={gogoMark} style={styles.profileImage} resizeMode="cover" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function HomeExperienceScreen() {
  const { palette } = useSkin()
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const { activeClub: club, clubsLoaded } = useClub()
  const { name: myName, userId } = useUserProfile()
  const { dashboard, loading, refresh } = useHomeDashboard({ clubId: club?.id, userName: myName, userId })

  const recentStats = useMemo(
    () => applyStatNavigation(dashboard.stats.items, nav),
    [dashboard.stats.items, nav],
  )

  const heroActions = useMemo(() => [
    { key: 'caddie-book', icon: '📖', label: '캐디북', onPress: (round: HomeHeroRound) => nav.navigate('CaddieBook', caddieBookHeroParams(round)) },
    { key: 'groups', icon: '👥', label: '조편성', onPress: () => nav.navigate('RoundSchedulePrototype') },
    { key: 'lotto', icon: '🎲', label: 'Lotto', onPress: () => nav.navigate('RoundSchedulePrototype') },
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
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 8) + 10 }]}> 
      <View style={styles.content}>
        <HeaderBar
          clubName={club?.name || 'GogoPar'}
          loading={loading}
          onClubPress={() => nav.navigate('Main', { screen: 'Club' })}
          onNoticePress={() => nav.navigate('NoticePrototype')}
          onProfilePress={() => nav.navigate('Profile')}
        />

        <PremiumHomeMotion index={0}>
          <PremiumHomeHeroSection
            greeting=""
            userName={myName || '골퍼'}
            clubName={club?.name || 'GogoPar'}
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
          />
        </PremiumHomeMotion>

        <PremiumHomeMotion index={1}>
          <PremiumGogoCaddieCard
            userName={myName || '골퍼'}
            courseName={dashboard.aiCaddie.courseName}
            teeTime={dashboard.aiCaddie.teeTime}
            averageScore={dashboard.aiCaddie.averageScore}
            hasUpcomingRound={dashboard.aiCaddie.hasUpcomingRound}
            message={dashboard.aiCaddie.message}
            recommendedClub={dashboard.aiCaddie.recommendedClub}
            onPress={() => nav.navigate('CaddieBook', caddieBookParams(dashboard.upcomingRound))}
            onCaddieBookPress={() => nav.navigate('CaddieBook', caddieBookParams(dashboard.upcomingRound))}
            onGroupsPress={() => nav.navigate('RoundSchedulePrototype')}
            onLottoPress={() => nav.navigate('RoundSchedulePrototype')}
          />
        </PremiumHomeMotion>

        <PremiumHomeMotion index={2}>
          <PremiumRecentStatsSection stats={recentStats} />
        </PremiumHomeMotion>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  headerRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: 10,
  },
  clubPill: {
    flex: 1,
    maxWidth: 220,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 17,
    borderRadius: 24,
    borderWidth: 1,
  },
  clubIcon: { fontSize: 20 },
  clubText: { flex: 1, fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.5 },
  clubArrow: { fontSize: 18, lineHeight: 20, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeIcon: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -3,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: { width: 58, height: 58 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  clubButton: { marginTop: 16 },
  emptyRoundIcon: { fontSize: 34, marginBottom: 10 },
  emptyRoundTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  emptyRoundText: { fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
})
