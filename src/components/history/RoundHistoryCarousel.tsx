import { useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { Dimensions, FlatList, StyleSheet, Text, View } from 'react-native'
import type { SavedRound } from '../../lib/store'
import type { ScheduledRound } from '../../lib/roundSchedule'
import { C } from '../../theme'

export type RoundHistoryCarouselItem =
  | { kind: 'round'; key: string; date: string; round: SavedRound }
  | { kind: 'schedule'; key: string; date: string; schedule: ScheduledRound }

type RoundHistoryCarouselProps = {
  rounds: SavedRound[]
  schedules?: ScheduledRound[]
  emptyFallback: ReactNode
  renderRoundCard: (params: {
    round: SavedRound
    index: number
    totalCount: number
    width: number
    height: number
  }) => ReactElement | null
  renderScheduleCard: (params: {
    schedule: ScheduledRound
    index: number
    totalCount: number
    width: number
    height: number
  }) => ReactElement | null
}

export function RoundHistoryCarousel({
  rounds,
  schedules = [],
  emptyFallback,
  renderRoundCard,
  renderScheduleCard,
}: RoundHistoryCarouselProps) {
  const [containerWidth, setContainerWidth] = useState(0)
  const items = useMemo<RoundHistoryCarouselItem[]>(() => {
    const roundScheduleIds = new Set(
      rounds.map((round) => round.scheduleId).filter((id): id is string => Boolean(id)),
    )
    return [
      ...rounds.map((round): RoundHistoryCarouselItem => ({
        kind: 'round',
        key: `round-${round.id}`,
        date: round.date,
        round,
      })),
      ...schedules
        .filter((schedule) => !roundScheduleIds.has(schedule.id))
        .map((schedule): RoundHistoryCarouselItem => ({
          kind: 'schedule',
          key: `schedule-${schedule.id}`,
          date: schedule.date,
          schedule,
        })),
    ].sort((a, b) => b.date.localeCompare(a.date))
  }, [rounds, schedules])

  if (items.length === 0) return <>{emptyFallback}</>

  const cardGap = 8
  const nextCardPeek = 20
  const cardWidth = containerWidth > 0
    ? Math.min(Math.max(containerWidth - cardGap - nextCardPeek, 292), 442)
    : 0
  const snapInterval = cardWidth + cardGap
  const cardHeight = Math.max(500, Math.min(590, Dimensions.get('window').height - 220))

  return (
    <View
      style={styles.roundCarouselWrap}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width)
        if (nextWidth > 0 && nextWidth !== containerWidth) setContainerWidth(nextWidth)
      }}
    >
      {cardWidth > 0 ? (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => item.key}
          decelerationRate="fast"
          snapToInterval={snapInterval}
          snapToAlignment="start"
          disableIntervalMomentum
          getItemLayout={(_, index) => ({ length: snapInterval, offset: snapInterval * index, index })}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roundCarouselContent}
          ItemSeparatorComponent={() => <View style={{ width: cardGap }} />}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          renderItem={({ item, index }) => item.kind === 'round'
            ? renderRoundCard({ round: item.round, index, totalCount: items.length, width: cardWidth, height: cardHeight })
            : renderScheduleCard({ schedule: item.schedule, index, totalCount: items.length, width: cardWidth, height: cardHeight })}
        />
      ) : <View style={[styles.roundCarouselPlaceholder, { height: cardHeight }]} />}
      <Text style={styles.roundSwipeHint}>좌우로 스와이프해 다른 라운드를 확인하세요</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  roundCarouselWrap: {
    width: '100%',
    alignSelf: 'stretch',
    marginHorizontal: 0,
    overflow: 'hidden',
  },
  roundCarouselPlaceholder: {
    marginHorizontal: 24,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  roundCarouselContent: {
    paddingLeft: 0,
    paddingRight: 20,
  },
  roundSwipeHint: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
  },
})
