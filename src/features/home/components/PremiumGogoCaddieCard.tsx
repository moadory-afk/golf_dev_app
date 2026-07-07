import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { createShadow, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'
import type { HomeFeedEvent } from '../engine'

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
  averageScore: string
  hasUpcomingRound: boolean
  title?: string | null
  message?: string | null
  hasLiveAdvice?: boolean
  feed?: HomeFeedEvent
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
  feed,
  onPress,
  actions = [],
}: PremiumGogoCaddieCardProps) {
  const { palette } = useSkin()
  const displayName = userName || '골퍼'
  const title = feed?.title || liveTitle || `안녕하세요, ${displayName}님`
  const message = feed?.message || liveMessage || (hasUpcomingRound
    ? `오늘 ${courseName || '예정 골프장'} · ${teeTime || 'Tee Off'} 라운드를 준비했습니다.`
    : `최근 평균 ${averageScore} 기준으로 다음 라운드 전략을 준비할게요.`)
  const label = feed?.label || '오늘의 GOGO'
  const icon = feed?.icon || '⛳'

  return (
    <View
      style={[
        styles.card,
        createShadow(palette, 1),
        { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 10 },
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.feedArea}>
        <View style={styles.characterStage}> 
          <Image source={gogoMark} style={styles.characterImage} resizeMode="cover" />
        </View>

        <View style={styles.content}> 
          <View style={styles.labelRow}>
            <Text style={styles.feedIcon}>{icon}</Text>
            <Text style={[styles.label, { color: palette.green }]} numberOfLines={1}>{label}</Text>
            <View style={[styles.liveDot, { backgroundColor: palette.gold }]} />
          </View>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.message, { color: palette.muted }]} numberOfLines={2}>{message}</Text>
        </View>
      </TouchableOpacity>

      {actions.length > 0 && (
        <View style={[styles.actionRow, { borderTopColor: palette.border }]}>
          {actions.slice(0, 3).map((action) => (
            <TouchableOpacity key={action.key} activeOpacity={0.86} onPress={action.onPress} style={styles.actionButton}>
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <View style={styles.actionTextWrap}>
                <Text style={[styles.actionTitle, { color: palette.text }]} numberOfLines={1}>{action.title}</Text>
                <Text style={[styles.actionSubtitle, { color: palette.muted }]} numberOfLines={1}>{action.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  feedArea: {
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  characterStage: {
    width: 132,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  characterImage: {
    width: 132,
    height: 132,
  },
  content: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  feedIcon: { fontSize: 15, lineHeight: 18 },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: -0.2 },
  liveDot: { width: 5, height: 5, borderRadius: radius.pill },
  title: { fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.8 },
  message: { marginTop: 4, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  primaryAction: {
    minHeight: 44,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  primaryActionText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '900', letterSpacing: -0.3 },
  primaryArrow: { color: '#fff', fontSize: 24, lineHeight: 24, fontWeight: '900', marginTop: -1 },
  actionRow: {
    zIndex: 4,
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(0,0,0,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  actionIcon: { fontSize: 18, lineHeight: 21 },
  actionTextWrap: { minWidth: 0, alignItems: 'flex-start' },
  actionTitle: { fontSize: 12, lineHeight: 15, fontWeight: '900', letterSpacing: -0.3 },
  actionSubtitle: { fontSize: 9, lineHeight: 12, fontWeight: '800', marginTop: 1 },
})
