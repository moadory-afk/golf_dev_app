import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { createShadow, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'

type RecordExtraCard = {
  key: string
  title: string
  subtitle?: string
  icon?: string
  onPress?: () => void
}

const defaultCards: RecordExtraCard[] = [
  { key: 'matchup', title: '상대 전적', subtitle: '준비중', icon: '⚔️' },
  { key: 'records', title: '보유 기록', subtitle: '준비중', icon: '🏆' },
  { key: 'empty-1', title: '', subtitle: '', icon: '' },
  { key: 'empty-2', title: '', subtitle: '', icon: '' },
]

export function PremiumRecordExtrasSection({ cards = defaultCards }: { cards?: RecordExtraCard[] }) {
  return (
    <View style={styles.grid}>
      {cards.slice(0, 4).map((card) => (
        <RecordExtraCardView key={card.key} card={card} />
      ))}
    </View>
  )
}

function RecordExtraCardView({ card }: { card: RecordExtraCard }) {
  const { palette } = useSkin()
  const isEmpty = !card.title
  const valueMatch = (card.subtitle ?? '').match(/[+-]?\d+(?:\.\d+)?(?:개|회)?/)
  const value = valueMatch?.[0] ?? ''
  const caption = value ? (card.subtitle ?? '').replace(value, '').trim() : (card.subtitle ?? '')

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={!card.onPress || isEmpty}
      onPress={card.onPress}
      style={[
        styles.card,
        createShadow(palette, 1),
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      {!!card.title && <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{card.title}</Text>}
      {!!value && <Text style={[styles.value, { color: palette.green }]} numberOfLines={1}>{value}</Text>}
      {!!caption && <Text style={[styles.subtitle, { color: palette.muted }]} numberOfLines={1}>{caption}</Text>}
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
    minHeight: 84,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  title: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: -0.3, marginBottom: 3 },
  value: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { fontSize: 9, lineHeight: 12, fontWeight: '800', marginTop: 3 },
})
