import { View } from 'react-native'
import { GPButton, GPCard, GPSection, GPText } from '../../../components/ui'
import { useSkin } from '../../../skins'

export function AICaddieCard({ message, onPress }: { message: string; onPress: () => void }) {
  const { palette } = useSkin()
  return (
    <GPSection title="AI Caddie" subtitle="오늘 필요한 한마디">
      <GPCard contentStyle={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 62, height: 62, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.greenLight }}>
            <GPText variant="display">🤖</GPText>
          </View>
          <View style={{ flex: 1 }}>
            <GPText variant="title" weight="black">Gogo AI</GPText>
            <GPText variant="body" tone="muted" weight="medium" style={{ marginTop: 5 }}>{message}</GPText>
          </View>
        </View>
        <GPButton label="AI 캐디 열기" variant="soft" fullWidth style={{ marginTop: 16 }} onPress={onPress} />
      </GPCard>
    </GPSection>
  )
}
