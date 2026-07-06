import { View } from 'react-native'
import { GPBadge, GPButton, GPCard, GPText } from '../../../components/ui'
import { useSkin } from '../../../skins'

type HomeHeroSectionProps = {
  name: string
  greeting: string
  subtitle: string
  handicap: string
  averageScore: string
  monthlyRounds: string
  onPrimaryPress: () => void
}

export function HomeHeroSection({
  name,
  greeting,
  subtitle,
  handicap,
  averageScore,
  monthlyRounds,
  onPrimaryPress,
}: HomeHeroSectionProps) {
  const { palette, skinId } = useSkin()
  const premiumTone = skinId === 'premium'

  return (
    <GPCard
      elevated
      style={{
        backgroundColor: premiumTone ? palette.greenDark : palette.green,
        borderColor: premiumTone ? palette.gold : palette.green,
      }}
      contentStyle={{ padding: 22 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <GPBadge label={greeting} tone={premiumTone ? 'premium' : 'default'} style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)' }} />
          <GPText variant="display" weight="black" style={{ color: palette.headerText, marginTop: 14 }}>
            안녕하세요 {name}님 👋
          </GPText>
          <GPText variant="subtitle" weight="medium" style={{ color: 'rgba(255,255,255,0.82)', marginTop: 8 }}>
            {subtitle}
          </GPText>
        </View>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.16)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.22)',
          }}
        >
          <GPText variant="display" style={{ color: palette.headerText }}>⛳</GPText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
        <HeroMetric label="핸디" value={handicap} />
        <HeroMetric label="평균" value={averageScore} />
        <HeroMetric label="이번달" value={monthlyRounds} />
      </View>

      <GPButton
        label="오늘 라운드 준비하기"
        variant="soft"
        size="lg"
        fullWidth
        onPress={onPrimaryPress}
        style={{ backgroundColor: premiumTone ? palette.gold : '#ffffff', borderColor: 'transparent' }}
      />
    </GPCard>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        paddingVertical: 13,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <GPText variant="caption" weight="bold" style={{ color: 'rgba(255,255,255,0.74)' }}>{label}</GPText>
      <GPText variant="title" weight="black" style={{ color: '#fff', marginTop: 4 }}>{value}</GPText>
    </View>
  )
}
