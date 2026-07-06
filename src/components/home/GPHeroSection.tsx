import { ImageBackground, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
import type { RoundWeather } from '../../lib/weather'

export type GPHeroSectionProps = {
  heroImage: ImageSourcePropType
  greeting: string
  courseName: string
  courseLocation?: string
  hasUpcomingRound: boolean
  ddayText?: string
  roundDateText?: string
  teeTimeText?: string
  courseLayoutName?: string
  weather?: RoundWeather | null
}

function compactDate(date?: string) {
  if (!date || date.length < 10) return ''
  const d = new Date(date.slice(0, 10))
  const days = ['일', '월', '화', '수', '목', '금', '토']
  if (Number.isNaN(d.getTime())) return date
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

export function GPHeroSection({
  heroImage,
  greeting,
  courseName,
  courseLocation,
  hasUpcomingRound,
  ddayText,
  roundDateText,
  teeTimeText,
  courseLayoutName,
  weather,
}: GPHeroSectionProps) {
  const dateLabel = compactDate(roundDateText)
  const weatherLabel = weather ? `${weather.icon} ${weather.tempC}°` : '⛳ Golf day'
  const weatherSub = weather?.condition ?? (hasUpcomingRound ? '라운드 준비' : '오늘의 추천')
  const ddayLabel = hasUpcomingRound ? (ddayText || 'D-Day') : '추천'
  const timeLabel = hasUpcomingRound
    ? [courseLayoutName, teeTimeText].filter(Boolean).join(' · ')
    : '새 라운드를 등록해보세요'

  return (
    <ImageBackground source={heroImage} style={styles.hero} imageStyle={styles.image} resizeMode="cover">
      <View style={styles.gradient} />
      <View style={styles.content}>
        <View style={styles.topLine}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.tagline}>{hasUpcomingRound ? '오늘도 버디를 향해!' : '새로운 추억을 준비해볼까요?'}</Text>
          </View>
          <View style={styles.ddayPill}>
            <Text style={styles.ddayText}>{ddayLabel}</Text>
          </View>
        </View>

        <View style={styles.bottomBlock}>
          <Text style={styles.courseName} numberOfLines={1}>{courseName}</Text>
          {!!courseLocation && <Text style={styles.location} numberOfLines={1}>📍 {courseLocation}</Text>}
          <View style={styles.infoRow}>
            <View style={styles.weatherBlock}>
              <Text style={styles.weatherMain}>{weatherLabel}</Text>
              <Text style={styles.weatherSub}>{weatherSub}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.timeBlock}>
              {!!dateLabel && <Text style={styles.dateText}>{dateLabel}</Text>}
              <Text style={styles.teeText} numberOfLines={1}>{timeLabel}</Text>
            </View>
          </View>
        </View>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  hero: {
    height: 252,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#153d28',
    shadowColor: '#123a26',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  image: { borderRadius: 28 },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  topLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  greeting: { color: '#fff', fontSize: 25, fontWeight: '900', letterSpacing: -0.6 },
  tagline: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '800', marginTop: 4 },
  ddayPill: {
    minWidth: 64,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
  },
  ddayText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  bottomBlock: {},
  courseName: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1.3, marginBottom: 4 },
  location: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  weatherBlock: { minWidth: 90 },
  weatherMain: { color: '#fff', fontSize: 22, fontWeight: '900' },
  weatherSub: { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '700', marginTop: 3 },
  separator: { width: 1, height: 44, backgroundColor: 'rgba(255,255,255,0.45)' },
  timeBlock: { flex: 1 },
  dateText: { color: '#fff', fontSize: 15, fontWeight: '900', marginBottom: 4 },
  teeText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800' },
})
