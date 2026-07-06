import { View } from 'react-native'
import { GPBadge, GPButton, GPCard, GPSection, GPText } from '../../../components/ui'

type TodayRoundCardProps = {
  dday: string
  course: string
  dateText: string
  teeTime: string
  groupText: string
  hasRound: boolean
  onPress: () => void
}

export function TodayRoundCard({ dday, course, dateText, teeTime, groupText, hasRound, onPress }: TodayRoundCardProps) {
  return (
    <GPSection title="Today's Round" subtitle="다가오는 라운드">
      <GPCard contentStyle={{ padding: 18 }} onPress={onPress}>
        {hasRound ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <GPBadge label={dday} tone={dday === 'D-DAY' ? 'danger' : 'success'} style={{ alignSelf: 'flex-start' }} />
                <GPText variant="title" weight="black" style={{ marginTop: 12 }}>{course}</GPText>
                <GPText variant="body" tone="muted" weight="medium" style={{ marginTop: 4 }}>{dateText}</GPText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <GPText variant="display" tone="primary" weight="black">{teeTime || '--:--'}</GPText>
                <GPText variant="caption" tone="muted" weight="bold">TEE OFF</GPText>
              </View>
            </View>
            <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(120,120,120,0.16)' }}>
              <GPText variant="label" weight="bold">{groupText}</GPText>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 18 }}>
            <GPText variant="display">🏌️</GPText>
            <GPText variant="title" weight="black" style={{ marginTop: 8 }}>오늘 예정된 라운드가 없습니다.</GPText>
            <GPText variant="body" tone="muted" align="center" style={{ marginTop: 6 }}>라운드 일정을 만들고 멤버를 초대해보세요.</GPText>
            <GPButton label="라운드 일정 만들기" variant="primary" style={{ marginTop: 16 }} onPress={onPress} />
          </View>
        )}
      </GPCard>
    </GPSection>
  )
}
