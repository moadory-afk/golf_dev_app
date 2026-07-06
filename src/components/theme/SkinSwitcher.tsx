import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSkin, type SkinId } from '../../skins'

type SkinSwitcherProps = {
  compact?: boolean
}

export function SkinSwitcher({ compact = false }: SkinSwitcherProps) {
  const { skins, skinId, setSkinId, palette } = useSkin()

  async function handleSelect(id: SkinId) {
    await setSkinId(id)
  }

  return (
    <View style={[
      styles.wrap,
      {
        backgroundColor: palette.card,
        borderColor: palette.border,
        borderRadius: palette.cardRadius,
        shadowOpacity: palette.shadowOpacity,
      },
      compact && styles.compactWrap,
    ]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.eyebrow, { color: palette.green }]}>Theme System</Text>
          <Text style={[styles.title, { color: palette.text }]}>화면 스타일</Text>
        </View>
        <Text style={[styles.current, { color: palette.muted }]}>{skins.find((item) => item.id === skinId)?.name}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {skins.map((skin) => {
          const active = skin.id === skinId
          return (
            <TouchableOpacity
              key={skin.id}
              activeOpacity={0.82}
              onPress={() => handleSelect(skin.id)}
              style={[
                styles.item,
                {
                  borderColor: active ? palette.accent : palette.border,
                  backgroundColor: active ? palette.greenLight : palette.card,
                },
              ]}
            >
              <View style={styles.swatches}>
                <View style={[styles.swatch, { backgroundColor: skin.palette.headerBg }]} />
                <View style={[styles.swatch, { backgroundColor: skin.palette.accent }]} />
                <View style={[styles.swatch, { backgroundColor: skin.palette.bg }]} />
              </View>
              <Text style={[styles.itemName, { color: active ? palette.green : palette.text }]}>{skin.name}</Text>
              {!compact && <Text style={[styles.itemDesc, { color: palette.muted }]} numberOfLines={2}>{skin.description}</Text>}
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

export default SkinSwitcher

const styles = StyleSheet.create({
  wrap: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  compactWrap: { padding: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginBottom: 3 },
  title: { fontSize: 15, fontWeight: '900' },
  current: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  list: { gap: 8, paddingRight: 2 },
  item: { width: 112, borderWidth: 1.5, borderRadius: 14, padding: 10 },
  swatches: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  itemName: { fontSize: 12, fontWeight: '900' },
  itemDesc: { fontSize: 10, lineHeight: 14, marginTop: 3 },
})
