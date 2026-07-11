import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
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
  const syncPageFromOffset = (offsetX: number) => {
    if (!slideWidth) return
    const nextPage = Math.max(0, Math.min(feedItems.length - 1, Math.round(offsetX / slideWidth)))
    setPage(nextPage)
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
            onScrollEndDrag={(event) => syncPageFromOffset(event.nativeEvent.contentOffset.x)}
            onMomentumScrollEnd={(event) => syncPageFromOffset(event.nativeEvent.contentOffset.x)}
          >
            {feedItems.map((item) => (
              <View key={item.id} style={[styles.slide, slideWidth > 0 ? { width: slideWidth } : null]}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => runFeedAction(item)} style={styles.content}>
                  <View style={styles.messageRow}>
                    <Text style={styles.messageIcon}>{item.icon}</Text>
                    <Text style={[styles.message, { color: palette.muted }]} numberOfLines={5}>{item.message}</Text>
                  </View>
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
    width: 132,
    height: 160,
    marginBottom: -14,
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
  },
  slide: {
    justifyContent: 'flex-start',
    paddingRight: 1,
  },
  content: {
    minWidth: 0,
    paddingTop: 2,
  },
  title: { fontSize: 17, lineHeight: 21, fontWeight: '900', letterSpacing: -0.6 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 4 },
  messageIcon: { fontSize: 13, lineHeight: 17 },
  message: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  primaryAction: {
    minHeight: 34,
    borderRadius: radius.lg,
    paddingHorizontal: 13,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryActionText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  primaryActionArrow: { color: '#fff', fontSize: 20, lineHeight: 22, fontWeight: '700' },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6 },
  paginationDot: { width: 5, height: 5, borderRadius: 3 },
  paginationDotActive: { width: 16 },
  pageText: { fontSize: 9, lineHeight: 12, fontWeight: '800', marginLeft: 3 },
})
