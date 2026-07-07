import { Image, ImageSourcePropType, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useState } from 'react'

import { colorLayers, radius, spacing } from '../../../design/tokens'
import { getCourseHeroImageSource } from '../../../data/courseHeroImages'
import { useSkin } from '../../../skins'
import type { HomeHeroRound } from '../types/home'

const gogoMark = require('../../../../assets/gogopar_i.png')

const HERO_DISPLAY_HEIGHT_RATIO = (10.5 / 16) * 1.5 * 0.85
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
                heroImageSource={heroImageSource}
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
    </View>
  )
}

function HeroRoundCard({ width, height, topInset, round }: { width: number; height: number; topInset: number; round: HomeHeroRound }) {
  const roundHeroImageSource = getCourseHeroImageSource(round.courseName)

  return (
    <View style={[styles.slide, { width, height, paddingTop: topInset + 52 }]}> 
      <Image source={roundHeroImageSource} style={styles.slideBackgroundImage} resizeMode="cover" />
      <View style={styles.scrim} />
      <HeroBottomSummary
        courseName={round.courseName}
        temperature={round.temperature}
        windText={round.windText || '--'}
        dday={round.dday}
        dateLabel={round.dateLabel}
        teeTime={round.teeTime}
        groupCount={round.groupCount}
        routeTimeText={round.routeTimeText}
      />
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
  topInset,
  heroImageSource,
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
  heroImageSource?: ImageSourcePropType
}) {
  const { palette } = useSkin()
  void address
  void weatherText

  return (
    <View style={[styles.slide, { width, height, paddingTop: topInset + 52 }]}> 
      {heroImageSource ? <Image source={heroImageSource} style={styles.slideBackgroundImage} resizeMode="cover" /> : null}
      <View style={styles.scrim} />
      <HeroBottomSummary
        courseName={courseName}
        temperature={temperature}
        windText="--"
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
  temperature,
  windText,
  dday,
  dateLabel,
  teeTime,
  groupCount,
  routeTimeText,
}: {
  courseName: string
  temperature: string
  windText: string
  dday: string
  dateLabel: string
  teeTime?: string
  groupCount?: number
  routeTimeText?: string
}) {
  const scheduleLine = teeTime ? `${teeTime} Tee Off${groupCount ? ` (${groupCount}조)` : ''}` : '--:-- Tee Off'
  const travelTimeText = routeTimeText && !routeTimeText.includes('준비중') ? routeTimeText : '50분 소요'

  return (
    <View style={styles.bottomSummary}>
      <Text style={styles.summaryCourseName} numberOfLines={1}>{courseName}</Text>
      <View style={styles.summaryContentRow}>
        <View style={styles.weatherSummary}>
          <Text style={styles.summaryWeatherIcon}>☀️</Text>
          <View style={styles.weatherTextWrap}>
            <Text style={styles.summaryTemperature} numberOfLines={1}>{temperature}</Text>
            <View style={styles.windRow}>
              <Text style={styles.windIcon}>🌬</Text>
              <Text style={styles.summaryWindText} numberOfLines={1}>{windText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.scheduleSummary}>
          <View style={styles.scheduleTopRow}>
            <Text style={styles.summaryDday} numberOfLines={1}>{dday}</Text>
            <View style={styles.travelSummary}>
              <Text style={styles.travelLabel} numberOfLines={1}>지금 출발시</Text>
              <Text style={styles.travelTime} numberOfLines={1}>{travelTimeText}</Text>
            </View>
          </View>
          <Text style={styles.summaryDate} numberOfLines={1}>🗓 {dateLabel}</Text>
          <Text style={styles.summaryTeeTime} numberOfLines={1}>◷ {scheduleLine}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    marginBottom: 0,
    width: '100%',
    overflow: 'visible',
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
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 56,
  },
  heroImage: { flex: 1, backgroundColor: '#10261B', overflow: 'hidden' },
  heroBackgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  slideBackgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  carousel: { flex: 1 },
  slide: {
    paddingHorizontal: 14,
    paddingBottom: 22,
    overflow: 'hidden',
    justifyContent: 'flex-end',
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
  bottomSummary: {
    width: '76%',
    minWidth: 292,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.26)',
    paddingTop: 8,
  },
  summaryCourseName: { color: '#fff', fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -0.8, marginBottom: 8 },
  summaryContentRow: { flexDirection: 'row', alignItems: 'stretch' },
  weatherSummary: { flex: 1.35, minWidth: 116, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 10 },
  summaryWeatherIcon: { fontSize: 29, lineHeight: 34 },
  weatherTextWrap: { flex: 1, minWidth: 0 },
  summaryTemperature: { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.6 },
  windRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  windIcon: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 14 },
  summaryWindText: { flex: 1, color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 16, fontWeight: '900', letterSpacing: -0.25 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.44)', marginHorizontal: 9 },
  scheduleSummary: { flex: 1.75, minWidth: 174, paddingLeft: 2 },
  scheduleTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  summaryDday: { color: '#B6FF8F', fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -0.5 },
  travelSummary: { alignItems: 'flex-start', justifyContent: 'flex-start', paddingTop: 1, minWidth: 70 },
  travelLabel: { color: '#fff', fontSize: 12, lineHeight: 15, fontWeight: '900', letterSpacing: -0.3 },
  travelTime: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '900', letterSpacing: -0.3, marginTop: 1 },
  summaryDate: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '900', marginTop: 2 },
  summaryTeeTime: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '900', marginTop: 1, letterSpacing: -0.45 },
  dotsRow: { position: 'absolute', left: 0, right: 0, bottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  dot: { borderRadius: radius.pill },
  heroWave: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 1,
    opacity: 0,
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
