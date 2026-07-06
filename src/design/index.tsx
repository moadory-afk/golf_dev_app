import { type ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native'
import type { RoundWeather } from '../lib/weather'
import { useSkin } from '../skins'
import { createTheme, radius, spacing, typography, type GPTheme } from './tokens'

export { createTheme, radius, spacing, typography, type GPTheme } from './tokens'

export function useTheme() {
  const { palette, skin, skinId, skins, setSkinId, isModern } = useSkin()
  return {
    ...createTheme(palette),
    palette,
    skin,
    skinId,
    skins,
    setSkinId,
    isModern,
  }
}

export function GPCard({
  children,
  style,
  elevated = true,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  elevated?: boolean
}) {
  const theme = useTheme()
  return (
    <View
      style={[
        ds.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.card,
        },
        elevated && theme.shadow(1),
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function GPSection({
  title,
  right,
  children,
  style,
}: {
  title: string
  right?: ReactNode
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const theme = useTheme()
  return (
    <View style={[ds.section, style]}>
      <View style={ds.sectionHeader}>
        <Text style={[theme.typography.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  )
}

export function GPButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  style,
}: {
  label: string
  onPress?: () => void
  disabled?: boolean
  variant?: 'primary' | 'soft' | 'ghost'
  style?: StyleProp<ViewStyle>
}) {
  const theme = useTheme()
  const bg = variant === 'primary' ? theme.colors.primary : variant === 'soft' ? theme.colors.primarySoft : 'transparent'
  const color = variant === 'primary' ? theme.colors.accentText : theme.colors.primary
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onPress}
      disabled={disabled}
      style={[
        ds.button,
        { backgroundColor: bg, borderColor: variant === 'ghost' ? theme.colors.border : bg },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Text style={[ds.buttonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  )
}

export function GPBadge({
  label,
  tone = 'primary',
  style,
}: {
  label: string
  tone?: 'primary' | 'info' | 'warning' | 'danger' | 'neutral'
  style?: StyleProp<ViewStyle>
}) {
  const theme = useTheme()
  const toneColor =
    tone === 'info' ? theme.colors.info
      : tone === 'warning' ? theme.colors.warning
        : tone === 'danger' ? theme.colors.danger
          : tone === 'neutral' ? theme.colors.muted
            : theme.colors.primary
  return (
    <View style={[ds.badge, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }, style]}>
      <Text style={[ds.badgeText, { color: toneColor }]}>{label}</Text>
    </View>
  )
}

export function GPStatCard({
  label,
  value,
  sub,
  accent,
  onPress,
  style,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}) {
  const theme = useTheme()
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      disabled={!onPress}
      style={[
        ds.statCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.card,
        },
        theme.shadow(1),
        style,
      ]}
    >
      <Text style={[ds.statLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[ds.statValue, { color: accent ?? theme.colors.text }]} numberOfLines={1}>{value}</Text>
      {!!sub && <Text style={[ds.statSub, { color: theme.colors.muted }]} numberOfLines={1}>{sub}</Text>}
    </TouchableOpacity>
  )
}

export function GPMascotHero({ title, message, stat }: { title: string; message: string; stat?: string }) {
  const theme = useTheme()
  return (
    <View style={[ds.hero, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border, borderRadius: theme.radius.card + 4 }, theme.shadow(1)]}>
      <View style={ds.heroTextBox}>
        <Text style={[ds.heroEyebrow, { color: theme.colors.primary }]}>GogoPar Caddie</Text>
        <Text style={[ds.heroTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[ds.heroMessage, { color: theme.colors.muted }]}>{message}</Text>
        {!!stat && <View style={[ds.heroChip, { backgroundColor: theme.colors.surface }]}><Text style={[ds.heroChipText, { color: theme.colors.primary }]}>{stat}</Text></View>}
      </View>
      <View style={ds.mascotWrap}>
        <View style={[ds.mascotHead, { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface }]}> 
          <View style={ds.mascotEyeRow}><View style={ds.mascotEye} /><View style={ds.mascotEye} /></View>
          <View style={[ds.mascotSmile, { borderColor: theme.colors.primary }]} />
        </View>
        <View style={[ds.mascotBody, { backgroundColor: theme.colors.primary }]} />
      </View>
    </View>
  )
}

export function GPRoundTicket({
  date,
  course,
  status,
  sub,
  award,
  actions,
  selected,
  weather,
  onPress,
}: {
  date: string
  course: string
  status: string
  sub?: string
  award?: string
  actions?: ReactNode
  selected?: boolean
  weather?: RoundWeather | null
  onPress?: () => void
}) {
  const theme = useTheme()
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={!onPress}
      style={[
        ds.ticket,
        {
          backgroundColor: theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radius.card,
        },
        theme.shadow(selected ? 2 : 1),
      ]}
    >
      <View style={[ds.ticketHole, ds.ticketHoleLeft, { backgroundColor: theme.colors.background }]} />
      <View style={[ds.ticketHole, ds.ticketHoleRight, { backgroundColor: theme.colors.background }]} />
      <View style={ds.ticketTop}>
        <View style={{ flex: 1 }}>
          <Text style={[ds.ticketDate, { color: theme.colors.primary }]}>{date}</Text>
          <Text style={[ds.ticketCourse, { color: theme.colors.text }]} numberOfLines={1}>{course}</Text>
        </View>
        <View style={[ds.ticketBadge, { backgroundColor: theme.colors.primarySoft }]}><Text style={[ds.ticketBadgeText, { color: theme.colors.primary }]}>{status}</Text></View>
      </View>
      {!!sub && <Text style={[ds.ticketSub, { color: theme.colors.muted }]}>{sub}</Text>}
      {weather ? (
        <View style={[ds.weatherPill, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }]}> 
          <Text style={[ds.weatherText, { color: theme.colors.text }]}>{weather.icon} {weather.tempC}°C</Text>
          {typeof weather.windMs === 'number' ? <Text style={[ds.weatherSubText, { color: theme.colors.muted }]}>바람 {weather.windMs}m/s</Text> : null}
          {typeof weather.pop === 'number' ? <Text style={[ds.weatherSubText, { color: theme.colors.muted }]}>강수 {weather.pop}%</Text> : null}
        </View>
      ) : null}
      {!!award && <Text style={[ds.ticketAward, { color: theme.colors.muted }]} numberOfLines={2}>{award}</Text>}
      {actions ? <View style={ds.ticketActions}>{actions}</View> : null}
    </TouchableOpacity>
  )
}

const ds = StyleSheet.create({
  card: { borderWidth: 1, padding: spacing.xl, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  button: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  buttonText: { ...typography.body, fontWeight: '900' },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md },
  badgeText: { ...typography.caption, fontWeight: '900' },
  statCard: { width: '48.5%', minHeight: 106, borderWidth: 1, padding: spacing.lg, justifyContent: 'center' },
  statLabel: { ...typography.bodySm, marginBottom: 7 },
  statValue: { fontSize: 25, fontWeight: '900', letterSpacing: -0.8 },
  statSub: { ...typography.caption, marginTop: 5 },
  hero: { borderWidth: 1, padding: spacing.xl, marginBottom: spacing.lg, flexDirection: 'row', overflow: 'hidden' },
  heroTextBox: { flex: 1, paddingRight: spacing.sm },
  heroEyebrow: { ...typography.eyebrow, marginBottom: 6 },
  heroTitle: { ...typography.title, marginBottom: 6 },
  heroMessage: { ...typography.body },
  heroChip: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md, marginTop: spacing.md },
  heroChipText: { ...typography.bodySm, fontWeight: '900' },
  mascotWrap: { width: 92, alignItems: 'center', justifyContent: 'center' },
  mascotHead: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  mascotEyeRow: { flexDirection: 'row', gap: 18, marginTop: 2 },
  mascotEye: { width: 7, height: 10, borderRadius: 5, backgroundColor: '#18251d' },
  mascotSmile: { width: 25, height: 12, borderBottomWidth: 3, borderRadius: 20, marginTop: 8 },
  mascotBody: { width: 52, height: 18, borderRadius: radius.pill, marginTop: -4 },
  ticket: { position: 'relative', borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md, overflow: 'hidden' },
  ticketHole: { position: 'absolute', top: '50%', width: 22, height: 22, borderRadius: 11, marginTop: -11 },
  ticketHoleLeft: { left: -11 },
  ticketHoleRight: { right: -11 },
  ticketTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  ticketDate: { ...typography.eyebrow, marginBottom: 5 },
  ticketCourse: { ...typography.cardTitle },
  ticketBadge: { borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10 },
  ticketBadgeText: { ...typography.caption, fontWeight: '900' },
  ticketSub: { ...typography.body, marginTop: spacing.sm },
  ticketAward: { ...typography.bodySm, marginTop: 5 },
  weatherPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 10, marginTop: 10 },
  weatherText: { ...typography.bodySm, fontWeight: '900' },
  weatherSubText: { ...typography.caption, fontWeight: '800' },
  ticketActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 13 },
})
