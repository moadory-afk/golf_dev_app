import { Image, ImageSourcePropType, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useState } from 'react'

import { colorLayers, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'
import type { HomeHeroRound } from '../types/home'

const gogoMark = require('../../../../assets/gogopar_i.png')

const HERO_DISPLAY_ASPECT_RATIO = 16 / (10.5 * 1.5)
const HERO_DISPLAY_HEIGHT_RATIO = (10.5 / 16) * 1.5
const HERO_MIN_WIDTH = 280

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
  topInset?: number
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
  topInset = 0,
}: PremiumHomeHeroSectionProps) {
  const { palette } = useSkin()
  const { width: windowWidth } = useWindowDimensions()
  const [activeIndex, setActiveIndex] = useState(0)
  const [measuredHeroWidth, setMeasuredHeroWidth] = useState(0)
  const fallbackHeroWidth = Math.max(HERO_MIN_WIDTH, windowWidth)
  const heroWidth = measuredHeroWidth || fallbackHeroWidth
  const heroHeight = Math.round(heroWidth * HERO_DISPLAY_HEIGHT_RATIO + topInset)
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
        style={[styles.heroCard, { height: heroHeight }]}
      > 
        <View style={styles.heroImage}>
          {heroImageSource ? <Image source={heroImageSource} style={styles.heroBackgroundImage} resizeMode="cover" /> : null}
          <View style={styles.scrim} />
          <View style={[styles.headerRow, { top: topInset + 10 }]} pointerEvents="box-none">
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
              <HeroRoundCard key={round.id} width={heroWidth} height={heroHeight} topInset={topInset} round={round} />
            )) : (
              <HeroEmptyCard
                width={heroWidth}
                height={heroHeight}
                topInset={topInset}
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
              <HeroCreateRoundCard width={heroWidth} height={heroHeight} topInset={topInset} onCreateRound={onCreateRound} />
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

function HeroRoundCard({ width, height, topInset, round }: { width: number; height: number; topInset: number; round: HomeHeroRound }) {
  const summaryWidth = getSummaryPanelWidth(width)
  const frontCourseLabel = getFrontCourseLabel(round.layoutName)

  return (
    <View style={[styles.slide, { width, height, paddingTop: topInset + 52 }]}> 
      <View style={styles.slideSpacer} />

      <View style={[styles.summaryPanel, { width: summaryWidth }]}>
        <Text style={styles.summaryTitle} numberOfLines={1}>{round.courseName}</Text>

        <View style={styles.summaryContentRow}>
          <View style={styles.weatherSummary}>
            <Text style={styles.weatherIcon}>☀️</Text>
            <View style={styles.weatherTextGroup}>
              <Text style={styles.temperatureText} numberOfLines={1}>{round.temperature}</Text>
              <View style={styles.windSummaryRow}>
                <Text style={styles.windIcon}>🌬</Text>
                <Text style={styles.windSpeedText} numberOfLines={1}>{formatWindText(round.windText)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.scheduleSummary}>
            <Text style={styles.summaryDday} numberOfLines={1}>{round.dday}</Text>
            <Text style={styles.scheduleText} numberOfLines={1}>🗓 {round.dateLabel}</Text>
            <Text style={styles.scheduleText} numberOfLines={1}>◷ {frontCourseLabel} {round.teeTime || '--:--'} Tee Off</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function getSummaryPanelWidth(width: number) {
  return Math.min(width - 28, Math.max(width * 0.58, 286))
}

function getFrontCourseLabel(layoutName?: string) {
  if (!layoutName) return 'IN 코스'
  return layoutName.includes('코스') ? layoutName : `${layoutName} 코스`
}

function formatWindText(windText?: string) {
  if (!windText || windText.trim().length === 0) return '-- m/s'
  return windText.includes('m/s') ? windText : `${windText} m/s`
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
  topInset,
}: {
  width: number
  height: number
  topInset: number
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
  const summaryWidth = getSummaryPanelWidth(width)
  void weatherText

  return (
    <View style={[styles.slide, { width, height, paddingTop: topInset + 52 }]}> 
      <View style={styles.slideSpacer}>
        {isAdmin && (
          <TouchableOpacity activeOpacity={0.88} onPress={onCreateRound} style={[styles.emptyCreateButton, { borderColor: palette.gold }]}> 
            <Text style={styles.emptyCreateText}>＋ 새 라운딩 등록</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.summaryPanel, { width: summaryWidth }]}>
        <Text style={styles.summaryTitle} numberOfLines={1}>{courseName}</Text>
        {!!address && <Text style={styles.emptyAddress} numberOfLines={1}>📍 {address}</Text>}

        <View style={styles.summaryContentRow}>
          <View style={styles.weatherSummary}>
            <Text style={styles.weatherIcon}>☀️</Text>
            <View style={styles.weatherTextGroup}>
              <Text style={styles.temperatureText} numberOfLines={1}>{temperature}</Text>
              <View style={styles.windSummaryRow}>
                <Text style={styles.windIcon}>🌬</Text>
                <Text style={styles.windSpeedText} numberOfLines={1}>-- m/s</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.scheduleSummary}>
            <Text style={styles.summaryDday} numberOfLines={1}>{dday}</Text>
            <Text style={styles.scheduleText} numberOfLines={1}>🗓 {roundDate}</Text>
            <Text style={styles.scheduleText} numberOfLines={1}>◷ {teeTime || '--:--'} Tee Off</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function HeroCreateRoundCard({ width, height, topInset, onCreateRound }: { width: number; height: number; topInset: number; onCreateRound: () => void }) {
  const { palette } = useSkin()

  return (
    <View style={[styles.slide, { width, height, paddingTop: topInset + 52 }]}> 
      <TouchableOpacity activeOpacity={0.9} onPress={onCreateRound} style={[styles.createCard, { borderColor: palette.gold }]}> 
        <Text style={styles.createIcon}>＋</Text>
        <Text style={[styles.createTitle, { color: palette.text }]}>새 라운딩 등록</Text>
        <Text style={styles.createSubtitle}>다음 일정을 등록하고 참가자를 모집하세요.</Text>
      </TouchableOpacity>
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
    overflow: 'hidden',
    borderRadius: 0,
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
    paddingBottom: 26,
    justifyContent: 'space-between',
  },
  slideSpacer: { flex: 1 },
  summaryPanel: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0,0,0,0.32)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  emptyAddress: { color: colorLayers.heroTextMuted, fontSize: 12, lineHeight: 16, fontWeight: '800', marginTop: 2, marginBottom: 5 },
  summaryContentRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.34)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 9,
  },
  weatherIcon: { fontSize: 35, lineHeight: 39 },
  weatherTextGroup: { minWidth: 0 },
  temperatureText: { color: '#fff', fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -1.1 },
  windSummaryRow: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  windIcon: { color: '#fff', opacity: 0.86, fontSize: 12, lineHeight: 14 },
  windSpeedText: { color: '#fff', opacity: 0.94, fontSize: 12, lineHeight: 15, fontWeight: '900', letterSpacing: -0.25 },
  summaryDivider: {
    width: 1,
    height: 54,
    backgroundColor: 'rgba(255,255,255,0.42)',
    marginHorizontal: 9,
  },
  scheduleSummary: { flex: 1.28, minWidth: 0 },
  summaryDday: { color: '#B6FF87', fontSize: 25, lineHeight: 29, fontWeight: '900', letterSpacing: -0.9 },
  scheduleText: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '900', letterSpacing: -0.35 },
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
