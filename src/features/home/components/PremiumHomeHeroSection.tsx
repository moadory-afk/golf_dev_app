import { ImageBackground, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useState } from 'react'

import { colorLayers, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'
import type { HomeHeroRound } from '../types/home'

const defaultHeroImage = require('../../../../assets/course-heroes/bomun-hero-v2.png')

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
  rounds,
  fallbackCourseName,
  fallbackAddress,
  fallbackWeatherText,
  fallbackTemperature,
  fallbackDday,
  fallbackRoundDate,
  fallbackTeeTime,
  isAdmin = false,
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
    <View style={[styles.heroShell, { backgroundColor: palette.card, borderColor: palette.border }]}> 
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
                  backgroundColor: index === activeIndex ? palette.headerText : colorLayers.heroGlassStrong,
                  opacity: index === activeIndex ? 1 : 0.55,
                },
              ]}
            />
          ))}
        </View>
      </ImageBackground>
    </View>
  )
}

function HeroRoundCard({ width, round }: { width: number; round: HomeHeroRound }) {
  const { palette } = useSkin()
  const layoutText = round.layoutName ? `${round.layoutName} 코스` : ''

  return (
    <View style={[styles.slide, { width }]}> 
      <View style={styles.topArea}>
        <View style={[styles.ddayPill, { backgroundColor: palette.green }]}> 
          <Text style={styles.ddayText}>{round.dday}</Text>
        </View>

        <View style={styles.titleRow}>
          <Text style={[styles.courseName, { color: palette.headerText }]} numberOfLines={1}>{round.courseName}</Text>
          {!!layoutText && <Text style={styles.layoutName} numberOfLines={1}>{layoutText}</Text>}
        </View>

        <View style={styles.metaRow}>
          <HeroMeta icon="📅" text={round.dateLabel} />
          <HeroMeta icon="◷" text={`${round.teeTime} Tee Off`} />
          <HeroMeta icon="👥" text={`${round.memberCount || 0}명`} />
        </View>
      </View>

      <View style={styles.infoStrip}>
        <HeroInfo icon="☀️" value={round.temperature} label={round.weatherText} accent="weather" />
        <HeroInfo icon="〰️" value={round.windText || '2m/s'} label="바람" />
        <HeroInfo icon="🚗" value={round.routeTimeText} label="예상 소요시간" />
        <HeroInfo icon="◷" value={round.departureTimeText} label="출발 추천" accent="green" />
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
      <View style={styles.topArea}>
        <View style={[styles.ddayPill, { backgroundColor: colorLayers.heroGlass, borderColor: colorLayers.heroGlassStrong, borderWidth: 1 }]}> 
          <Text style={styles.ddayText}>{dday}</Text>
        </View>
        <Text style={[styles.courseName, { color: palette.headerText }]} numberOfLines={1}>{courseName}</Text>
        <Text style={styles.emptyGuideText} numberOfLines={2}>📍 {address}</Text>
      </View>

      <View style={styles.infoStrip}>
        <HeroInfo icon="☀️" value={temperature} label={weatherText} accent="weather" />
        <HeroInfo icon="〰️" value="--" label="바람" />
        <HeroInfo icon="🚗" value="--" label="예상 소요시간" />
        <HeroInfo icon="◷" value={teeTime || roundDate} label="출발 추천" accent="green" />
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
        <Text style={[styles.createTitle, { color: palette.headerText }]}>새 라운딩 등록</Text>
        <Text style={styles.createSubtitle}>다음 일정을 등록하고 홈에서 바로 확인하세요.</Text>
      </TouchableOpacity>
    </View>
  )
}

function HeroMeta({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaText} numberOfLines={1}>{icon} {text}</Text>
    </View>
  )
}

function HeroInfo({ icon, value, label, accent }: { icon: string; value: string; label: string; accent?: 'green' | 'weather' }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoTextBlock}>
        <Text style={[styles.infoValue, accent === 'green' && styles.infoValueGreen]} numberOfLines={1}>{value}</Text>
        <Text style={styles.infoLabel} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  heroShell: {
    height: 310,
    borderWidth: 1,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 10,
  },
  heroImage: {
    flex: 1,
  },
  heroImageRadius: {
    borderRadius: 28,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  carousel: { flex: 1 },
  carouselContent: { alignItems: 'stretch' },
  slide: {
    height: 310,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  topArea: { flexShrink: 1 },
  ddayPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 20,
  },
  ddayText: { color: '#fff', fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: -0.4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, minWidth: 0 },
  courseName: {
    flexShrink: 1,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    letterSpacing: -2.0,
  },
  layoutName: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 6,
    marginTop: 14,
  },
  metaItem: { flexShrink: 1 },
  metaText: { color: '#fff', fontSize: 15, lineHeight: 19, fontWeight: '900', letterSpacing: -0.4 },
  infoStrip: {
    minHeight: 72,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  infoItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.22)',
  },
  infoIcon: { fontSize: 24, lineHeight: 28 },
  infoTextBlock: { minWidth: 0, alignItems: 'flex-start' },
  infoValue: { color: '#fff', fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.7 },
  infoValueGreen: { color: '#57D16F' },
  infoLabel: { color: 'rgba(255,255,255,0.88)', fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 2 },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  emptyGuideText: { color: colorLayers.heroTextMuted, fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 8 },
  emptyCreateButton: {
    borderWidth: 1.5,
    borderRadius: radius.xl,
    borderStyle: 'dashed',
    backgroundColor: colorLayers.heroGlass,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  emptyCreateText: { color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '900' },
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
  createIcon: { color: '#fff', fontSize: 52, lineHeight: 58, fontWeight: '900' },
  createTitle: { fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -1.0, marginTop: spacing.md },
  createSubtitle: { color: colorLayers.heroTextMuted, fontSize: 14, lineHeight: 20, fontWeight: '800', textAlign: 'center', marginTop: spacing.sm },
})
