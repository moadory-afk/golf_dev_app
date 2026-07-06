import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colorLayers, radius, spacing, typography } from '../../../design/tokens'
import { useSkin } from '../../../skins'

const defaultHeroImage = require('../../../../assets/course-heroes/bomun-hero-v2.png')

type PremiumHomeHeroSectionProps = {
  greeting: string
  userName: string
  clubName: string
  courseName: string
  address: string
  weatherText: string
  temperature: string
  dday: string
  roundDate: string
  teeTime: string
  activeIndex?: number
  totalCount?: number
  onClubPress: () => void
  onNotificationPress: () => void
}

export function PremiumHomeHeroSection({
  greeting,
  userName,
  clubName,
  courseName,
  address,
  weatherText,
  temperature,
  dday,
  roundDate,
  teeTime,
  activeIndex = 0,
  totalCount = 3,
  onClubPress,
  onNotificationPress,
}: PremiumHomeHeroSectionProps) {
  const { palette } = useSkin()
  const dots = Array.from({ length: Math.max(1, totalCount) })

  return (
    <View style={[styles.heroShell, { backgroundColor: palette.headerBg }]}> 
      <ImageBackground source={defaultHeroImage} style={styles.heroImage} imageStyle={styles.heroImageRadius} resizeMode="cover">
        <View style={styles.scrim} />
        <View style={styles.heroContent}>
          <View style={styles.topRow}>
            <View style={styles.identityBlock}>
              <Text style={[styles.greeting, { color: palette.headerText }]} numberOfLines={1}>
                {greeting}, {userName}님 👋
              </Text>
              <TouchableOpacity activeOpacity={0.84} onPress={onClubPress} style={[styles.clubPill, { backgroundColor: colorLayers.heroGlass, borderColor: colorLayers.heroGlassStrong }]}> 
                <Text style={styles.clubIcon}>⛳</Text>
                <Text style={[styles.clubText, { color: palette.headerText }]} numberOfLines={1}>{clubName}</Text>
                <Text style={[styles.clubArrow, { color: palette.headerText }]}>⌄</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity activeOpacity={0.84} onPress={onNotificationPress} style={[styles.bellButton, { backgroundColor: colorLayers.heroGlass }]}> 
              <Text style={styles.bellText}>🔔</Text>
              <View style={[styles.badge, { backgroundColor: palette.danger }]}> 
                <Text style={styles.badgeText}>3</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.courseBlock}>
            <Text style={[styles.courseName, { color: palette.headerText }]} numberOfLines={1}>{courseName}</Text>
            <Text style={[styles.address, { color: colorLayers.heroTextMuted }]} numberOfLines={1}>📍 {address}</Text>
          </View>

          <View style={styles.infoRow}>
            <HeroInfo icon="☀️" value={temperature} label={weatherText} />
            <View style={styles.divider} />
            <HeroInfo value={dday || 'D-DAY'} label={roundDate} />
            <View style={styles.divider} />
            <HeroInfo icon="◷" value={teeTime || '--:--'} label="Tee Off" />
          </View>

          <View style={styles.dotsRow}>
            {dots.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === activeIndex ? palette.headerText : colorLayers.heroGlassStrong,
                    width: index === activeIndex ? 9 : 7,
                    height: index === activeIndex ? 9 : 7,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </ImageBackground>
    </View>
  )
}

function HeroInfo({ icon, value, label }: { icon?: string; value: string; label: string }) {
  return (
    <View style={styles.infoItem}>
      <View style={styles.infoValueRow}>
        {!!icon && <Text style={styles.infoIcon}>{icon}</Text>}
        <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
      </View>
      <Text style={styles.infoLabel} numberOfLines={1}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  heroShell: {
    marginHorizontal: -20,
    marginTop: -18,
    marginBottom: spacing.xl,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    overflow: 'hidden',
  },
  heroImage: {
    minHeight: 520,
  },
  heroImageRadius: {
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colorLayers.heroScrim,
  },
  heroContent: {
    flex: 1,
    minHeight: 520,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  identityBlock: { flex: 1 },
  greeting: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  clubPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  clubIcon: { fontSize: 18 },
  clubText: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  clubArrow: { fontSize: 18, lineHeight: 18, fontWeight: '900' },
  bellButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellText: { fontSize: 25 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 23,
    height: 23,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  courseBlock: { marginTop: 'auto', marginBottom: spacing.xl },
  courseName: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '900',
    letterSpacing: -2.6,
  },
  address: {
    marginTop: spacing.sm,
    ...typography.bodyLg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoItem: { flex: 1, alignItems: 'center' },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  infoIcon: { fontSize: 34, lineHeight: 40 },
  infoValue: { color: '#fff', fontSize: 32, lineHeight: 40, fontWeight: '900', letterSpacing: -1.1 },
  infoLabel: { color: colorLayers.heroTextMuted, marginTop: spacing.xs, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  divider: { width: 1, height: 48, backgroundColor: colorLayers.heroGlassStrong },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xl },
  dot: { borderRadius: radius.pill },
})
