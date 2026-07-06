import { Image, ImageBackground, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useState } from 'react'

import { colorLayers, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'
import type { HomeHeroRound } from '../types/home'

const defaultHeroImage = require('../../../../assets/course-heroes/bomun-hero-v2.png')
const gogoMark = require('../../../../assets/gogopar_i.png')

type HeroAction = {
  key: string
  icon: string
  label: string
  onPress: (round: HomeHeroRound) => void
}

type PremiumHomeHeroSectionProps = {
  greeting: string
  userName: string
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
  onCreateRound: () => void
  actions: HeroAction[]
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
  onCreateRound,
}: PremiumHomeHeroSectionProps) {
  const { palette } = useSkin()
  const { width } = useWindowDimensions()
  const [activeIndex, setActiveIndex] = useState(0)
  const heroWidth = width - 40
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
          <TouchableOpacity activeOpacity={0.84} onPress={onNotificationPress} style={[styles.circleButton, { backgroundColor: palette.card, borderColor: palette.border }]}> 
            <Text style={styles.bellText}>🔔</Text>
            <View style={[styles.badge, { backgroundColor: palette.danger }]}> 
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.84} style={[styles.profileButton, { backgroundColor: palette.card, borderColor: palette.border }]}> 
            <Image source={gogoMark} style={styles.profileImage} resizeMode="cover" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.heroCard, { borderRadius: palette.cardRadius + 12 }]}> 
        <ImageBackground source={defaultHeroImage} style={styles.heroImage} imageStyle={styles.heroImageRadius} resizeMode="cover">
          <View style={styles.scrim} />
          <ScrollView
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            style={styles.carousel}
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

          <View style={styles.dotsRow} pointerEvents="none">
            {dots.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === activeIndex ? palette.text : 'rgba(255,255,255,0.48)',
                    width: index === activeIndex ? 9 : 7,
                    height: index === activeIndex ? 9 : 7,
                  },
                ]}
              />
            ))}
          </View>
        </ImageBackground>
      </View>
      <View style={[styles.heroWave, { backgroundColor: palette.bg }]} pointerEvents="none" />
    </View>
  )
}

function HeroRoundCard({ width, round }: { width: number; round: HomeHeroRound }) {
  const { palette } = useSkin()

  return (
    <View style={[styles.slide, { width }]}> 
      <View style={styles.courseBlock}>
        <View style={[styles.ddayPill, { backgroundColor: palette.green }]}> 
          <Text style={styles.ddayText}>{round.dday}</Text>
        </View>
        <View style={styles.titleRow}>
          <Text style={[styles.courseName, { color: palette.text }]} numberOfLines={1}>{round.courseName}</Text>
          {!!round.layoutName && <Text style={styles.layoutName} numberOfLines={1}>{round.layoutName} 코스</Text>}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>🗓 {round.dateLabel}</Text>
          <Text style={styles.metaText} numberOfLines={1}>◷ {round.teeTime || '--:--'} Tee Off</Text>
          <Text style={styles.metaText} numberOfLines={1}>👥 {round.memberCount}명</Text>
        </View>
      </View>

      <View style={styles.infoStrip}>
        <HeroInfo icon="☀️" value={round.temperature} label={round.weatherText} />
        <HeroInfo icon="🌬" value={round.windText || '2m/s'} label="풍속" />
        <HeroInfo icon="🚗" value={round.routeTimeText} label="이동" />
        <HeroInfo icon="🕒" value={round.departureTimeText} label="출발추천" accent />
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
  const { palette } = useSkin()

  return (
    <View style={[styles.slide, { width }]}> 
      <View style={styles.courseBlock}>
        <View style={[styles.ddayPill, { backgroundColor: palette.green }]}> 
          <Text style={styles.ddayText}>{dday}</Text>
        </View>
        <Text style={[styles.courseName, { color: palette.text }]} numberOfLines={1}>{courseName}</Text>
        <Text style={styles.emptyAddress} numberOfLines={2}>📍 {address}</Text>
      </View>

      <View style={styles.infoStrip}>
        <HeroInfo icon="☀️" value={temperature} label={weatherText} />
        <HeroInfo icon="🌬" value="--" label="풍속" />
        <HeroInfo icon="🚗" value="--" label="이동" />
        <HeroInfo icon="🕒" value={teeTime || roundDate} label="출발추천" accent />
      </View>

      {isAdmin && (
        <TouchableOpacity activeOpacity={0.88} onPress={onCreateRound} style={[styles.emptyCreateButton, { borderColor: palette.gold }]}> 
          <Text style={styles.emptyCreateText}>＋ 새 라운딩 등록</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function HeroCreateRoundCard({ width, onCreateRound }: { width: number; onCreateRound: () => void }) {
  const { palette } = useSkin()

  return (
    <View style={[styles.slide, { width }]}> 
      <TouchableOpacity activeOpacity={0.9} onPress={onCreateRound} style={[styles.createCard, { borderColor: palette.gold }]}> 
        <Text style={styles.createIcon}>＋</Text>
        <Text style={[styles.createTitle, { color: palette.text }]}>새 라운딩 등록</Text>
        <Text style={styles.createSubtitle}>다음 일정을 등록하고 참가자를 모집하세요.</Text>
      </TouchableOpacity>
    </View>
  )
}

function HeroInfo({ icon, value, label, accent = false }: { icon: string; value: string; label: string; accent?: boolean }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoTextWrap}>
        <Text style={[styles.infoValue, accent && styles.infoAccent]} numberOfLines={1}>{value}</Text>
        <Text style={styles.infoLabel} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    marginBottom: 0,
  },
  headerRow: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clubPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '58%',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  clubIcon: { fontSize: 19 },
  clubText: { flex: 1, fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.6 },
  clubArrow: { fontSize: 18, lineHeight: 18, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bellText: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -3,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  profileButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  profileImage: { width: 62, height: 62 },
  heroCard: {
    height: 420,
    overflow: 'hidden',
  },
  heroImage: { flex: 1 },
  heroImageRadius: { borderRadius: radius.xxl },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  carousel: { flex: 1 },
  slide: {
    height: 420,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: 56,
    justifyContent: 'space-between',
  },
  courseBlock: { flex: 1, justifyContent: 'center' },
  ddayPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  ddayText: { color: '#fff', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, maxWidth: '100%' },
  courseName: {
    maxWidth: '72%',
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    letterSpacing: -2.0,
  },
  layoutName: { color: '#fff', fontSize: 20, lineHeight: 30, fontWeight: '900', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  metaText: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  emptyAddress: { color: colorLayers.heroTextMuted, fontSize: 14, lineHeight: 20, fontWeight: '800', marginTop: spacing.sm },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    paddingTop: spacing.md,
  },
  infoItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.20)',
  },
  infoIcon: { fontSize: 22 },
  infoTextWrap: { minWidth: 0, alignItems: 'center' },
  infoValue: { color: '#fff', fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.5 },
  infoAccent: { color: '#45C26B' },
  infoLabel: { color: '#fff', opacity: 0.9, fontSize: 10, lineHeight: 13, fontWeight: '900' },
  dotsRow: { position: 'absolute', left: 0, right: 0, bottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  dot: { borderRadius: radius.pill },
  heroWave: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: -36,
    height: 72,
    borderTopLeftRadius: 260,
    borderTopRightRadius: 260,
  },
  emptyCreateButton: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.xl,
    borderStyle: 'dashed',
    backgroundColor: colorLayers.heroGlass,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  emptyCreateText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  createCard: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.xxl,
    backgroundColor: colorLayers.heroGlass,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  createIcon: { color: '#fff', fontSize: 56, lineHeight: 62, fontWeight: '900' },
  createTitle: { fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -1.0, marginTop: spacing.md },
  createSubtitle: { color: '#fff', opacity: 0.8, fontSize: 14, lineHeight: 20, fontWeight: '800', textAlign: 'center', marginTop: spacing.sm },
})
