/**
 * 광고 프리뷰 1 — 골프 의류 브랜드 (크림/라이트 테마)
 * ※ AdScreen에 아직 반영되지 않은 시안입니다.
 */
import { View, Text, StyleSheet } from 'react-native'

export default function AdPreview1() {
  return (
    <View style={s.container}>

      {/* 건너뛰기 자리 표시 */}
      <View style={s.skipPlaceholder}>
        <Text style={s.skipText}>건너뛰기 5</Text>
      </View>

      {/* 상단: 시즌 태그 */}
      <View style={s.topRow}>
        <View style={s.seasonTag}>
          <Text style={s.seasonText}>2025 S / S</Text>
        </View>
        <View style={s.line} />
      </View>

      {/* 중앙 비주얼: 스윙 실루엣 (도형 조합) */}
      <View style={s.visual}>
        {/* 스윙 호 */}
        <View style={s.arcOuter}>
          <View style={s.arcInner} />
        </View>
        {/* 클럽 샤프트 */}
        <View style={s.shaft} />
        {/* 볼 임팩트 */}
        <View style={s.impactDot} />
        {/* 잔디선 */}
        <View style={s.grass} />
      </View>

      {/* 하단 카피 */}
      <View style={s.copy}>
        <Text style={s.brandName}>DESCENTE GOLF</Text>
        <Text style={s.headline}>움직임이{'\n'}예술이 될 때</Text>
        <View style={s.divider} />
        <Text style={s.body}>
          최고의 소재, 완벽한 핏{'\n'}
          당신의 스윙을 완성합니다
        </Text>
        <View style={s.badges}>
          {['STRETCH FIT', 'UV PROTECT', 'ECO FABRIC'].map((t) => (
            <View key={t} style={s.badge}>
              <Text style={s.badgeText}>{t}</Text>
            </View>
          ))}
        </View>
        <Text style={s.cta}>DESCENTE.CO.KR  →</Text>
      </View>

    </View>
  )
}

const CREAM = '#f5f0e6'
const BLACK = '#111111'
const GOLD  = '#a07830'

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM,
    paddingHorizontal: 32,
    paddingTop: 52,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  skipPlaceholder: {
    position: 'absolute', top: 52, right: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)',
  },
  skipText: { color: 'rgba(0,0,0,0.45)', fontSize: 13, fontWeight: '600' },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  seasonTag: {
    backgroundColor: BLACK, borderRadius: 4,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  seasonText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 3 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.12)' },

  // 스윙 비주얼
  visual: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcOuter: {
    width: 180, height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.08)',
    position: 'absolute',
    borderTopColor: GOLD,
    borderRightColor: GOLD,
  },
  arcInner: {
    position: 'absolute',
    top: 16, left: 16,
    width: 144, height: 144,
    borderRadius: 72,
    borderWidth: 1.5,
    borderColor: 'rgba(160,120,48,0.25)',
  },
  shaft: {
    width: 3, height: 110,
    backgroundColor: BLACK,
    borderRadius: 2,
    transform: [{ rotate: '30deg' }],
    position: 'absolute',
  },
  impactDot: {
    width: 18, height: 18,
    borderRadius: 9,
    backgroundColor: GOLD,
    position: 'absolute',
    bottom: 44, left: '50%',
    shadowColor: GOLD,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  grass: {
    position: 'absolute',
    bottom: 0,
    width: 220, height: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 1,
  },

  // 카피
  copy: { gap: 0 },
  brandName: {
    fontSize: 11, fontWeight: '800',
    color: 'rgba(0,0,0,0.35)',
    letterSpacing: 5,
    marginBottom: 10,
  },
  headline: {
    fontSize: 36, fontWeight: '900',
    color: BLACK,
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  divider: {
    width: 40, height: 3,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginBottom: 12,
  },
  body: {
    fontSize: 14, color: 'rgba(0,0,0,0.55)',
    lineHeight: 22,
    marginBottom: 16,
  },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  badge: {
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: 'rgba(0,0,0,0.45)', letterSpacing: 1 },
  cta: { fontSize: 12, fontWeight: '800', color: GOLD, letterSpacing: 2 },
})
