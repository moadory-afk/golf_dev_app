import { View } from 'react-native'
import { GPBadge, GPCard, GPSection, GPText } from '../../../components/ui'

export function CommunityPreviewSection({ clubName, onPress }: { clubName: string; onPress: () => void }) {
  return (
    <GPSection title="Community" subtitle="클럽 소식과 멤버 활동">
      <GPCard onPress={onPress} contentStyle={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1 }}>
            <GPBadge label={clubName || 'GogoPar Club'} tone="success" style={{ alignSelf: 'flex-start' }} />
            <GPText variant="title" weight="black" style={{ marginTop: 12 }}>오늘의 클럽 소식을 확인하세요.</GPText>
            <GPText variant="body" tone="muted" weight="medium" style={{ marginTop: 6 }}>공지사항, 회비, 대회, 멤버 활동을 한곳에서 관리합니다.</GPText>
          </View>
          <GPText variant="display">👥</GPText>
        </View>
      </GPCard>
    </GPSection>
  )
}
