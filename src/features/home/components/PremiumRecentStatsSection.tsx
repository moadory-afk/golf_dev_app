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

const shortLabelMap: Record<string, string> = {
  handicap: 'HCP',
  average: 'AVG',
  recent: 'LAST',
  best: 'BEST',
}

function displayLabel(stat: PremiumRecentStatItem) {
  return shortLabelMap[stat.key] || stat.label
}

export function PremiumRecentStatsSection({ stats }: PremiumRecentStatsSectionProps) {
  const { palette } = useSkin()

  return (
    <View
      style={[
        styles.grid,
        createShadow(palette, 1),
        { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 8 },
      ]}
    >
      {stats.map((stat) => (
        <PremiumStatCell key={stat.key} stat={stat} />
      ))}
    </View>
  )
}

function PremiumStatCell({ stat }: { stat: PremiumRecentStatItem }) {
  const { palette } = useSkin()
  const accent = stat.tone === 'gold'
    ? palette.gold
    : stat.tone === 'info'
      ? palette.info
      : palette.green

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={!stat.onPress}
      onPress={stat.onPress}
      style={[
        styles.cell,
        { borderRightColor: palette.border },
      ]}
    >
      <Text style={[styles.label, { color: palette.muted }]} numberOfLines={1}>{displayLabel(stat)}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: stat.key === 'best' ? accent : palette.text }]} numberOfLines={1}>{stat.value}</Text>
        {!!stat.suffix && <Text style={[styles.suffix, { color: stat.key === 'best' ? accent : palette.text }]}>{stat.suffix}</Text>}
      </View>
      <View style={styles.miniTrendRow}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View key={`${stat.key}-${index}`} style={[styles.miniTrend, { backgroundColor: accent, opacity: 0.45 + index * 0.08 }]} />
        ))}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  grid: {
    minHeight: 92,
    flexDirection: 'row',
    borderWidth: 1,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.45, marginBottom: 5 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', minHeight: 31 },
  value: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.85 },
  suffix: { fontSize: 13, lineHeight: 23, fontWeight: '900', marginLeft: spacing.xxs },
  miniTrendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginTop: 7,
    width: '74%',
  },
  miniTrend: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
  },
})
