import { View } from 'react-native'
import { GPCard, GPSection, GPText } from '../../../components/ui'

type QuickMenuItem = {
  key: string
  icon: string
  title: string
  subtitle: string
  onPress: () => void
}

export function QuickMenuSection({ items }: { items: QuickMenuItem[] }) {
  return (
    <GPSection title="Quick Menu" subtitle="필요한 기능만 빠르게">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((item) => (
          <GPCard key={item.key} onPress={item.onPress} style={{ width: '31.5%' }} contentStyle={{ paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center' }}>
            <GPText variant="display" align="center">{item.icon}</GPText>
            <GPText variant="label" weight="black" align="center" style={{ marginTop: 8 }}>{item.title}</GPText>
            <GPText variant="caption" tone="muted" weight="medium" align="center" numberOfLines={1} style={{ marginTop: 2 }}>{item.subtitle}</GPText>
          </GPCard>
        ))}
      </View>
    </GPSection>
  )
}
