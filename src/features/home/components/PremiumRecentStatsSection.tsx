import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { createShadow, radius, spacing, typography } from '../../../design/tokens'
import { useSkin } from '../../../skins'

type TrendPoint = 'up' | 'down' | 'flat'

export type PremiumRecentStatItem = {
  key: string
  icon: string
  label: string
  value: string
  suffix?: string
  caption: string
  tone?: 'primary' | 'gold' | 'info' | 'success'
  trend?: TrendPoint[]
  onPress?: () => void
}

type PremiumRecentStatsSectionProps = {
  stats: PremiumRecentStatItem[]
}

const defaultTrend: TrendPoint[] = ['flat', 'up', 'down', 'flat', 'up']

export function PremiumRecentStatsSection({ stats }: PremiumRecentStatsSectionProps) {
  return (
    <View style={styles.grid}>
      {stats.map((stat) => (
        <PremiumStatCard key={stat.key} stat={stat} />
      ))}
    </View>
  )
}

function PremiumStatCard({ stat }: { stat: PremiumRecentStatItem }) {
  const { palette } = useSkin()
  const accent = stat.tone === 'gold'
    ? palette.gold
    : stat.tone === 'info'
      ? palette.info
      : palette.green
  const trend = stat.trend?.length ? stat.trend : defaultTrend

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={!stat.onPress}
      onPress={stat.onPress}
      style={[
        styles.card,
        createShadow(palette, 1),
        { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 8 },
      ]}
    >
      <View style={[styles.iconBadge, { backgroundColor: palette.greenLight }]}> 
        <Text style={styles.icon}>{stat.icon}</Text>
      </View>

      <Text style={[styles.label, { color: palette.green }]} numberOfLines={1}>{stat.label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accent }]} numberOfLines={1}>{stat.value}</Text>
        {!!stat.suffix && <Text style={[styles.suffix, { color: accent }]}>{stat.suffix}</Text>}
      </View>
      <Text style={[styles.caption, { color: palette.muted }]} numberOfLines={1}>{stat.caption}</Text>

      <View style={styles.trendRow}>
        {trend.map((point, index) => (
          <View
            key={`${stat.key}-${index}`}
            style={[
              styles.trendSegment,
              {
                backgroundColor: point === 'down' ? palette.border : accent,
                opacity: point === 'flat' ? 0.58 : 1,
                height: point === 'up' ? 4 : point === 'down' ? 2 : 3,
              },
            ]}
          />
        ))}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: '48%',
    minHeight: 152,
    borderWidth: 1,
    padding: spacing.lg,
  },
  iconBadge: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  icon: { fontSize: 20 },
  label: { ...typography.bodySm, marginBottom: spacing.xs },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', minHeight: 41 },
  value: { fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -1.2 },
  suffix: { fontSize: 18, lineHeight: 30, fontWeight: '900', marginLeft: spacing.xxs },
  caption: { ...typography.bodySm, marginTop: spacing.xs },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginTop: 'auto',
    paddingTop: spacing.md,
  },
  trendSegment: {
    flex: 1,
    borderRadius: radius.pill,
  },
})
