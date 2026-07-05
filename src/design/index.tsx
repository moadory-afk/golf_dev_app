import { type ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native'
import { useSkin, type SkinPalette } from '../skins'

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 30 }
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 }

function shadow(palette: SkinPalette, level: 1 | 2 | 3 = 1): ViewStyle {
  const opacity = palette.shadowOpacity * level
  return {
    shadowColor: palette.greenDark,
    shadowOpacity: opacity,
    shadowRadius: 8 + level * 4,
    shadowOffset: { width: 0, height: 3 + level * 2 },
    elevation: level + 1,
  }
}

export function GPCard({ children, style, elevated = true }: { children: ReactNode; style?: ViewStyle | ViewStyle[]; elevated?: boolean }) {
  const { palette } = useSkin()
  return (
    <View style={[ds.card, { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius }, elevated && shadow(palette, 1), style]}>
      {children}
    </View>
  )
}

export function GPSection({ title, right, children, style }: { title: string; right?: ReactNode; children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const { palette } = useSkin()
  return (
    <View style={[ds.section, style]}>
      <View style={ds.sectionHeader}>
        <Text style={[ds.sectionTitle, { color: palette.text }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  )
}

export function GPButton({ label, onPress, disabled, variant = 'primary', style }: { label: string; onPress?: () => void; disabled?: boolean; variant?: 'primary' | 'soft' | 'ghost'; style?: ViewStyle | ViewStyle[] }) {
  const { palette } = useSkin()
  const bg = variant === 'primary' ? palette.green : variant === 'soft' ? palette.greenLight : 'transparent'
  const color = variant === 'primary' ? palette.accentText : palette.green
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onPress}
      disabled={disabled}
      style={[ds.button, { backgroundColor: bg, borderColor: variant === 'ghost' ? palette.border : bg }, disabled && { opacity: 0.45 }, style]}
    >
      <Text style={[ds.buttonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  )
}

export function GPStatCard({ label, value, sub, accent, onPress }: { label: string; value: string; sub?: string; accent?: string; onPress?: () => void }) {
  const { palette } = useSkin()
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress} disabled={!onPress} style={[ds.statCard, { backgroundColor: palette.card, borderColor: palette.border, borderRadius: palette.cardRadius }, shadow(palette, 1)]}>
      <Text style={[ds.statLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[ds.statValue, { color: accent ?? palette.text }]} numberOfLines={1}>{value}</Text>
      {!!sub && <Text style={[ds.statSub, { color: palette.muted }]} numberOfLines={1}>{sub}</Text>}
    </TouchableOpacity>
  )
}

export function GPMascotHero({ title, message, stat }: { title: string; message: string; stat?: string }) {
  const { palette } = useSkin()
  return (
    <View style={[ds.hero, { backgroundColor: palette.greenLight, borderColor: palette.border, borderRadius: palette.cardRadius + 4 }, shadow(palette, 1)]}>
      <View style={ds.heroTextBox}>
        <Text style={[ds.heroEyebrow, { color: palette.green }]}>GogoPar Caddie</Text>
        <Text style={[ds.heroTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[ds.heroMessage, { color: palette.muted }]}>{message}</Text>
        {!!stat && <View style={[ds.heroChip, { backgroundColor: palette.card }]}><Text style={[ds.heroChipText, { color: palette.green }]}>{stat}</Text></View>}
      </View>
      <View style={ds.mascotWrap}>
        <View style={[ds.mascotHead, { borderColor: palette.green, backgroundColor: '#fff' }]}> 
          <View style={ds.mascotEyeRow}><View style={ds.mascotEye} /><View style={ds.mascotEye} /></View>
          <View style={[ds.mascotSmile, { borderColor: palette.green }]} />
        </View>
        <View style={[ds.mascotBody, { backgroundColor: palette.green }]} />
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
  onPress,
}: {
  date: string
  course: string
  status: string
  sub?: string
  award?: string
  actions?: ReactNode
  selected?: boolean
  onPress?: () => void
}) {
  const { palette } = useSkin()
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} disabled={!onPress} style={[ds.ticket, { backgroundColor: palette.card, borderColor: selected ? palette.green : palette.border, borderRadius: palette.cardRadius }, shadow(palette, selected ? 2 : 1)]}>
      <View style={[ds.ticketHole, ds.ticketHoleLeft, { backgroundColor: palette.bg }]} />
      <View style={[ds.ticketHole, ds.ticketHoleRight, { backgroundColor: palette.bg }]} />
      <View style={ds.ticketTop}>
        <View style={{ flex: 1 }}>
          <Text style={[ds.ticketDate, { color: palette.green }]}>{date}</Text>
          <Text style={[ds.ticketCourse, { color: palette.text }]} numberOfLines={1}>{course}</Text>
        </View>
        <View style={[ds.ticketBadge, { backgroundColor: palette.greenLight }]}><Text style={[ds.ticketBadgeText, { color: palette.green }]}>{status}</Text></View>
      </View>
      {!!sub && <Text style={[ds.ticketSub, { color: palette.muted }]}>{sub}</Text>}
      {!!award && <Text style={[ds.ticketAward, { color: palette.muted }]} numberOfLines={2}>{award}</Text>}
      {actions ? <View style={ds.ticketActions}>{actions}</View> : null}
    </TouchableOpacity>
  )
}

const ds = StyleSheet.create({
  card: { borderWidth: 1, padding: 18, marginBottom: 14 },
  section: { marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  button: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  buttonText: { fontSize: 13, fontWeight: '900' },
  statCard: { width: '48.5%', minHeight: 106, borderWidth: 1, padding: 16, justifyContent: 'center' },
  statLabel: { fontSize: 12, fontWeight: '800', marginBottom: 7 },
  statValue: { fontSize: 25, fontWeight: '900', letterSpacing: -0.8 },
  statSub: { fontSize: 11, fontWeight: '600', marginTop: 5 },
  hero: { borderWidth: 1, padding: 18, marginBottom: 16, flexDirection: 'row', overflow: 'hidden' },
  heroTextBox: { flex: 1, paddingRight: 8 },
  heroEyebrow: { fontSize: 12, fontWeight: '900', marginBottom: 6 },
  heroTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.6, marginBottom: 6 },
  heroMessage: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  heroChip: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginTop: 12 },
  heroChipText: { fontSize: 12, fontWeight: '900' },
  mascotWrap: { width: 92, alignItems: 'center', justifyContent: 'center' },
  mascotHead: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  mascotEyeRow: { flexDirection: 'row', gap: 18, marginTop: 2 },
  mascotEye: { width: 7, height: 10, borderRadius: 5, backgroundColor: '#18251d' },
  mascotSmile: { width: 25, height: 12, borderBottomWidth: 3, borderRadius: 20, marginTop: 8 },
  mascotBody: { width: 52, height: 18, borderRadius: 999, marginTop: -4 },
  ticket: { position: 'relative', borderWidth: 1, padding: 16, marginBottom: 12, overflow: 'hidden' },
  ticketHole: { position: 'absolute', top: '50%', width: 22, height: 22, borderRadius: 11, marginTop: -11 },
  ticketHoleLeft: { left: -11 },
  ticketHoleRight: { right: -11 },
  ticketTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ticketDate: { fontSize: 12, fontWeight: '900', marginBottom: 5 },
  ticketCourse: { fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  ticketBadge: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  ticketBadgeText: { fontSize: 11, fontWeight: '900' },
  ticketSub: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  ticketAward: { fontSize: 12, fontWeight: '600', marginTop: 5, lineHeight: 17 },
  ticketActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
})
