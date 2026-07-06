import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { createShadow, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'

const gogoMark = require('../../../../assets/gogopar_i.png')

type PremiumGogoCaddieCardProps = {
  userName: string
  courseName?: string | null
  teeTime?: string | null
  averageScore: string
  hasUpcomingRound: boolean
  message?: string | null
  recommendedClub?: string | null
  onPress: () => void
  onCaddieBookPress: () => void
  onGroupsPress: () => void
  onLottoPress: () => void
}

export function PremiumGogoCaddieCard({
  userName,
  courseName,
  teeTime,
  averageScore,
  hasUpcomingRound,
  message: liveMessage,
  recommendedClub,
  onPress,
  onCaddieBookPress,
  onGroupsPress,
  onLottoPress,
}: PremiumGogoCaddieCardProps) {
  const { palette } = useSkin()
  const roundText = hasUpcomingRound
    ? `${courseName || '예정 라운드'} ${teeTime || ''} Tee Off 라운드가 예정되어 있어요.`.replace('  ', ' ')
    : `최근 평균 ${averageScore}타 기준으로 다음 라운드를 준비해드릴게요.`
  const advice = liveMessage || (recommendedClub
    ? `${recommendedClub} 중심으로 오늘의 1번홀 전략을 준비했어요.`
    : hasUpcomingRound
      ? '캐디북에서 코스 공략과 오늘의 Shot Plan을 확인해보세요.'
      : '다음 라운드를 등록하면 출발 준비와 캐디북을 바로 안내할게요.')

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.card,
        createShadow(palette, 1),
        { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 12 },
      ]}
    >
      <View style={styles.introRow}>
        <View style={[styles.characterStage, { backgroundColor: palette.greenLight }]}> 
          <Image source={gogoMark} style={styles.characterImage} resizeMode="cover" />
        </View>

        <View style={styles.introTextBlock}> 
          <Text style={[styles.label, { color: palette.green }]}>Gogo Concierge</Text>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>안녕하세요, {userName}님! 👋</Text>
          <Text style={[styles.message, { color: palette.muted }]} numberOfLines={2}>{roundText}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <ConciergeAction icon="🗺️" title="AI 캐디북" subtitle="코스 공략" onPress={onCaddieBookPress} />
        <ConciergeAction icon="👥" title="조편성" subtitle="멤버 확인" onPress={onGroupsPress} />
        <ConciergeAction icon="🎱" title="Lotto" subtitle="행운 뽑기" onPress={onLottoPress} />
      </View>

      <View style={[styles.adviceBox, { backgroundColor: palette.greenLight }]}> 
        <View style={[styles.adviceIconWrap, { backgroundColor: palette.card }]}> 
          <Text style={styles.adviceIcon}>✨</Text>
        </View>
        <View style={styles.adviceTextBlock}>
          <Text style={[styles.adviceLabel, { color: palette.green }]}>AI 한줄 코멘트</Text>
          <Text style={[styles.adviceText, { color: palette.text }]} numberOfLines={2}>{advice}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function ConciergeAction({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle: string; onPress: () => void }) {
  const { palette } = useSkin()

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[styles.actionButton, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <View style={styles.actionTextBlock}>
        <Text style={[styles.actionTitle, { color: palette.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.actionSubtitle, { color: palette.muted }]} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text style={[styles.actionArrow, { color: palette.muted }]}>›</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  characterStage: {
    width: 88,
    height: 88,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  characterImage: {
    width: 122,
    height: 122,
    transform: [{ translateY: 12 }],
  },
  introTextBlock: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, lineHeight: 19, fontWeight: '900', letterSpacing: -0.2, marginBottom: 4 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -1.0 },
  message: { marginTop: 6, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  actionIcon: { fontSize: 24, lineHeight: 28 },
  actionTextBlock: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: -0.25 },
  actionSubtitle: { fontSize: 10, lineHeight: 14, fontWeight: '800', marginTop: 2 },
  actionArrow: { fontSize: 22, lineHeight: 22, fontWeight: '900' },
  adviceBox: {
    minHeight: 58,
    borderRadius: radius.xl,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  adviceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adviceIcon: { fontSize: 19 },
  adviceTextBlock: { flex: 1, minWidth: 0 },
  adviceLabel: { fontSize: 12, lineHeight: 16, fontWeight: '900', marginBottom: 2 },
  adviceText: { fontSize: 15, lineHeight: 20, fontWeight: '900', letterSpacing: -0.35 },
})
