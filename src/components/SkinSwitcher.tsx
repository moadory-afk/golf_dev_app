import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSkin, type SkinId } from '../skins'

const LABELS: Record<SkinId, string> = {
  classic: 'Classic',
  turf: 'Turf',
  cuteGolf: 'Cute',
  premium: 'Premium',
  minimal: 'Minimal',
}

export function SkinSwitcher({ compact = false }: { compact?: boolean }) {
  const { skinId, skins, setSkinId, palette } = useSkin()

  return (
    <View style={[s.wrap, compact && s.compactWrap, { backgroundColor: palette.card, borderColor: palette.border, borderRadius: compact ? 999 : palette.cardRadius }]}>
      {!compact ? (
        <View style={s.header}>
          <Text style={[s.title, { color: palette.text }]}>테마</Text>
          <Text style={[s.sub, { color: palette.muted }]}>화면 스타일 선택</Text>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.row, compact && s.compactRow]}>
        {skins.map((skin) => {
          const active = skin.id === skinId
          return (
            <TouchableOpacity
              key={skin.id}
              activeOpacity={0.82}
              onPress={() => setSkinId(skin.id)}
              style={[
                s.chip,
                compact && s.compactChip,
                {
                  backgroundColor: active ? palette.accent : palette.greenLight,
                  borderColor: active ? palette.green : palette.border,
                },
              ]}
            >
              <Text style={[s.chipText, { color: active ? palette.accentText : palette.green }]}>{compact ? LABELS[skin.id].slice(0, 1) : LABELS[skin.id]}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    paddingVertical: 12,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  compactWrap: { paddingVertical: 4, marginBottom: 0, maxWidth: 132 },
  header: { paddingHorizontal: 14, marginBottom: 8 },
  title: { fontSize: 14, fontWeight: '900' },
  sub: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  row: { paddingHorizontal: 14, gap: 8 },
  compactRow: { paddingHorizontal: 5, gap: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  compactChip: { paddingHorizontal: 8, paddingVertical: 6, minWidth: 28, alignItems: 'center' },
  chipText: { fontSize: 12, fontWeight: '900' },
})
