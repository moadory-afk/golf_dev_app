import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { createShadow, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'

const gogoMark = require('../../../../assets/gogopar_i.png')

type PremiumGogoCaddieCardProps = {
  userName: string
  courseName?: string | null
  teeTime?: string | null
  dday?: string | null
  averageScore: string
  hasUpcomingRound: boolean
  title?: string | null
  message?: string | null
  hasLiveAdvice?: boolean
  recommendedClub?: string | null
  riskLabel?: string | null
  onCaddieBookPress: () => void
  onGroupPress: () => void
  onLottoPress: () => void
}

type ConciergeAction = {
  key: string
  icon: string
  title: string
  subtitle: string
  onPress: () => void
}

function resolveRoundLine(hasUpcomingRound: boolean, courseName?: string | null, teeTime?: string | null) {
  if (!hasUpcomingRound) return '예정 라운드를 등록하면 캐디북과 조편성을 바로 준비해드릴게요.'
  return `오늘 ${courseName || '예정 라운드'} · ${teeTime || 'Tee Off'} 라운드를 준비했습니다.`
}

function resolveAiComment({
  title,
  message,
  recommendedClub,
  riskLabel,
  averageScore,
  hasUpcomingRound,
}: {
  title?: string | null
  message?: string | null
  recommendedClub?: string | null
  riskLabel?: string | null
  averageScore: string
  hasUpcomingRound: boolean
}) {
  if (recommendedClub) return `${recommendedClub} 추천 · ${riskLabel || '안정적인 공략이 좋습니다.'}`
  if (title) return title
  if (message) return message
  if (hasUpcomingRound) return '오늘은 바람과 코스 흐름을 확인하고 첫 홀부터 안정적으로 시작하세요.'
  return `최근 평균 ${averageScore}타 기준으로 다음 라운드 전략을 준비해드릴게요.`
}

function ConciergeActionButton({ action }: { action: ConciergeAction }) {
  const { palette } = useSkin()

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={action.onPress}
      style={[styles.actionButton, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text style={styles.actionIcon}>{action.icon}</Text>
      <Text style={[styles.actionTitle, { color: palette.text }]} numberOfLines={1}>{action.title}</Text>
      <Text style={[styles.actionSubtitle, { color: palette.muted }]} numberOfLines={1}>{action.subtitle}</Text>
    </TouchableOpacity>
  )
}

export function PremiumGogoCaddieCard({
  userName,
  courseName,
  teeTime,
  averageScore,
  hasUpcomingRound,
  title,
  message,
  hasLiveAdvice,
  recommendedClub,
  riskLabel,
  onCaddieBookPress,
  onGroupPress,
  onLottoPress,
}: PremiumGogoCaddieCardProps) {
  const { palette } = useSkin()
  const roundLine = resolveRoundLine(hasUpcomingRound, courseName, teeTime)
  const aiComment = resolveAiComment({ title, message, recommendedClub, riskLabel, averageScore, hasUpcomingRound })
  const actions: ConciergeAction[] = [
    { key: 'caddie-book', icon: '🗺️', title: 'AI 캐디북', subtitle: '코스 공략', onPress: onCaddieBookPress },
    { key: 'groups', icon: '👥', title: '조편성', subtitle: '멤버 확인', onPress: onGroupPress },
    { key: 'lotto', icon: '🎱', title: 'Lotto', subtitle: '행운 뽑기', onPress: onLottoPress },
  ]

  return (
    <View
      style={[
        styles.card,
        createShadow(palette, 1),
        { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 10 },
      ]}
    >
      <View style={styles.heroRow}>
        <View style={[styles.characterStage, { backgroundColor: palette.greenLight }]}> 
          <Image source={gogoMark} style={styles.characterImage} resizeMode="cover" />
        </View>

        <View style={styles.content}> 
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: palette.green }]}>Gogo Concierge</Text>
            {hasLiveAdvice && <View style={[styles.liveDot, { backgroundColor: palette.gold }]} />}
          </View>
          <Text style={[styles.greetingLead, { color: palette.text }]}>안녕하세요,</Text>
          <Text style={[styles.greetingName, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86}>{userName}님 👋</Text>
          <Text style={[styles.roundLine, { color: palette.muted }]} numberOfLines={2}>{roundLine}</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      <View style={styles.actionRow}>
        {actions.map((action) => (
          <ConciergeActionButton key={action.key} action={action} />
        ))}
      </View>

      <View style={[styles.aiCommentBox, { backgroundColor: palette.greenLight }]}> 
        <View style={[styles.sparkBadge, { backgroundColor: palette.card }]}> 
          <Text style={styles.sparkIcon}>✨</Text>
        </View>
        <View style={styles.aiCopy}>
          <Text style={[styles.aiLabel, { color: palette.green }]}>AI 한줄 코멘트</Text>
          <Text style={[styles.aiComment, { color: palette.text }]} numberOfLines={1}>{aiComment}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  characterStage: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  characterImage: {
    width: 78,
    height: 78,
    transform: [{ translateY: 7 }],
  },
  content: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '900', letterSpacing: -0.2 },
  liveDot: { width: 7, height: 7, borderRadius: radius.pill },
  greetingLead: { fontSize: 14, lineHeight: 17, fontWeight: '900', letterSpacing: -0.35 },
  greetingName: { fontSize: 19, lineHeight: 23, fontWeight: '900', letterSpacing: -0.85 },
  roundLine: { marginTop: 3, fontSize: 11, lineHeight: 14, fontWeight: '800' },
  divider: { height: 1, marginVertical: 10, opacity: 0.68 },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  actionIcon: { fontSize: 17, marginBottom: 2 },
  actionTitle: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: -0.2, textAlign: 'center' },
  actionSubtitle: { marginTop: 1, fontSize: 8, lineHeight: 10, fontWeight: '800', textAlign: 'center' },
  aiCommentBox: {
    minHeight: 42,
    marginTop: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sparkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkIcon: { fontSize: 14 },
  aiCopy: { flex: 1, minWidth: 0 },
  aiLabel: { fontSize: 10, lineHeight: 12, fontWeight: '900', marginBottom: 1 },
  aiComment: { fontSize: 12, lineHeight: 15, fontWeight: '900', letterSpacing: -0.28 },
})
