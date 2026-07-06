import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { radius, spacing } from '../../../design/tokens'
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

export function PremiumRecentStatsSection({ stats }: PremiumRecentStatsSectionProps) {
  return (
    <View style={styles.card}>
      {stats.slice(0, 4).map((stat, index) => (
        <PremiumStatCell key={stat.key} stat={stat} showDivider={index > 0} />
      ))}
    </View>
  )
}

function PremiumStatCell({ stat, showDivider }: { stat: PremiumRecentStatItem; showDivider: boolean }) {
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
      style={[styles.cell, showDivider && { borderLeftColor: palette.border, borderLeftWidth: 1 }]}
    >
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>{shortLabel(stat.label)}</Text>
      <Text style={[styles.value, { color: accent }]} numberOfLines={1}>{stat.value}</Text>
      <Text style={[styles.caption, { color: palette.muted }]} numberOfLines={1}>{shortCaption(stat.key, stat.caption)}</Text>
      <View style={styles.trendRow}>
        {(stat.trend?.length ? stat.trend : ['flat', 'up', 'flat', 'down', 'up']).slice(0, 5).map((point, index) => (
          <View
            key={`${stat.key}-${index}`}
            style={[
              styles.trendSegment,
              {
                backgroundColor: point === 'down' ? palette.border : accent,
                opacity: point === 'flat' ? 0.5 : 1,
                height: point === 'up' ? 3 : 2,
              },
            ]}
          />
        ))}
      </View>
    </TouchableOpacity>
  )
}

function shortLabel(label: string) {
  if (label.includes('핸디')) return '핸디캡'
  if (label.includes('평균')) return '평균'
  if (label.includes('최근')) return '최근'
  if (label.includes('베스트')) return '베스트'
  return label
}

function shortCaption(key: string, caption: string) {
  if (key === 'handicap') return '최근 5경기'
  if (key === 'average') return '평균'
  if (key === 'recent') return caption.replace('요일', '').slice(0, 7)
  if (key === 'best') return '최고 기록'
  return caption
}

const styles = StyleSheet.create({
  card: {
    minHeight: 110,
    flexDirection: 'row',
    borderRadius: 26,
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: '#0B3D24',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: -0.25, marginBottom: spacing.xs },
  value: { fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: -0.9 },
  caption: { fontSize: 10, lineHeight: 14, fontWeight: '800', marginTop: spacing.xs },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginTop: spacing.sm,
  },
  trendSegment: {
    flex: 1,
    borderRadius: radius.pill,
  },
})
