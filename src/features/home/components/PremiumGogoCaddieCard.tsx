import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { createShadow, radius, spacing, typography } from '../../../design/tokens'
import { useSkin } from '../../../skins'

const gogoMark = require('../../../../assets/gogopar_i.png')

type PremiumGogoCaddieCardProps = {
  courseName?: string | null
  teeTime?: string | null
  dday?: string | null
  averageScore: string
  hasUpcomingRound: boolean
  onPress: () => void
}

export function PremiumGogoCaddieCard({
  courseName,
  teeTime,
  dday,
  averageScore,
  hasUpcomingRound,
  onPress,
}: PremiumGogoCaddieCardProps) {
  const { palette } = useSkin()
  const title = hasUpcomingRound ? '오늘도 버디 가볼까요?' : '다음 라운드를 준비해볼까요?'
  const message = hasUpcomingRound
    ? `${courseName || '예정 라운드'} ${teeTime || '티오프'} 기준으로 코스 전략을 준비하고 있어요.`
    : `최근 평균 ${averageScore}타 기준으로 다음 라운드 전략을 추천해드릴게요.`
  const primaryChip = hasUpcomingRound ? dday || '예정' : '준비중'
  const secondaryChip = hasUpcomingRound ? teeTime || 'Tee Off' : `${averageScore}타 평균`

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.card,
        createShadow(palette, 2),
        { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 10 },
      ]}
    >
      <View style={[styles.characterStage, { backgroundColor: palette.greenLight }]}> 
        <View style={[styles.characterHalo, { backgroundColor: palette.card }]}>
          <Image source={gogoMark} style={styles.characterImage} resizeMode="cover" />
        </View>
      </View>

      <View style={styles.content}> 
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: palette.green }]}>Gogo Caddie</Text>
          <View style={[styles.liveDot, { backgroundColor: palette.gold }]} />
        </View>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.message, { color: palette.muted }]} numberOfLines={2}>{message}</Text>

        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: palette.greenLight }]}> 
            <Text style={[styles.chipText, { color: palette.green }]}>{primaryChip}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: palette.bg }]}> 
            <Text style={[styles.chipText, { color: palette.muted }]}>{secondaryChip}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.arrowButton, { backgroundColor: palette.greenLight }]}> 
        <Text style={[styles.arrowText, { color: palette.green }]}>›</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    minHeight: 146,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    overflow: 'hidden',
  },
  characterStage: {
    width: 104,
    height: 114,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterHalo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  characterImage: {
    width: 120,
    height: 120,
    transform: [{ translateY: 10 }],
  },
  content: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  label: { ...typography.bodyLg, letterSpacing: -0.2 },
  liveDot: { width: 7, height: 7, borderRadius: radius.pill },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -1.0 },
  message: { marginTop: spacing.xs, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  chip: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { ...typography.bodySm },
  arrowButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 34, lineHeight: 36, fontWeight: '600' },
})
