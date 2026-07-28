import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ImageSourcePropType, type LayoutRectangle } from 'react-native'
import { useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createShadow, radius, spacing } from '../../../design/tokens'
import { useSkin } from '../../../skins'
import type { HomeFeedAction, HomeFeedEvent } from '../engine'
import { TutorialFinger } from '../../../components/tutorial/TutorialFinger'

const caddieCharacter = require('../../../../assets/caddie/01.png')
const caddieWelcome = require('../../../../assets/caddie/02-Photoroom.png')
const caddieAttendance = require('../../../../assets/caddie/03-Photoroom.png')
const caddieCaddieBook = require('../../../../assets/caddie/06-Photoroom.png')
const caddieGroups = require('../../../../assets/caddie/07-Photoroom.png')
const caddieLotto = require('../../../../assets/caddie/08-Photoroom.png')
const caddieScore = require('../../../../assets/caddie/09-Photoroom.png')
const caddieSunny = require('../../../../assets/caddie/10-Photoroom.png')
const caddieRain = require('../../../../assets/caddie/11-Photoroom.png')
const caddieWind = require('../../../../assets/caddie/12-Photoroom.png')
const caddieThinking = require('../../../../assets/caddie/13-Photoroom.png')
const caddieConfirm = require('../../../../assets/caddie/15-Photoroom.png')
const caddieCelebrate = require('../../../../assets/caddie/16-Photoroom.png')

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
  tutorialActive?: boolean
  onTutorialCompleted?: () => void
  onTutorialSkip?: () => void
}

function weatherCaddieImage(feed: HomeFeedEvent): ImageSourcePropType {
  const weatherText = [
    feed.message,
    ...(feed.weatherHours ?? []).flatMap((hour) => [hour.icon, hour.condition]),
  ].join(' ').toLowerCase()

  if (/rain|shower|storm|snow|thunder|비|소나기|눈|뇌우|우산/.test(weatherText)) return caddieRain
  if (/wind|gust|바람|강풍/.test(weatherText)) return caddieWind
  return caddieSunny
}

function caddieImageForFeed(feed: HomeFeedEvent): ImageSourcePropType {
  switch (feed.type) {
    case 'attendance_request':
      return caddieAttendance
    case 'grouping':
      return caddieGroups
    case 'round_preparation':
      return caddieCaddieBook
    case 'lotto':
      return caddieLotto
    case 'score_entry':
      return caddieScore
    case 'weather_route':
      return weatherCaddieImage(feed)
    case 'round_result':
      return caddieCelebrate
    case 'round_analysis':
      return caddieThinking
    case 'award':
      return caddieCelebrate
    case 'notice':
      return caddieConfirm
    case 'empty':
      return caddieWelcome
    default:
      return caddieCharacter
  }
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
  tutorialActive = false,
  onTutorialCompleted,
  onTutorialSkip,
}: PremiumGogoCaddieCardProps) {
  const { palette } = useSkin()
  const [page, setPage] = useState(0)
  const [slideWidth, setSlideWidth] = useState(0)
  const [cardWidth, setCardWidth] = useState(0)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [tutorialTarget, setTutorialTarget] = useState<LayoutRectangle | null>(null)
  const [rightColumnLayout, setRightColumnLayout] = useState<LayoutRectangle | null>(null)
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

  useEffect(() => {
    setTutorialTarget(null)
  }, [page, tutorialActive])


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



  const markAsRead = (itemId: string) => {
    setReadIds((previous) => {
      if (previous.has(itemId)) return previous
      const next = new Set(previous)
      next.add(itemId)
      AsyncStorage.setItem(readStorageKey, JSON.stringify(Array.from(next))).catch(() => undefined)
      return next
    })
  }

  const runFeedAction = (item: HomeFeedEvent, action?: HomeFeedAction) => {
    // NEW 배지는 카드가 보였을 때가 아니라 사용자가 실제로 클릭했을 때만 제거한다.
    markAsRead(item.id)
    if (tutorialActive) onTutorialCompleted?.()
    if (onFeedAction) onFeedAction(item, action)
    else onPress()
  }
  const syncPageFromOffset = (offsetX: number) => {
    if (!slideWidth) return
    const nextPage = Math.max(0, Math.min(feedItems.length - 1, Math.round(offsetX / slideWidth)))
    setPage(nextPage)
  }
  const currentFeed = feedItems[page] ?? fallback
  const currentCaddieImage = caddieImageForFeed(currentFeed)

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
        <TouchableOpacity activeOpacity={0.9} onPress={() => runFeedAction(currentFeed)} style={[styles.characterStage, compact && styles.characterStageCompact]}>
          <Image source={currentCaddieImage} style={[styles.characterImage, compact && styles.characterImageCompact]} resizeMode="contain" />
        </TouchableOpacity>

        <View
          style={styles.rightColumn}
          onLayout={(event) => {
            const layout = event.nativeEvent.layout
            setSlideWidth(layout.width)
            setRightColumnLayout(layout)
          }}
        >
          <ScrollView
            style={styles.feedPager}
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
              const messageBody = messageBodyParts.join(' ').replace(/\s+/g, ' ').trim()

              return (
              <View key={item.id} style={[styles.slide, slideWidth > 0 ? { width: slideWidth } : null]}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => runFeedAction(item)} style={styles.content}>
                  <View style={styles.messageRow}>
                    <Text style={styles.messageIcon}>{item.icon}</Text>
                    <View style={styles.messageTextColumn}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{messageTitle}</Text>
                        {!readIds.has(item.id) && (
                          <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
                        )}
                      </View>
                      {!!messageBody && (
                        <Text style={[styles.message, { color: palette.text }]} numberOfLines={2}>{messageBody}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {item.actions?.length ? (
                  <View style={styles.choiceActionRow}>
                    {item.actions.map((action) => (
                      <TouchableOpacity
                        key={action.id}
                        activeOpacity={0.86}
                        onPress={() => runFeedAction(item, action)}
                        onLayout={(event) => {
                          if (tutorialActive && item.id === feedItems[page]?.id && !tutorialTarget) {
                            const layout = event.nativeEvent.layout
                            setTutorialTarget({
                              x: (rightColumnLayout?.x ?? 0) + layout.x,
                              y: (rightColumnLayout?.y ?? 0) + layout.y,
                              width: layout.width,
                              height: layout.height,
                            })
                          }
                        }}
                        style={[
                          styles.choiceAction,
                          action.secondary && styles.choiceActionSecondary,
                          {
                            backgroundColor: action.selected ? palette.green : palette.card,
                            borderColor: action.selected || action.secondary ? palette.green : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.choiceActionText, { color: action.selected ? '#fff' : action.secondary ? palette.green : palette.text }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.82}
                        >
                          {action.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.86}
                    onPress={() => runFeedAction(item)}
                    onLayout={(event) => {
                      if (tutorialActive && item.id === feedItems[page]?.id) {
                        const layout = event.nativeEvent.layout
                        setTutorialTarget({
                          x: (rightColumnLayout?.x ?? 0) + layout.x,
                          y: (rightColumnLayout?.y ?? 0) + layout.y,
                          width: layout.width,
                          height: layout.height,
                        })
                      }
                    }}
                    style={[styles.primaryAction, compact && styles.primaryActionCompact, { backgroundColor: palette.green }]}
                  >
                    <Text style={styles.primaryActionText}>{item.ctaLabel}</Text>
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

      {tutorialActive ? (
        <View pointerEvents="box-none" style={styles.tutorialLayer}>
          {tutorialTarget ? (
            <View
              pointerEvents="none"
              style={[
                styles.tutorialHighlight,
                {
                  left: tutorialTarget.x - 4,
                  top: tutorialTarget.y - 4,
                  width: tutorialTarget.width + 8,
                  height: tutorialTarget.height + 8,
                },
              ]}
            />
          ) : null}
          <View style={styles.tutorialMessage}>
            <View style={styles.tutorialHeader}>
              <Text style={styles.tutorialProgress}>5 / 5</Text>
              <TouchableOpacity onPress={onTutorialSkip} hitSlop={10}>
                <Text style={styles.tutorialSkip}>건너뛰기</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.tutorialTitle}>AI 캐디가 필요한 일을 알려드려요</Text>
            <Text style={styles.tutorialDescription}>아래 안내 버튼을 눌러 라운드 준비를 바로 진행해 보세요.</Text>
            <View style={styles.tutorialArrow} />
          </View>
          {tutorialTarget ? (
            <View
              pointerEvents="none"
              style={[
                styles.tutorialFinger,
                {
                  left: tutorialTarget.x + tutorialTarget.width / 2 - 20,
                  top: tutorialTarget.y + tutorialTarget.height / 2 - 22,
                },
              ]}
            >
              <TutorialFinger gesture="tap" />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    height: 150,
    position: 'relative',
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: 6,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  cardCompact: {
    height: 148,
    paddingHorizontal: spacing.sm,
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  cardBodyCompact: {
    gap: spacing.sm,
  },
  characterStage: {
    width: 112,
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  characterStageCompact: {
    width: 96,
  },
  characterImage: {
    width: 136,
    height: 165,
    marginBottom: -26,
  },
  characterImageCompact: {
    width: 122,
    height: 148,
    marginBottom: -23,
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  feedPager: { flex: 1 },
  slide: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-start',
    paddingRight: 1,
    paddingBottom: 11,
  },
  content: {
    minWidth: 0,
    paddingTop: 0,
    flexShrink: 1,
    marginBottom: 14,
  },
  title: { flex: 1, minWidth: 0, fontSize: 17, lineHeight: 21, fontWeight: '900', letterSpacing: -0.65 },
  titleRow: { minHeight: 21, flexDirection: 'row', alignItems: 'center', gap: 7 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 0 },
  messageTextColumn: { flex: 1, minWidth: 0, gap: 3, maxHeight: 60 },
  newBadge: { flexShrink: 0, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#EF4444' },
  newBadgeText: { color: '#fff', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.4 },
  messageIcon: { fontSize: 15, lineHeight: 20 },
  message: { minWidth: 0, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  choiceActionRow: { height: 32, flexDirection: 'row', gap: 6, alignItems: 'stretch', marginTop: 14 },
  choiceAction: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0, flexDirection: 'row' },
  choiceActionSecondary: { flex: 1, paddingHorizontal: 0, justifyContent: 'center' },
  choiceActionText: { fontSize: 12, lineHeight: 16, fontWeight: '900', textAlign: 'center' },
  primaryAction: {
    alignSelf: 'flex-end',
    minWidth: 92,
    width: '47%',
    height: 32,
    borderRadius: radius.lg,
    paddingHorizontal: 0,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionCompact: {
    width: '54%',
    minWidth: 84,
    paddingHorizontal: 0,
  },
  primaryActionText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '900', textAlign: 'center' },
  paginationRow: { position: 'absolute', left: 0, right: 0, bottom: -1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  paginationDot: { width: 5, height: 5, borderRadius: 3 },
  paginationDotActive: { width: 16 },
  pageText: { fontSize: 11, lineHeight: 13, fontWeight: '900', marginLeft: 3 },
  tutorialLayer: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  tutorialHighlight: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.98)', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  tutorialMessage: { position: 'absolute', top: 4, left: 104, right: 8, minHeight: 86, borderRadius: 16, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 11, backgroundColor: 'rgba(24,116,84,0.78)' },
  tutorialHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  tutorialProgress: { color: 'rgba(255,255,255,0.68)', fontSize: 10, fontWeight: '900' },
  tutorialSkip: { color: 'rgba(255,255,255,0.78)', fontSize: 10, fontWeight: '900' },
  tutorialTitle: { color: '#F6F1DF', fontSize: 14, lineHeight: 18, fontWeight: '900', marginBottom: 3 },
  tutorialDescription: { color: 'rgba(255,255,255,0.88)', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  tutorialArrow: { position: 'absolute', bottom: -8, right: 28, width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'rgba(24,116,84,0.78)' },
  tutorialFinger: { position: 'absolute' },
})
