import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { createShadow, radius, spacing } from '../../../design/tokens'
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
const shortLabels: Record<string, string> = {
  handicap: '핸디캡',
  average: '평균',
  recent: '최근',
  best: '베스트',
}

function normalizeValue(value: string) {
  if (!value || value === '-') return '-'
  const numeric = Number(String(value).replace(/[+타,\s]/g, ''))
  if (!Number.isFinite(numeric)) return value.replace(/타/g, '')
  const rounded = Math.ceil(numeric)
  return value.trim().startsWith('+') ? `+${rounded}` : `${rounded}`
}

export function PremiumRecentStatsSection({ stats }: PremiumRecentStatsSectionProps) {
  return (
    <View style={styles.grid}>
      {stats.slice(0, 4).map((stat) => (
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
  const label = shortLabels[stat.key] || stat.label

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={!stat.onPress}
      onPress={stat.onPress}
      style={[
        styles.card,
        createShadow(palette, 1),
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.value, { color: accent }]} numberOfLines={1}>{normalizeValue(stat.value)}</Text>
      <Text style={[styles.caption, { color: palette.muted }]} numberOfLines={1}>{stat.caption}</Text>

      <View style={styles.trendRow}>
        {trend.slice(0, 5).map((point, index) => (
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
    borderRadius: radius.xxl,
    overflow: 'hidden',
  },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 108,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: -0.3, marginBottom: spacing.xs },
  value: { fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -1.0 },
  caption: { fontSize: 10, lineHeight: 13, fontWeight: '800', marginTop: spacing.xs, maxWidth: '100%' },
  trendRow: {
    width: '80%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginTop: 'auto',
    paddingTop: spacing.sm,
  },
  trendSegment: {
    flex: 1,
    borderRadius: radius.pill,
  },
})
