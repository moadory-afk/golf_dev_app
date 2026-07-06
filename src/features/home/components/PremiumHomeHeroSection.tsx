import { Image, ImageSourcePropType, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useState } from 'react'

import { colorLayers, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'
import type { HomeHeroRound } from '../types/home'

const gogoMark = require('../../../../assets/gogopar_i.png')

const HERO_DISPLAY_ASPECT_RATIO = 16 / (10.5 * 1.5)
const HERO_DISPLAY_HEIGHT_RATIO = (10.5 / 16) * 1.5
const HERO_MIN_WIDTH = 280
const HERO_MAX_WIDTH = 430

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
  onProfilePress?: () => void
  onCreateRound: () => void
  heroImageSource?: ImageSourcePropType
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
  heroImageSource,
}: PremiumHomeHeroSectionProps) {
  const { palette } = useSkin()
  const { width: windowWidth } = useWindowDimensions()
  const [activeIndex, setActiveIndex] = useState(0)
  const [measuredHeroWidth, setMeasuredHeroWidth] = useState(0)
  const fallbackHeroWidth = Math.max(HERO_MIN_WIDTH, Math.min(windowWidth - 40, HERO_MAX_WIDTH))
  const heroWidth = measuredHeroWidth || fallbackHeroWidth
  const heroHeight = Math.round(heroWidth * HERO_DISPLAY_HEIGHT_RATIO)
  const hasRounds = rounds.length > 0
  const totalCount = Math.max(1, rounds.length + (isAdmin ? 1 : 0))
  const dots = Array.from({ length: totalCount })

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / heroWidth)
    setActiveIndex(Math.max(0, Math.min(index, totalCount - 1)))
  }

  return (
    <View style={styles.shell}>
      <View
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width)
          if (nextWidth > 0 && nextWidth !== measuredHeroWidth) setMeasuredHeroWidth(nextWidth)
        }}
        style={[styles.heroCard, { borderRadius: palette.cardRadius + 12 }]}
      > 
        <View style={styles.heroImage}>
          {heroImageSource ? <Image source={heroImageSource} style={styles.heroBackgroundImage} resizeMode="cover" /> : null}
          <View style={styles.scrim} />
          <View style={styles.headerRow} pointerEvents="box-none">
            <TouchableOpacity activeOpacity={0.84} onPress={onClubPress} style={styles.clubPill}> 
              <Text style={styles.clubIcon}>⛳</Text>
              <Text style={styles.clubText} numberOfLines={1}>{clubName}</Text>
              <Text style={styles.clubArrow}>⌄</Text>
            </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity activeOpacity={0.84} onPress={onNotificationPress} style={styles.circleButton}> 
                <Text style={styles.bellText}>🔔</Text>
                <View style={[styles.badge, { backgroundColor: palette.danger }]}> 
                  <Text style={styles.badgeText}>3</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.84} onPress={onProfilePress} style={styles.profileButton}> 
                <Image source={gogoMark} style={styles.profileImage} resizeMode="cover" />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            style={styles.carousel}
          >
            {hasRounds ? rounds.map((round) => (
              <HeroRoundCard key={round.id} width={heroWidth} height={heroHeight} round={round} />
            )) : (
              <HeroEmptyCard
                width={heroWidth}
                height={heroHeight}
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
              <HeroCreateRoundCard width={heroWidth} height={heroHeight} onCreateRound={onCreateRound} />
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
        </View>
      </View>
      <View style={[styles.heroWave, { backgroundColor: palette.bg }]} pointerEvents="none" />
    </View>
  )
}

function HeroRoundCard({ width, height, round }: { width: number; height: number; round: HomeHeroRound }) {
  const { palette } = useSkin()

  return (
    <View style={[styles.slide, { width, height }]}> 
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

      <View>
        <View style={styles.infoStrip}>
          <HeroInfo icon="☀️" value={round.temperature} label={round.weatherText} />
          <HeroInfo icon="🌬" value={round.windText || '2m/s'} label="풍속" />
          <HeroInfo icon="🚗" value={round.routeTimeText} label="이동" />
          <HeroInfo icon="🕒" value={round.departureTimeText} label="출발추천" accent />
        </View>
      </View>
    </View>
  )
}

function HeroEmptyCard({
  width,
  height,
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
  height: number
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
    <View style={[styles.slide, { width, height }]}> 
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

function HeroCreateRoundCard({ width, height, onCreateRound }: { width: number; height: number; onCreateRound: () => void }) {
  const { palette } = useSkin()

  return (
    <View style={[styles.slide, { width, height }]}> 
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
    width: '100%',
  },
  headerRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clubPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '44%',
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  clubIcon: { fontSize: 12 },
  clubText: { flex: 1, color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: -0.3 },
  clubArrow: { color: '#fff', fontSize: 12, lineHeight: 12, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  circleButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  bellText: { fontSize: 17 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  profileButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  profileImage: { width: 32, height: 32 },
  heroCard: {
    width: '100%',
    aspectRatio: HERO_DISPLAY_ASPECT_RATIO,
    overflow: 'hidden',
  },
  heroImage: { flex: 1, backgroundColor: '#10261B' },
  heroBackgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  carousel: { flex: 1 },
  slide: {
    paddingHorizontal: 14,
    paddingTop: 52,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  courseBlock: { flex: 1, justifyContent: 'center', paddingTop: 4, paddingBottom: 6 },
  ddayPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 4,
    marginBottom: 6,
  },
  ddayText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, maxWidth: '100%' },
  courseName: {
    maxWidth: '72%',
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  layoutName: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '900', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaText: { color: '#fff', fontSize: 10, lineHeight: 14, fontWeight: '900' },
  emptyAddress: { color: colorLayers.heroTextMuted, fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: spacing.xs },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    paddingTop: 7,
  },
  infoItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.20)',
  },
  infoIcon: { fontSize: 14 },
  infoTextWrap: { minWidth: 0, alignItems: 'center' },
  infoValue: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '900', letterSpacing: -0.4 },
  infoAccent: { color: '#45C26B' },
  infoLabel: { color: '#fff', opacity: 0.9, fontSize: 8, lineHeight: 10, fontWeight: '900' },
  dotsRow: { position: 'absolute', left: 0, right: 0, bottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  dot: { borderRadius: radius.pill },
  heroWave: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: -22,
    height: 44,
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
  createIcon: { color: '#fff', fontSize: 42, lineHeight: 46, fontWeight: '900' },
  createTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.8, marginTop: spacing.sm },
  createSubtitle: { color: '#fff', opacity: 0.8, fontSize: 12, lineHeight: 17, fontWeight: '800', textAlign: 'center', marginTop: spacing.xs },
})
