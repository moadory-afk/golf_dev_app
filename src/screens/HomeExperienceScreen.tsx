import { useCallback, useMemo, useState } from 'react'
import {
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  PremiumRecordExtrasSection,
  type PremiumRecentStatItem,
} from '../features/home/components'
import { useHomeDashboard } from '../features/home/hooks/useHomeDashboard'
import type { HomeHeroRound, HomeUpcomingRound } from '../features/home/types/home'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COURSE_HERO_STORAGE_KEY, getCourseHeroAssetByKey, getCourseHeroImageSource } from '../data/courseHeroImages'
import { HomeLayoutRenderer, premiumGolfHomeLayout } from '../features/home/layout'
import { getRoundSchedules, type ScheduledRound } from '../lib/roundSchedule'

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

function groupLines(round?: ScheduledRound | null) {
  if (!round) return []
  return round.groups
    .filter((group) => group.members.length > 0)
    .map((group) => ({
      id: group.id,
      title: `${group.name}${group.time ? ` · ${group.time}` : ''}`,
      members: group.members.map((member) => member.name).join(' · ') || '편성 멤버 없음',
      course: [group.frontLayoutName, group.backLayoutName].filter(Boolean).join(' / '),
    }))
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
  const [roundPopupMode, setRoundPopupMode] = useState<'groups' | 'lotto' | null>(null)
  const [popupRound, setPopupRound] = useState<ScheduledRound | null>(null)
  const [popupLoading, setPopupLoading] = useState(false)

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

  const openRoundPopup = useCallback(async (round: HomeHeroRound, mode: 'groups' | 'lotto') => {
    setRoundPopupMode(mode)
    setPopupRound(null)
    if (!club?.id) return
    setPopupLoading(true)
    try {
      const schedules = await getRoundSchedules(club.id)
      setPopupRound(schedules.find((item) => item.id === round.id) ?? null)
    } catch {
      setPopupRound(null)
    } finally {
      setPopupLoading(false)
    }
  }, [club?.id])

  const recentStats = useMemo(
    () => applyStatNavigation(dashboard.stats.items, nav),
    [dashboard.stats.items, nav],
  )

  const heroActions = useMemo(() => [
    { key: 'caddie-map', icon: '🗺️', label: '캐디맵', onPress: (round: HomeHeroRound) => nav.navigate('CaddieBook', caddieBookHeroParams(round)) },
    { key: 'groups', icon: '👥', label: '조편성', onPress: (round: HomeHeroRound) => openRoundPopup(round, 'groups') },
    { key: 'lotto', icon: '🎲', label: 'Lotto', onPress: (round: HomeHeroRound) => openRoundPopup(round, 'lotto') },
  ], [nav, openRoundPopup])

  const caddieQuickActions = useMemo(() => {
    const primaryRound = dashboard.hero.rounds[0]
    if (!primaryRound) return []
    return heroActions.map((action) => ({
      key: action.key,
      icon: action.icon,
      title: action.label,
      subtitle: primaryRound.courseName,
      onPress: () => action.onPress(primaryRound),
    }))
  }, [dashboard.hero.rounds, heroActions])


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
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
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
                  onCreateRound={() => nav.navigate('RoundSchedulePrototype', { openCreate: true })}
                  heroImageSource={activeHeroImageSource}
                  topInset={insets.top}
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
                  actions={caddieQuickActions}
                  onPress={() => resolveFeedNavigation(nav, dashboard.feed.actionType, dashboard.upcomingRound)}
                />
              </PremiumHomeMotion>
            ),
            stats: recentStats.length > 0 ? (
              <PremiumHomeMotion index={3}>
                <PremiumRecentStatsSection stats={recentStats} />
              </PremiumHomeMotion>
            ) : null,
            recordExtras: (
              <PremiumHomeMotion index={4}>
                <PremiumRecordExtrasSection />
              </PremiumHomeMotion>
            ),
          }}
        />
      </ScrollView>


      <RoundInfoModal
        visible={roundPopupMode !== null}
        mode={roundPopupMode}
        round={popupRound}
        loading={popupLoading}
        onClose={() => setRoundPopupMode(null)}
        onManage={() => {
          const editScheduleId = popupRound?.id
          setRoundPopupMode(null)
          nav.navigate('RoundSchedulePrototype', editScheduleId ? { editScheduleId, modalOnly: true } : undefined)
        }}
      />
    </View>
  )
}


function RoundInfoModal({
  visible,
  mode,
  round,
  loading,
  onClose,
  onManage,
}: {
  visible: boolean
  mode: 'groups' | 'lotto' | null
  round: ScheduledRound | null
  loading: boolean
  onClose: () => void
  onManage: () => void
}) {
  const { palette } = useSkin()
  const groups = groupLines(round)
  const isGroups = mode === 'groups'

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>{isGroups ? '조편성 결과' : 'Lotto 구매 및 결과'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose} activeOpacity={0.8}>
              <Text style={styles.modalCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalSubTitle, { color: palette.muted }]} numberOfLines={2}>
            {round ? `${round.courseName ?? '골프장 미정'} · ${round.date} ${round.time || ''}` : '선택된 라운드 정보를 불러옵니다'}
          </Text>

          {loading ? (
            <Text style={[styles.modalEmpty, { color: palette.muted }]}>불러오는 중입니다.</Text>
          ) : isGroups ? (
            groups.length > 0 ? groups.map((group) => (
              <View key={group.id} style={[styles.groupRow, { borderColor: palette.border }]}>
                <Text style={[styles.groupTitle, { color: palette.text }]}>{group.title}</Text>
                {!!group.course && <Text style={[styles.groupCourse, { color: palette.muted }]}>{group.course}</Text>}
                <Text style={[styles.groupMembers, { color: palette.text }]}>{group.members}</Text>
              </View>
            )) : (
              <Text style={[styles.modalEmpty, { color: palette.muted }]}>아직 실제 조편성 결과가 없습니다.</Text>
            )
          ) : (
            <View style={[styles.groupRow, { borderColor: palette.border }]}>
              <Text style={[styles.groupTitle, { color: palette.text }]}>Lotto 6/18</Text>
              <Text style={[styles.groupCourse, { color: palette.muted }]}>선택된 라운드 기준으로 구매와 결과 확인을 진행합니다.</Text>
              <Text style={[styles.groupMembers, { color: palette.text }]}>구매/결과 상세 관리는 아래 버튼에서 이어서 확인하세요.</Text>
            </View>
          )}

          <TouchableOpacity activeOpacity={0.86} onPress={onManage} style={[styles.modalAction, { backgroundColor: palette.green }]}>
            <Text style={styles.modalActionText}>{isGroups ? '조편성 관리로 이동' : 'Lotto 구매/결과 확인'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 0, paddingTop: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  clubButton: { marginTop: 16 },
  emptyRoundIcon: { fontSize: 34, marginBottom: 10 },
  emptyRoundTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  emptyRoundText: { fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  clubPickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', paddingTop: 76, paddingHorizontal: 18 },
  clubPickerCard: { borderRadius: 24, padding: 16 },
  clubPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  clubPickerTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.6 },
  clubPickerRow: { minHeight: 58, borderWidth: 1, borderRadius: 17, paddingHorizontal: 13, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  clubPickerIcon: { fontSize: 19, lineHeight: 22 },
  clubPickerTextWrap: { flex: 1, minWidth: 0 },
  clubPickerName: { fontSize: 15, lineHeight: 20, fontWeight: '900', letterSpacing: -0.35 },
  clubPickerSubtitle: { fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 1 },
  clubPickerSelected: { fontSize: 11, lineHeight: 15, fontWeight: '900' },
  clubManageButton: { minHeight: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  clubManageButtonText: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 24, padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.7 },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 24, lineHeight: 28, fontWeight: '900' },
  modalSubTitle: { marginTop: 4, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  modalEmpty: { paddingVertical: 28, textAlign: 'center', fontSize: 13, lineHeight: 19, fontWeight: '800' },
  groupRow: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12 },
  groupTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  groupCourse: { marginTop: 4, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  groupMembers: { marginTop: 8, fontSize: 14, lineHeight: 20, fontWeight: '900' },
  modalAction: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  modalActionText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  errorCard: { alignItems: 'center', padding: 18, marginBottom: 4 },
  errorIcon: { fontSize: 28, marginBottom: 8 },
  errorTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  errorMessage: { fontSize: 13, fontWeight: '600', lineHeight: 19, textAlign: 'center' },
  errorButton: { marginTop: 14 },
})
