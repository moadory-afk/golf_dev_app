import { useMemo } from 'react'
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
import { useClub } from '../lib/ClubContext'
import { useUserProfile } from '../lib/UserProfileContext'
import type { RootStackParamList } from '../navigation/types'
import {
  PremiumGogoCaddieCard,
  PremiumHomeHeroSection,
  PremiumHomeMotion,
  PremiumQuickMenuSection,
  PremiumRecentStatsSection,
  PremiumUpcomingRoundCard,
  type PremiumQuickMenuItem,
  type PremiumRecentStatItem,
} from '../features/home/components'
import { useHomeDashboard } from '../features/home/hooks/useHomeDashboard'
import type { HomeRecentRound, HomeUpcomingRound } from '../features/home/types/home'

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

function timeGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return '좋은 아침입니다'
  if (hour < 17) return '좋은 오후입니다'
  return '좋은 저녁입니다'
}

function applyStatNavigation(stats: PremiumRecentStatItem[], nav: Nav): PremiumRecentStatItem[] {
  return stats.map((item) => ({
    ...item,
    onPress: () => nav.navigate('Main', { screen: 'History' }),
  }))
}

function RecentRoundList({ rounds, onOpenHistory }: { rounds: HomeRecentRound[]; onOpenHistory: () => void }) {
  const { palette } = useSkin()

  return (
    <GPCard style={styles.recentCard}>
      {rounds.length === 0 ? (
        <View style={styles.emptyRecentBox}>
          <Text style={[styles.emptyRoundText, { color: palette.muted }]}>아직 등록된 라운드 기록이 없습니다.</Text>
        </View>
      ) : rounds.map((round, index) => (
        <View key={round.id} style={[styles.recentRow, index < rounds.length - 1 && { borderBottomColor: palette.border, borderBottomWidth: 1 }]}> 
          <View style={styles.recentInfo}>
            <Text style={[styles.recentCourse, { color: palette.text }]} numberOfLines={1}>{round.courseName}</Text>
            <Text style={[styles.recentDate, { color: palette.muted }]}>{round.dateLabel}</Text>
          </View>
          <View style={styles.recentScoreWrap}>
            <Text style={[styles.recentScore, { color: palette.text }]}>{round.total ?? '-'}</Text>
            <Text style={[styles.recentDiff, { color: palette.muted }]}>{round.diff}</Text>
          </View>
        </View>
      ))}
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

  const recentStats = useMemo(
    () => applyStatNavigation(dashboard.stats.items, nav),
    [dashboard.stats.items, nav],
  )

  const quickActions: PremiumQuickMenuItem[] = useMemo(() => [
    { key: 'round-record', icon: 'edit', title: '라운드 기록', subtitle: '스코어 입력', featured: true, onPress: () => nav.navigate('RoundSetup', {}) },
    { key: 'caddie-book', icon: 'target', title: '캐디북', subtitle: '홀별 공략', badge: 'AI', featured: true, onPress: () => nav.navigate('CaddieBook', caddieBookParams(dashboard.upcomingRound)) },
    { key: 'score-stats', icon: 'chart', title: '스코어 통계', subtitle: '최근 기록', onPress: () => nav.navigate('Main', { screen: 'History' }) },
    { key: 'club-board', icon: 'mail', title: '클럽 게시판', subtitle: '공지 확인', onPress: () => nav.navigate('NoticePrototype') },
    { key: 'club-friends', icon: 'users', title: '친구/동호회', subtitle: '멤버 관리', onPress: () => nav.navigate('Main', { screen: 'Club' }) },
    { key: 'club-skin', icon: 'settings', title: '동호회 스킨', subtitle: '테마 설정', badge: 'Skin', onPress: () => nav.navigate('Profile') },
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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 34 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.green} />}
        showsVerticalScrollIndicator={false}
      >
        <PremiumHomeMotion index={0}>
          <PremiumHomeHeroSection
            greeting={timeGreeting()}
            userName={myName || '골퍼'}
            clubName={club?.name || 'GogoPar Club'}
            courseName={dashboard.hero.courseName}
            address={dashboard.hero.address}
            weatherText={dashboard.hero.weatherText}
            temperature={dashboard.hero.temperature}
            dday={dashboard.hero.dday}
            roundDate={dashboard.hero.roundDate}
            teeTime={dashboard.hero.teeTime}
            totalCount={dashboard.hero.totalCount}
            onClubPress={() => nav.navigate('Main', { screen: 'Club' })}
            onNotificationPress={() => nav.navigate('NoticePrototype')}
          />
        </PremiumHomeMotion>

        {!!error && (
          <PremiumHomeMotion index={1}>
            <HomeErrorCard message={error} onRetry={refresh} />
          </PremiumHomeMotion>
        )}

        <PremiumHomeMotion index={2}>
          <GPSection title="테마">
            <ThemeSelectorCompact />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={3}>
          <GPSection title="Quick Menu">
            <PremiumQuickMenuSection items={quickActions} />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={4}>
          <GPSection title="Upcoming Round" right={loading ? <ActivityIndicator color={palette.green} /> : null}>
            <PremiumUpcomingRoundCard
              empty={!dashboard.upcomingRound}
              statusLabel={dashboard.upcomingRound?.statusLabel || '예정'}
              courseName={dashboard.upcomingRound?.courseName || '다음 라운드'}
              layoutName={dashboard.upcomingRound?.layoutName}
              dateLabel={dashboard.upcomingRound?.dateLabel || '일정 미정'}
              teeTime={dashboard.upcomingRound?.teeTime || '시간 미정'}
              memberCount={dashboard.upcomingRound?.memberCount ?? 0}
              weatherText={dashboard.upcomingRound?.weatherText || '준비중'}
              temperature={dashboard.upcomingRound?.temperature || '--°'}
              onCreate={() => nav.navigate('RoundSchedulePrototype', { openCreate: true })}
              onPress={() => nav.navigate('RoundSchedulePrototype')}
              actions={[
                { key: 'caddie-book', icon: '📗', label: '캐디북', onPress: () => nav.navigate('CaddieBook', caddieBookParams(dashboard.upcomingRound)) },
                { key: 'groups', icon: '👥', label: '조편성', onPress: () => nav.navigate('RoundSchedulePrototype') },
                { key: 'lotto', icon: '🎱', label: 'Lotto 6/18', onPress: () => nav.navigate('RoundSchedulePrototype') },
              ]}
            />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={5}>
          <GPSection title="AI Caddie">
            <PremiumGogoCaddieCard
              courseName={dashboard.aiCaddie.courseName}
              teeTime={dashboard.aiCaddie.teeTime}
              dday={dashboard.aiCaddie.dday}
              averageScore={dashboard.aiCaddie.averageScore}
              hasUpcomingRound={dashboard.aiCaddie.hasUpcomingRound}
              title={dashboard.aiCaddie.title}
              message={dashboard.aiCaddie.message}
              primaryChip={dashboard.aiCaddie.primaryChip}
              secondaryChip={dashboard.aiCaddie.secondaryChip}
              hasLiveAdvice={dashboard.aiCaddie.hasLiveAdvice}
              onPress={() => nav.navigate('CaddieBook', caddieBookParams(dashboard.upcomingRound))}
            />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={6}>
          <GPSection title="Recent Stats">
            <PremiumRecentStatsSection stats={recentStats} />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={7}>
          <GPSection title="최근 라운드">
            <RecentRoundList rounds={dashboard.stats.recentRounds} onOpenHistory={() => nav.navigate('Main', { screen: 'History' })} />
          </GPSection>
        </PremiumHomeMotion>

        <PremiumHomeMotion index={8}>
          <GPSection title="Community">
            <GPCard style={styles.communityCard}>
              <Text style={[styles.communityTitle, { color: palette.text }]}>함께 치면 더 즐거운 라운드</Text>
              <Text style={[styles.communityText, { color: palette.muted }]}>클럽 공지, 회비, 대회, 친구 활동을 하나의 흐름으로 연결할 예정입니다.</Text>
              <GPButton label="클럽 관리" variant="soft" onPress={() => nav.navigate('Main', { screen: 'Club' })} style={styles.communityButton} />
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
  clubButton: { marginTop: 16 },
  emptyRoundIcon: { fontSize: 34, marginBottom: 10 },
  emptyRoundTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  emptyRoundText: { fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  recentCard: { padding: 4 },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  recentInfo: { flex: 1 },
  recentCourse: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  recentDate: { fontSize: 12, fontWeight: '700' },
  recentScoreWrap: { alignItems: 'flex-end' },
  recentScore: { fontSize: 22, fontWeight: '900' },
  recentDiff: { fontSize: 12, fontWeight: '800' },
  emptyRecentBox: { padding: 18, alignItems: 'center' },
  moreButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  moreText: { fontSize: 13, fontWeight: '900' },
  communityCard: { padding: 18 },
  communityTitle: { fontSize: 17, fontWeight: '900', marginBottom: 7 },
  communityText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  communityButton: { marginTop: 14 },
  themeScroll: { gap: 8, paddingRight: 20 },
  themeChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
  themeChipText: { fontSize: 12, fontWeight: '900' },
  errorCard: { alignItems: 'center', padding: 18, marginBottom: 4 },
  errorIcon: { fontSize: 28, marginBottom: 8 },
  errorTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  errorMessage: { fontSize: 13, fontWeight: '600', lineHeight: 19, textAlign: 'center' },
  errorButton: { marginTop: 14 },
})
