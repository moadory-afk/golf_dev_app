import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { createShadow, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'

const gogoMark = require('../../../../assets/gogopar_i.png')

type ConciergeAction = {
  key: string
  icon: string
  title: string
  subtitle: string
  onPress: () => void
}

type PremiumGogoCaddieCardProps = {
  userName?: string | null
  courseName?: string | null
  teeTime?: string | null
  dday?: string | null
  averageScore: string
  hasUpcomingRound: boolean
  title?: string | null
  message?: string | null
  primaryChip?: string | null
  secondaryChip?: string | null
  hasLiveAdvice?: boolean
  onPress: () => void
  actions?: ConciergeAction[]
}

export function PremiumGogoCaddieCard({
  userName,
  courseName,
  teeTime,
  averageScore,
  hasUpcomingRound,
  title: liveTitle,
  message: liveMessage,
  hasLiveAdvice,
  onPress,
  actions = [],
}: PremiumGogoCaddieCardProps) {
  const { palette } = useSkin()
  const displayName = userName || '골퍼'
  const title = liveTitle || `안녕하세요,\n${displayName}님 👋`
  const message = liveMessage || (hasUpcomingRound
    ? `오늘 ${courseName || '예정 골프장'} · ${teeTime || 'Tee Off'} 라운드를 준비했습니다.`
    : `최근 평균 ${averageScore} 기준으로 다음 라운드 전략을 준비할게요.`)
  const aiComment = hasLiveAdvice && liveMessage ? liveMessage : (hasUpcomingRound
    ? '오늘은 코스 공략을 먼저 확인해보세요.'
    : '예정 라운드를 등록하면 출발 시간과 캐디북을 안내할게요.')

  return (
    <View
      style={[
        styles.card,
        createShadow(palette, 1),
        { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 10 },
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.topArea}>
        <View style={styles.characterStage}> 
          <Image source={gogoMark} style={styles.characterImage} resizeMode="cover" />
        </View>

        <View style={styles.content}> 
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: palette.green }]}>Gogo Concierge</Text>
            <View style={[styles.liveDot, { backgroundColor: palette.gold }]} />
          </View>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.message, { color: palette.muted }]} numberOfLines={2}>{message}</Text>
        </View>
      </TouchableOpacity>

      {actions.length > 0 && (
        <View style={[styles.actionRow, { borderTopColor: palette.border }]}> 
          {actions.map((action) => (
            <TouchableOpacity key={action.key} activeOpacity={0.86} onPress={action.onPress} style={[styles.actionButton, { backgroundColor: palette.bg, borderColor: palette.border }]}> 
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={[styles.actionTitle, { color: palette.text }]} numberOfLines={1}>{action.title}</Text>
              <Text style={[styles.actionSubtitle, { color: palette.muted }]} numberOfLines={1}>{action.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={[styles.aiComment, { backgroundColor: palette.greenLight }]}> 
        <Text style={styles.aiIcon}>✨</Text>
        <View style={styles.aiTextWrap}>
          <Text style={[styles.aiLabel, { color: palette.green }]}>AI 한줄 코멘트</Text>
          <Text style={[styles.aiText, { color: palette.text }]} numberOfLines={1}>{aiComment}</Text>
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: spacing.md,
    overflow: 'hidden',
  },
  topArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  characterStage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  characterImage: {
    width: 96,
    height: 96,
  },
  content: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '900', letterSpacing: -0.2 },
  liveDot: { width: 6, height: 6, borderRadius: radius.pill },
  title: { fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -1.0 },
  message: { marginTop: spacing.xs, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 70,
    borderWidth: 1,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  actionIcon: { fontSize: 24, lineHeight: 27, marginBottom: 2 },
  actionTitle: { fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: -0.3 },
  actionSubtitle: { fontSize: 10, lineHeight: 13, fontWeight: '800', marginTop: 1 },
  aiComment: {
    marginTop: spacing.md,
    minHeight: 52,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  aiIcon: { fontSize: 20 },
  aiTextWrap: { flex: 1, minWidth: 0 },
  aiLabel: { fontSize: 11, lineHeight: 14, fontWeight: '900', marginBottom: 1 },
  aiText: { fontSize: 14, lineHeight: 18, fontWeight: '900', letterSpacing: -0.3 },
})
