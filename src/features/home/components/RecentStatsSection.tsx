import { View } from 'react-native'
import { GPCard, GPSection, GPText } from '../../../components/ui'

type Stat = { label: string; value: string; sub: string }

export function RecentStatsSection({ stats }: { stats: Stat[] }) {
  return (
    <GPSection title="Recent Stats" subtitle="최근 라운드 흐름">
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {stats.map((stat) => (
          <GPCard key={stat.label} style={{ flex: 1 }} contentStyle={{ paddingVertical: 16, paddingHorizontal: 12 }}>
            <GPText variant="caption" tone="muted" weight="bold">{stat.label}</GPText>
            <GPText variant="title" weight="black" style={{ marginTop: 6 }}>{stat.value}</GPText>
            <GPText variant="caption" tone="muted" weight="medium" style={{ marginTop: 3 }}>{stat.sub}</GPText>
          </GPCard>
        ))}
      </View>
    </GPSection>
  )
}
