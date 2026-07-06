import { Image, ImageBackground, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useState } from 'react'

import { colorLayers, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'
import type { HomeHeroRound } from '../types/home'

const defaultHeroImage = require('../../../../assets/course-heroes/bomun-hero-v2.png')
const profileMark = require('../../../../assets/gogopar_i.png')

type HeroAction = {
  key: string
  icon: string
  label: string
  onPress: (round: HomeHeroRound) => void
}

type PremiumHomeHeroSectionProps = {
  clubName: string
  rounds: HomeHeroRound[]
  fallbackCourseName: string
  fallbackAddress: string
  fallbackWeatherText: string
  fallbackTemperature: string
  fallbackDday: string
  fallbackRoundDate: string
  fallbackTeeTime: string
  isAdmin?: boolean
  onClubPress: () => void
  onNotificationPress: () => void
  onProfilePress?: () => void
  onCreateRound: () => void
  actions: HeroAction[]
}

function splitCourseName(courseName: string, layoutName?: string) {
  return {
    title: courseName || 'GogoPar',
    layout: layoutName ? `${layoutName} 코스` : undefined,
  }
}

function safeInfo(value?: string | null, fallback = '--') {
  const normalized = value?.trim()
  if (!normalized || normalized.includes('준비중') || normalized.includes('등록 후')) return fallback
  return normalized
}

export function PremiumHomeHeroSection({
  clubName,
  rounds,
  fallbackCourseName,
  fallbackAddress,
  fallbackWeatherText,
  fallbackTemperature,
  fallbackDday,
  fallbackRoundDate,
  fallbackTeeTime,
  isAdmin = false,
  onClubPress,
  onNotificationPress,
  onProfilePress,
  onCreateRound,
}: PremiumHomeHeroSectionProps) {
  const { palette } = useSkin()
  const { width } = useWindowDimensions()
  const [activeIndex, setActiveIndex] = useState(0)
  const heroWidth = Math.max(280, width - 40)
  const hasRounds = rounds.length > 0
  const totalCount = Math.max(1, rounds.length + (isAdmin ? 1 : 0))
  const dots = Array.from({ length: totalCount })

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / heroWidth)
    setActiveIndex(Math.max(0, Math.min(index, totalCount - 1)))
  }

  return (
    <View style={styles.shell}>
      <View style={styles.headerRow}>
        <TouchableOpacity activeOpacity={0.84} onPress={onClubPress} style={[styles.clubPill, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <Text style={styles.clubIcon}>⛳</Text>
          <Text style={[styles.clubText, { color: palette.text }]} numberOfLines={1}>{clubName}</Text>
          <Text style={[styles.clubArrow, { color: palette.text }]}>⌄</Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity activeOpacity={0.84} onPress={onNotificationPress} style={[styles.iconButton, { backgroundColor: palette.card, borderColor: palette.border }]}> 
            <Text style={styles.bellText}>🔔</Text>
            <View style={[styles.badge, { backgroundColor: palette.danger }]}> 
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.84} onPress={onProfilePress} style={[styles.profileButton, { backgroundColor: palette.card, borderColor: palette.border }]}> 
            <Image source={profileMark} style={styles.profileImage} resizeMode="cover" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.heroCard}> 
        <ImageBackground source={defaultHeroImage} style={styles.heroImage} imageStyle={styles.heroImageRadius} resizeMode="cover">
          <View style={styles.scrim} />
          <ScrollView
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
          >
            {hasRounds ? rounds.map((round) => (
              <HeroRoundCard key={round.id} width={heroWidth} round={round} />
            )) : (
              <HeroEmptyCard
                width={heroWidth}
                courseName={fallbackCourseName}
                address={fallbackAddress}
                weatherText={fallbackWeatherText}
                temperature={fallbackTemperature}
                dday={fallbackDday}
                roundDate={fallbackRoundDate}
                teeTime={fallbackTeeTime}
                isAdmin={isAdmin}
                onCreateRound={onCreateRound}
              />
            )}

            {isAdmin && hasRounds && (
              <HeroCreateRoundCard width={heroWidth} onCreateRound={onCreateRound} />
            )}
          </ScrollView>

          <View style={styles.dotsRow}>
            {dots.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === activeIndex ? '#111827' : 'rgba(255,255,255,0.35)',
                  },
                ]}
              />
            ))}
          </View>
        </ImageBackground>
      </View>
    </View>
  )
}

function HeroRoundCard({ width, round }: { width: number; round: HomeHeroRound }) {
  const { title, layout } = splitCourseName(round.courseName, round.layoutName)
  const weather = safeInfo(round.temperature, '--°')
  const wind = safeInfo(round.windText, '2m/s')
  const route = safeInfo(round.routeTimeText, '48분')
  const departure = safeInfo(round.departureTimeText, '10:55')

  return (
    <View style={[styles.slide, { width }]}> 
      <View style={styles.courseBlock}>
        <View style={styles.statusPill}> 
          <Text style={styles.statusText}>{round.dday}</Text>
        </View>

        <View style={styles.courseTitleRow}>
          <Text style={styles.courseName} numberOfLines={1}>{title}</Text>
          {!!layout && <Text style={styles.layoutName} numberOfLines={1}>{layout}</Text>}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>🗓️ {round.dateLabel}</Text>
          <Text style={styles.metaText} numberOfLines={1}>◷ {round.teeTime || '--:--'} Tee Off</Text>
          <Text style={styles.metaText} numberOfLines={1}>👥 {round.memberCount}명</Text>
        </View>
      </View>

      <View style={styles.infoStrip}>
        <HeroInfo icon="☀️" value={weather} label={round.weatherText} />
        <HeroInfo icon="💨" value={wind} label="바람" />
        <HeroInfo icon="🚗" value={route} label="예상 소요" />
        <HeroInfo icon="🕒" value={departure} label="출발 추천" accent />
      </View>
    </View>
  )
}

function HeroEmptyCard({
  width,
  courseName,
  address,
  weatherText,
  temperature,
  dday,
  roundDate,
  teeTime,
  isAdmin,
  onCreateRound,
}: {
  width: number
  courseName: string
  address: string
  weatherText: string
  temperature: string
  dday: string
  roundDate: string
  teeTime: string
  isAdmin: boolean
  onCreateRound: () => void
}) {
  return (
    <View style={[styles.slide, { width }]}> 
      <View style={styles.courseBlock}>
        <View style={styles.statusPill}> 
          <Text style={styles.statusText}>{dday}</Text>
        </View>
        <Text style={styles.courseName} numberOfLines={1}>{courseName}</Text>
        <Text style={styles.emptyGuideText} numberOfLines={2}>📍 {address}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>🗓️ {roundDate}</Text>
          <Text style={styles.metaText}>◷ {teeTime} Tee Off</Text>
        </View>
      </View>

      <View style={styles.infoStrip}>
        <HeroInfo icon="☀️" value={temperature} label={weatherText} />
        <HeroInfo icon="💨" value="2m/s" label="바람" />
        <HeroInfo icon="🚗" value="48분" label="예상 소요" />
        <HeroInfo icon="🕒" value="--:--" label="출발 추천" accent />
      </View>

      {isAdmin && (
        <TouchableOpacity activeOpacity={0.88} onPress={onCreateRound} style={styles.emptyCreateButton}> 
          <Text style={styles.emptyCreateText}>＋ 새 라운딩 등록</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function HeroCreateRoundCard({ width, onCreateRound }: { width: number; onCreateRound: () => void }) {
  return (
    <View style={[styles.slide, { width }]}> 
      <TouchableOpacity activeOpacity={0.9} onPress={onCreateRound} style={styles.createCard}> 
        <Text style={styles.createIcon}>＋</Text>
        <Text style={styles.createTitle}>새 라운딩 등록</Text>
        <Text style={styles.createSubtitle}>다음 일정을 등록하고 참가자를 모집하세요.</Text>
      </TouchableOpacity>
    </View>
  )
}

function HeroInfo({ icon, value, label, accent = false }: { icon: string; value: string; label: string; accent?: boolean }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoCopy}>
        <Text style={[styles.infoValue, accent && styles.infoValueAccent]} numberOfLines={1}>{value}</Text>
        <Text style={[styles.infoLabel, accent && styles.infoLabelAccent]} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    gap: 12,
  },
  headerRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  clubPill: {
    maxWidth: '58%',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  clubIcon: { fontSize: 18 },
  clubText: { flexShrink: 1, fontSize: 17, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3 },
  clubArrow: { fontSize: 16, lineHeight: 18, fontWeight: '900', marginLeft: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellText: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: -3,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: { width: 48, height: 48 },
  heroCard: {
    height: 292,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#0F2418',
  },
  heroImage: { flex: 1 },
  heroImageRadius: { borderRadius: 32 },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  carousel: { flex: 1 },
  carouselContent: { alignItems: 'stretch' },
  slide: {
    minHeight: 266,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  courseBlock: { gap: 9 },
  statusPill: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: radius.pill,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#218F5A',
  },
  statusText: { color: '#fff', fontSize: 15, lineHeight: 19, fontWeight: '900', letterSpacing: -0.3 },
  courseTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  courseName: {
    flexShrink: 1,
    color: '#111827',
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -2.0,
    textShadowColor: 'rgba(255,255,255,0.18)',
    textShadowRadius: 1,
  },
  layoutName: { color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '900', marginBottom: 5 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  infoStrip: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(0,0,0,0.14)',
    marginHorizontal: -22,
    marginBottom: -48,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.22)',
  },
  infoIcon: { fontSize: 16 },
  infoCopy: { minWidth: 0, alignItems: 'flex-start' },
  infoValue: { color: '#fff', fontSize: 16, lineHeight: 20, fontWeight: '900', letterSpacing: -0.8 },
  infoLabel: { color: 'rgba(255,255,255,0.86)', fontSize: 8, lineHeight: 10, fontWeight: '800', marginTop: 2 },
  infoValueAccent: { color: '#56C777' },
  infoLabelAccent: { color: '#56C777' },
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  emptyGuideText: { color: 'rgba(255,255,255,0.86)', fontSize: 14, lineHeight: 20, fontWeight: '800' },
  emptyCreateButton: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  emptyCreateText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  createCard: {
    minHeight: 260,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.62)',
    borderRadius: 28,
    backgroundColor: colorLayers.heroGlass,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  createIcon: { color: '#fff', fontSize: 54, lineHeight: 60, fontWeight: '900' },
  createTitle: { color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -1.0, marginTop: 10 },
  createSubtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 19, fontWeight: '800', textAlign: 'center', marginTop: 8 },
})
