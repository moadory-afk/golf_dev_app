import { Image, ImageSourcePropType, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useState } from 'react'

import { colorLayers, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'
import type { HomeHeroRound } from '../types/home'

const gogoMark = require('../../../../assets/gogopar_i.png')

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
  return (
    <View style={[styles.slide, { width, height, paddingTop: topInset + 52 }]}> 
      <View style={styles.heroSpacer} />

      <HeroBottomSummary
        courseName={round.courseName}
        weatherText={round.weatherText}
        temperature={round.temperature}
        dday={round.dday}
        dateLabel={round.dateLabel}
        layoutName={round.layoutName}
        teeTime={round.teeTime}
      />
    </View>
  )
}

function HeroEmptyCard({
  width,
  height,
  courseName,
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
    <View style={[styles.slide, { width, height, paddingTop: topInset + 52 }]}> 
      <View style={styles.heroSpacer} />

      <HeroBottomSummary
        courseName={courseName}
        weatherText={weatherText}
        temperature={temperature}
        dday={dday}
        dateLabel={roundDate}
        teeTime={teeTime}
      />

      {isAdmin && (
        <TouchableOpacity activeOpacity={0.88} onPress={onCreateRound} style={[styles.emptyCreateButton, { borderColor: palette.gold }]}> 
          <Text style={styles.emptyCreateText}>＋ 새 라운딩 등록</Text>
        </TouchableOpacity>
      )}
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

function HeroBottomSummary({
  courseName,
  weatherText,
  temperature,
  dday,
  dateLabel,
  layoutName,
  teeTime,
}: {
  courseName: string
  weatherText: string
  temperature: string
  dday: string
  dateLabel: string
  layoutName?: string
  teeTime?: string
}) {
  return (
    <View style={styles.bottomSummaryPanel}>
      <Text style={styles.bottomCourseTitle} numberOfLines={1}>{courseName}</Text>
      <View style={styles.bottomSummaryRow}>
        <View style={styles.bottomWeatherColumn}>
          <Text style={styles.bottomWeatherIcon}>☀️</Text>
          <View style={styles.bottomWeatherTextWrap}>
            <Text style={styles.bottomTemperature} numberOfLines={1}>{temperature}</Text>
            <Text style={styles.bottomWeatherText} numberOfLines={1}>{weatherText}</Text>
          </View>
        </View>
        <View style={styles.bottomDivider} />
        <View style={styles.bottomScheduleColumn}>
          <Text style={styles.bottomDday} numberOfLines={1}>{dday}</Text>
          <Text style={styles.bottomScheduleText} numberOfLines={1}>🗓 {dateLabel}</Text>
          <Text style={styles.bottomScheduleText} numberOfLines={1}>◷ {layoutName ? `${layoutName} 코스 ` : ''}{teeTime || '--:--'} Tee Off</Text>
        </View>
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
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  heroSpacer: { flex: 1 },
  bottomSummaryPanel: {
    width: '52%',
    minWidth: 178,
    paddingBottom: 4,
  },
  bottomCourseTitle: {
    color: '#fff',
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -1.6,
    textShadowColor: 'rgba(0,0,0,0.34)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  bottomSummaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.48)',
  },
  bottomWeatherColumn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  bottomWeatherIcon: {
    fontSize: 26,
    lineHeight: 30,
    marginRight: 6,
  },
  bottomWeatherTextWrap: { flex: 1, minWidth: 0 },
  bottomTemperature: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  bottomWeatherText: {
    color: 'rgba(255,255,255,0.90)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  bottomDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.50)',
    marginHorizontal: 10,
  },
  bottomScheduleColumn: { flex: 1, minWidth: 0, justifyContent: 'center' },
  bottomDday: {
    color: '#B8FF8C',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  bottomScheduleText: {
    color: '#fff',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
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
