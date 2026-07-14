import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createShadow, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'
import type { HomeFeedAction, HomeFeedEvent } from '../engine'

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
  onFeedAction?: (feed: HomeFeedEvent, action?: HomeFeedAction) => void
  actions?: ConciergeAction[]
  roundLabel?: string | null
  userId?: string | null
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
  roundLabel,
  userId,
}: PremiumGogoCaddieCardProps) {
  const { palette } = useSkin()
  const [page, setPage] = useState(0)
  const [slideWidth, setSlideWidth] = useState(0)
  const [cardWidth, setCardWidth] = useState(0)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const compact = cardWidth > 0 && cardWidth < 350

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

  useEffect(() => {
    setPage(0)
  }, [roundLabel, feedItems[0]?.id])


  const readStorageKey = `@gogopar_caddie_read:${userId ?? 'guest'}`

  useEffect(() => {
    let mounted = true
    AsyncStorage.getItem(readStorageKey)
      .then((value) => {
        if (!mounted) return
        const ids = value ? JSON.parse(value) : []
        setReadIds(new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []))
      })
      .catch(() => { if (mounted) setReadIds(new Set()) })
    return () => { mounted = false }
  }, [readStorageKey])

  useEffect(() => {
    const current = feedItems[page]
    if (!current || readIds.has(current.id)) return
    const timer = setTimeout(() => {
      setReadIds((previous) => {
        if (previous.has(current.id)) return previous
        const next = new Set(previous)
        next.add(current.id)
        AsyncStorage.setItem(readStorageKey, JSON.stringify(Array.from(next))).catch(() => undefined)
        return next
      })
    }, 1200)
    return () => clearTimeout(timer)
  }, [feedItems, page, readIds, readStorageKey])

  const runFeedAction = (item: HomeFeedEvent, action?: HomeFeedAction) => {
    if (onFeedAction) onFeedAction(item, action)
    else onPress()
  }
  const syncPageFromOffset = (offsetX: number) => {
    if (!slideWidth) return
    const nextPage = Math.max(0, Math.min(feedItems.length - 1, Math.round(offsetX / slideWidth)))
    setPage(nextPage)
  }

  return (
    <View
      onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
      style={[
        styles.card,
        compact && styles.cardCompact,
        createShadow(palette, 1),
        { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 10 },
      ]}
    >
      <View style={[styles.cardBody, compact && styles.cardBodyCompact]}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => runFeedAction(feedItems[page] ?? fallback)} style={[styles.characterStage, compact && styles.characterStageCompact]}>
          <Image source={caddieCharacter} style={[styles.characterImage, compact && styles.characterImageCompact]} resizeMode="contain" />
        </TouchableOpacity>

        <View style={styles.rightColumn} onLayout={(event) => setSlideWidth(event.nativeEvent.layout.width)}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={feedItems.length > 1}
            scrollEventThrottle={16}
            onScroll={(event) => syncPageFromOffset(event.nativeEvent.contentOffset.x)}
            onScrollEndDrag={(event) => syncPageFromOffset(event.nativeEvent.contentOffset.x)}
            onMomentumScrollEnd={(event) => syncPageFromOffset(event.nativeEvent.contentOffset.x)}
          >
            {feedItems.map((item) => {
              const [messageTitle, ...messageBodyParts] = item.message.split(/\n\s*\n/)
              const messageBody = messageBodyParts.join('\n\n')

              return (
              <View key={item.id} style={[styles.slide, slideWidth > 0 ? { width: slideWidth } : null]}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => runFeedAction(item)} style={styles.content}>
                  <View style={styles.messageRow}>
                    <Text style={styles.messageIcon}>{item.icon}</Text>
                    <View style={styles.messageTextColumn}>
                      {!readIds.has(item.id) && (
                        <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
                      )}
                      <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>{messageTitle}</Text>
                      {!!messageBody && (
                        <Text style={[styles.message, { color: palette.text }]} numberOfLines={4}>{messageBody}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {item.actions?.length ? (
                  <View style={styles.actionStack}>
                    <View style={styles.choiceActionRow}>
                      {item.actions.filter((action) => !action.secondary).map((action) => (
                        <TouchableOpacity
                          key={action.id}
                          activeOpacity={0.86}
                          onPress={() => runFeedAction(item, action)}
                          style={[
                            styles.choiceAction,
                            {
                              backgroundColor: action.selected ? palette.green : palette.card,
                              borderColor: action.selected ? palette.green : palette.border,
                            },
                          ]}
                        >
                          <Text style={[styles.choiceActionText, { color: action.selected ? '#fff' : palette.text }]}>
                            {action.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {item.actions.filter((action) => action.secondary).map((action) => (
                      <TouchableOpacity key={action.id} activeOpacity={0.86} onPress={() => runFeedAction(item, action)} style={[styles.secondaryAction, { borderColor: palette.green }]}>
                        <Text style={[styles.secondaryActionText, { color: palette.green }]}>{action.label}</Text>
                        <Text style={[styles.secondaryActionArrow, { color: palette.green }]}>›</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.86}
                    onPress={() => runFeedAction(item)}
                    style={[styles.primaryAction, compact && styles.primaryActionCompact, { backgroundColor: palette.green }]}
                  >
                    <Text style={styles.primaryActionText}>{item.ctaLabel}</Text>
                    <Text style={styles.primaryActionArrow}>›</Text>
                  </TouchableOpacity>
                )}
              </View>
              )
            })}
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

        </View>
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
  cardCompact: {
    paddingHorizontal: spacing.sm,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  cardBodyCompact: {
    gap: spacing.sm,
  },
  characterStage: {
    width: 112,
    minHeight: 146,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  characterStageCompact: {
    width: 96,
  },
  characterImage: {
    width: 132,
    height: 160,
    marginBottom: -14,
  },
  characterImageCompact: {
    width: 116,
    height: 141,
    marginBottom: -8,
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
  },
  slide: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 1,
  },
  content: {
    minWidth: 0,
    paddingTop: 2,
  },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.65 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 0 },
  messageTextColumn: { flex: 1, minWidth: 0, gap: 7 },
  newBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#EF4444' },
  newBadgeText: { color: '#fff', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.4 },
  messageIcon: { fontSize: 15, lineHeight: 20 },
  message: { minWidth: 0, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  actionStack: { gap: 6, marginTop: 'auto' },
  choiceActionRow: { flexDirection: 'row', gap: 6 },
  choiceAction: { flex: 1, minHeight: 34, borderWidth: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  choiceActionText: { fontSize: 11, lineHeight: 15, fontWeight: '900' },
  secondaryAction: { minHeight: 32, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secondaryActionText: { fontSize: 11, lineHeight: 15, fontWeight: '900' },
  secondaryActionArrow: { fontSize: 18, lineHeight: 20, fontWeight: '700' },
  primaryAction: {
    alignSelf: 'flex-end',
    minWidth: 92,
    width: '47%',
    minHeight: 34,
    borderRadius: radius.lg,
    paddingHorizontal: 13,
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryActionCompact: {
    width: '54%',
    minWidth: 84,
    paddingHorizontal: 10,
  },
  primaryActionText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  primaryActionArrow: { color: '#fff', fontSize: 20, lineHeight: 22, fontWeight: '700' },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6 },
  paginationDot: { width: 5, height: 5, borderRadius: 3 },
  paginationDotActive: { width: 16 },
  pageText: { fontSize: 9, lineHeight: 12, fontWeight: '800', marginLeft: 3 },
})
