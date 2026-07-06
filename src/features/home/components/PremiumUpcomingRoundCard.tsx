import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colorLayers, createShadow, radius, spacing, typography } from '../../../design/tokens'
import { useSkin } from '../../../skins'


export type PremiumRoundAction = {
  key: string
  icon: string
  label: string
  onPress: () => void
}

export type PremiumUpcomingRoundCardProps = {
  statusLabel: string
  courseName: string
  layoutName?: string
  dateLabel: string
  teeTime: string
  memberCount: number
  weatherText: string
  temperature: string
  empty?: boolean
  onPress: () => void
  onCreate: () => void
  actions: PremiumRoundAction[]
}

export function PremiumUpcomingRoundCard({
  statusLabel,
  courseName,
  layoutName,
  dateLabel,
  teeTime,
  memberCount,
  weatherText,
  temperature,
  empty = false,
  onPress,
  onCreate,
  actions,
}: PremiumUpcomingRoundCardProps) {
  const { palette } = useSkin()

  if (empty) {
    return (
      <View style={[styles.emptyCard, createShadow(palette, 1), { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 12 }]}> 
        <View style={[styles.emptyIcon, { backgroundColor: palette.greenLight }]}> 
          <Text style={styles.emptyIconText}>⛳</Text>
        </View>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>예정 라운드가 없습니다</Text>
        <Text style={[styles.emptyText, { color: palette.muted }]}>다음 라운드를 등록하면 코스 공략과 조편성을 홈에서 바로 확인할 수 있어요.</Text>
        <TouchableOpacity activeOpacity={0.86} onPress={onCreate} style={[styles.createButton, { backgroundColor: palette.green }]}> 
          <Text style={[styles.createButtonText, { color: palette.accentText }]}>라운드 일정 만들기</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.shell, createShadow(palette, 2), { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius + 12 }]}> 
      <View style={[styles.ticketMain, { backgroundColor: palette.headerBg }]}> 
        <View style={[styles.courseImage, { backgroundColor: palette.green }]} />
        <View style={styles.mainScrim} />
        <View style={styles.roundInfo}> 
          <View style={[styles.statusBadge, { backgroundColor: palette.greenLight }]}> 
            <Text style={[styles.statusText, { color: palette.green }]}>{statusLabel}</Text>
          </View>
          <Text style={[styles.courseName, { color: palette.headerText }]} numberOfLines={1}>{courseName}</Text>
          {!!layoutName && <Text style={[styles.layoutName, { color: colorLayers.heroTextMuted }]} numberOfLines={1}>{layoutName}</Text>}

          <View style={styles.metaRow}> 
            <RoundMeta icon="📅" label={dateLabel} />
            <RoundMeta icon="◷" label={`${teeTime || '--:--'} Tee Off`} />
            <RoundMeta icon="👥" label={`${memberCount}명`} />
          </View>

          <View style={styles.weatherRow}> 
            <Text style={styles.weatherIcon}>☀️</Text>
            <Text style={[styles.weatherText, { color: palette.headerText }]}>{temperature} {weatherText}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function RoundMeta({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.metaItem}> 
      <Text style={styles.metaIcon}>{icon}</Text>
      <Text style={styles.metaText} numberOfLines={1}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    minHeight: 190,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ticketMain: {
    flex: 1,
    minHeight: 190,
    overflow: 'hidden',
  },
  courseImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.72,
  },
  mainScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,40,24,0.72)',
  },
  roundInfo: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  statusText: { ...typography.caption, fontWeight: '900' },
  courseName: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  layoutName: {
    marginTop: spacing.xs,
    ...typography.bodySm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaIcon: { fontSize: 13 },
  metaText: { color: colorLayers.heroTextMuted, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  weatherIcon: { fontSize: 23 },
  weatherText: { ...typography.bodyLg },
  emptyCard: {
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyIconText: { fontSize: 29 },
  emptyTitle: { ...typography.cardTitle, textAlign: 'center' },
  emptyText: { ...typography.body, textAlign: 'center', marginTop: spacing.sm },
  createButton: {
    marginTop: spacing.lg,
    minHeight: 44,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: { ...typography.bodyLg },
})
