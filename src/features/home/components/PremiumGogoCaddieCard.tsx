import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { createShadow, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'
import type { HomeFeedEvent } from '../engine'

const caddieCharacter = require('../../../../assets/caddy.png')

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
      <View style={styles.cardBody}>
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.characterStage}> 
          <Image source={caddieCharacter} style={styles.characterImage} resizeMode="contain" />
        </TouchableOpacity>

        <View style={styles.rightColumn}> 
          <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.content}>
            <View style={styles.labelRow}>
              <Text style={styles.feedIcon}>{icon}</Text>
              <Text style={[styles.label, { color: palette.green }]} numberOfLines={1}>{label}</Text>
              <View style={[styles.liveDot, { backgroundColor: palette.gold }]} />
            </View>
            <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>{title}</Text>
            <Text style={[styles.message, { color: palette.muted }]} numberOfLines={2}>{message}</Text>
          </TouchableOpacity>

          {actions.length > 0 && (
            <View style={styles.actionRow}>
              {actions.slice(0, 3).map((action) => (
                <TouchableOpacity key={action.key} activeOpacity={0.86} onPress={action.onPress} style={styles.actionButton}>
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                  <Text style={[styles.actionTitle, { color: palette.text }]} numberOfLines={1}>{action.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
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
  cardBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  characterStage: {
    width: 126,
    minHeight: 136,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  characterImage: {
    width: 132,
    height: 150,
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  content: {
    minWidth: 0,
    paddingTop: 2,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  feedIcon: { fontSize: 15, lineHeight: 18 },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: -0.2 },
  liveDot: { width: 5, height: 5, borderRadius: radius.pill },
  title: { fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.8 },
  message: { marginTop: 4, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.045)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  actionIcon: { fontSize: 17, lineHeight: 20, marginBottom: 2 },
  actionTitle: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: -0.4, textAlign: 'center' },
})
