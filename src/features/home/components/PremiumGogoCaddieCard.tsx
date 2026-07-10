import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useMemo, useState } from 'react'
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
  feeds?: HomeFeedEvent[]
  onPress: () => void
  onFeedAction?: (feed: HomeFeedEvent) => void
  actions?: ConciergeAction[]
}

function fallbackFeed({
  userName,
  courseName,
  teeTime,
  averageScore,
  hasUpcomingRound,
  title,
  message,
}: Pick<PremiumGogoCaddieCardProps, 'userName' | 'courseName' | 'teeTime' | 'averageScore' | 'hasUpcomingRound' | 'title' | 'message'>): HomeFeedEvent {
  const displayName = userName || '골퍼'
  return {
    id: 'fallback-caddie-feed',
    type: 'empty',
    priority: 0,
    icon: '⛳',
    label: '오늘의 GOGO',
    title: title || `안녕하세요, ${displayName}님`,
    message: message || (hasUpcomingRound
      ? `오늘 ${courseName || '예정 골프장'} · ${teeTime || 'Tee Off'} 라운드를 준비했습니다.`
      : `최근 평균 ${averageScore} 기준으로 다음 라운드 전략을 준비할게요.`),
    ctaLabel: hasUpcomingRound ? '라운드 준비' : '일정 등록',
    actionType: hasUpcomingRound ? 'open_caddie_map' : 'create_round',
    tone: 'green',
  }
}

function findFeedForInput(input: string, feeds: HomeFeedEvent[]) {
  const normalized = input.replace(/\s+/g, '').toLowerCase()
  const rules: Array<{ keywords: string[]; actionType: HomeFeedEvent['actionType'] }> = [
    { keywords: ['참석', '출석', '참가'], actionType: 'open_groups' },
    { keywords: ['조편성', '우리조', '동반자'], actionType: 'open_groups' },
    { keywords: ['교통', '출발', '길찾기', '이동시간'], actionType: 'open_caddie_map' },
    { keywords: ['캐디북', '공략', '코스'], actionType: 'open_caddie_map' },
    { keywords: ['로또', 'lotto', '추첨', '당첨'], actionType: 'open_lotto' },
    { keywords: ['결과', '스코어', '시상', '분석'], actionType: 'open_result' },
    { keywords: ['공지', '알림'], actionType: 'open_notice' },
    { keywords: ['일정등록', '라운드등록', '등록'], actionType: 'create_round' },
  ]

  const matchedRule = rules.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)))
  if (!matchedRule) return null
  return feeds.find((item) => item.actionType === matchedRule.actionType) ?? null
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
  feeds = [],
  onPress,
  onFeedAction,
  actions = [],
}: PremiumGogoCaddieCardProps) {
  const { palette } = useSkin()
  const [page, setPage] = useState(0)
  const [slideWidth, setSlideWidth] = useState(0)
  const [input, setInput] = useState('')
  const [reply, setReply] = useState<string | null>(null)

  const fallback = useMemo(() => fallbackFeed({
    userName,
    courseName,
    teeTime,
    averageScore,
    hasUpcomingRound,
    title: liveTitle,
    message: liveMessage,
  }), [userName, courseName, teeTime, averageScore, hasUpcomingRound, liveTitle, liveMessage])

  const feedItems = useMemo(() => {
    const source = feeds.length > 0 ? feeds : feed ? [feed] : [fallback]
    return source.length > 0 ? source : [fallback]
  }, [feed, feeds, fallback])

  const runFeedAction = (item: HomeFeedEvent) => {
    if (onFeedAction) onFeedAction(item)
    else onPress()
  }

  const submitInput = () => {
    const value = input.trim()
    if (!value) return
    const matched = findFeedForInput(value, feedItems)
    if (matched) {
      const targetIndex = feedItems.findIndex((item) => item.id === matched.id)
      if (targetIndex >= 0) setPage(targetIndex)
      setReply(`“${matched.ctaLabel}” 안내로 이동합니다.`)
      setInput('')
      runFeedAction(matched)
      return
    }
    setReply('참석, 조편성, 교통, 캐디북, 로또, 결과 중 원하는 업무를 입력해 주세요.')
    setInput('')
  }

  return (
    <View
      style={[
        styles.card,
        createShadow(palette, 1),
        { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 10 },
      ]}
    >
      <View style={styles.cardBody}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => runFeedAction(feedItems[page] ?? fallback)} style={styles.characterStage}>
          <Image source={caddieCharacter} style={styles.characterImage} resizeMode="contain" />
        </TouchableOpacity>

        <View style={styles.rightColumn} onLayout={(event) => setSlideWidth(event.nativeEvent.layout.width)}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={feedItems.length > 1}
            onMomentumScrollEnd={(event) => {
              if (!slideWidth) return
              setPage(Math.round(event.nativeEvent.contentOffset.x / slideWidth))
              setReply(null)
            }}
          >
            {feedItems.map((item) => (
              <View key={item.id} style={[styles.slide, slideWidth > 0 ? { width: slideWidth } : null]}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => runFeedAction(item)} style={styles.content}>
                  <View style={styles.labelRow}>
                    <Text style={styles.feedIcon}>{item.icon}</Text>
                    <Text style={[styles.label, { color: palette.green }]} numberOfLines={1}>{item.label}</Text>
                    <View style={[styles.liveDot, { backgroundColor: palette.gold }]} />
                  </View>
                  <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={[styles.message, { color: palette.muted }]} numberOfLines={3}>{item.message}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => runFeedAction(item)}
                  style={[styles.primaryAction, { backgroundColor: palette.green }]}
                >
                  <Text style={styles.primaryActionText}>{item.ctaLabel}</Text>
                  <Text style={styles.primaryActionArrow}>›</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {feedItems.length > 1 && (
            <View style={styles.paginationRow}>
              {feedItems.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.paginationDot,
                    { backgroundColor: index === page ? palette.green : palette.border },
                    index === page && styles.paginationDotActive,
                  ]}
                />
              ))}
              <Text style={[styles.pageText, { color: palette.muted }]}>{Math.min(page + 1, feedItems.length)} / {feedItems.length}</Text>
            </View>
          )}

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

      {reply && <Text style={[styles.replyText, { color: palette.green }]}>{reply}</Text>}

      <View style={[styles.inputRow, { borderColor: palette.border, backgroundColor: palette.background }]}> 
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submitInput}
          returnKeyType="send"
          placeholder="참석, 조편성, 교통, 로또, 결과 입력"
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text }]}
        />
        <TouchableOpacity activeOpacity={0.84} onPress={submitInput} style={[styles.sendButton, { backgroundColor: palette.green }]}> 
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  characterStage: {
    width: 112,
    minHeight: 146,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  characterImage: {
    width: 138,
    height: 166,
    marginBottom: -8,
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
  },
  slide: {
    justifyContent: 'space-between',
    paddingRight: 1,
  },
  content: {
    minWidth: 0,
    paddingTop: 2,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  feedIcon: { fontSize: 15, lineHeight: 18 },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: -0.2 },
  liveDot: { width: 5, height: 5, borderRadius: radius.pill },
  title: { fontSize: 19, lineHeight: 23, fontWeight: '900', letterSpacing: -0.8 },
  message: { marginTop: 4, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  primaryAction: {
    minHeight: 38,
    borderRadius: radius.lg,
    paddingHorizontal: 13,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryActionText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  primaryActionArrow: { color: '#fff', fontSize: 20, lineHeight: 22, fontWeight: '700' },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8 },
  paginationDot: { width: 5, height: 5, borderRadius: 3 },
  paginationDotActive: { width: 16 },
  pageText: { fontSize: 9, lineHeight: 12, fontWeight: '800', marginLeft: 3 },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.045)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  actionIcon: { fontSize: 16, lineHeight: 19, marginBottom: 1 },
  actionTitle: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: -0.4, textAlign: 'center' },
  replyText: { fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 7, paddingHorizontal: 3 },
  inputRow: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radius.lg,
    marginTop: 8,
    paddingLeft: 12,
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '700', paddingVertical: 8 },
  sendButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sendButtonText: { color: '#fff', fontSize: 14, fontWeight: '900', marginLeft: 1 },
})
