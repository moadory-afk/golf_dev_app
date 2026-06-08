/**
 * 광고 프리뷰 2 — 스크린골프 시뮬레이터 (다크 네온 테마)
 * ※ AdScreen에 아직 반영되지 않은 시안입니다.
 */
import { View, Text, StyleSheet } from 'react-native'

export default function AdPreview2() {
  return (
    <View style={s.container}>

      {/* 건너뛰기 자리 표시 */}
      <View style={s.skipPlaceholder}>
        <Text style={s.skipText}>건너뛰기 5</Text>
      </View>

      {/* 배경 그리드 라인 (HUD 느낌) */}
      <View style={s.gridOverlay} pointerEvents="none">
        {[0,1,2,3,4].map((i) => (
          <View key={i} style={[s.gridLine, { top: `${i * 25}%` as any }]} />
        ))}
        {[0,1,2,3,4].map((i) => (
          <View key={i} style={[s.gridLineV, { left: `${i * 25}%` as any }]} />
        ))}
      </View>

      {/* 상단 HUD 헤더 */}
      <View style={s.hudHeader}>
        <View style={s.hudDot} />
        <Text style={s.hudLabel}>SIMULATOR  ON</Text>
        <View style={[s.hudDot, { backgroundColor: CYAN }]} />
      </View>

      {/* 중앙 비주얼: 시뮬레이터 화면 */}
      <View style={s.screen}>
        {/* 코스 원근감 (사다리꼴) */}
        <View style={s.fairwayOuter}>
          <View style={s.fairwayInner}>
            {/* 홀 핀 */}
            <View style={s.pin}>
              <View style={s.pinFlag} />
              <View style={s.pinStick} />
              <View style={s.pinBase} />
            </View>
          </View>
        </View>
        {/* 거리 HUD */}
        <View style={s.distanceBadge}>
          <Text style={s.distanceNum}>214</Text>
          <Text style={s.distanceUnit}>m</Text>
        </View>
        {/* 스윙 분석 바 */}
        <View style={s.analysisRow}>
          {[
            { label: 'SPEED', val: 92, color: CYAN },
            { label: 'SPIN',  val: 74, color: PURPLE },
            { label: 'DIR',   val: 88, color: GREEN },
          ].map((item) => (
            <View key={item.label} style={s.analysisCol}>
              <Text style={s.analysisLabel}>{item.label}</Text>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${item.val}%` as any, backgroundColor: item.color }]} />
              </View>
              <Text style={[s.analysisVal, { color: item.color }]}>{item.val}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 하단 카피 */}
      <View style={s.copy}>
        <Text style={s.subLabel}>AI POWERED  ·  REAL COURSE DATA</Text>
        <Text style={s.headline}>
          <Text style={{ color: CYAN }}>어디서든,</Text>
          {'\n'}실제 코스를{'\n'}경험하다
        </Text>
        <View style={s.divider} />
        <Text style={s.body}>전국 250개 코스 · AI 스윙 분석{'\n'}나만의 스크린 골프 스튜디오</Text>
        <View style={s.ctaRow}>
          <View style={s.ctaBtn}>
            <Text style={s.ctaBtnText}>지금 예약하기</Text>
          </View>
          <Text style={s.ctaLink}>GOLFZONE.COM</Text>
        </View>
      </View>

    </View>
  )
}

const BG     = '#07090f'
const CYAN   = '#22d3ee'
const PURPLE = '#a78bfa'
const GREEN  = '#4ade80'

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },
  skipPlaceholder: {
    position: 'absolute', top: 52, right: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  skipText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600' },

  // 배경 그리드
  gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  gridLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(34,211,238,0.05)',
  },
  gridLineV: {
    position: 'absolute', top: 0, bottom: 0, width: 1,
    backgroundColor: 'rgba(34,211,238,0.05)',
  },

  // HUD 헤더
  hudHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
  },
  hudDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN,
    shadowColor: GREEN, shadowOpacity: 0.8, shadowRadius: 4, elevation: 2,
  },
  hudLabel: {
    color: 'rgba(255,255,255,0.3)', fontSize: 10,
    fontWeight: '700', letterSpacing: 4,
  },

  // 시뮬레이터 화면
  screen: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.2)',
    padding: 16,
    gap: 14,
  },
  fairwayOuter: {
    height: 90,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fairwayInner: {
    width: 60, height: 70,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  pin: { alignItems: 'center' },
  pinFlag: {
    width: 14, height: 8,
    backgroundColor: '#ef4444',
    borderRadius: 1,
    alignSelf: 'flex-end',
  },
  pinStick: { width: 2, height: 22, backgroundColor: 'rgba(255,255,255,0.7)' },
  pinBase: {
    width: 10, height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 5,
  },
  distanceBadge: {
    flexDirection: 'row', alignItems: 'baseline',
    gap: 2, alignSelf: 'center',
  },
  distanceNum: {
    fontSize: 36, fontWeight: '900', color: CYAN,
    shadowColor: CYAN, shadowOpacity: 0.5, shadowRadius: 8, elevation: 3,
  },
  distanceUnit: { fontSize: 16, fontWeight: '600', color: 'rgba(34,211,238,0.6)' },
  analysisRow: { flexDirection: 'row', gap: 10 },
  analysisCol: { flex: 1, gap: 4 },
  analysisLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1 },
  barBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  analysisVal: { fontSize: 11, fontWeight: '800' },

  // 카피
  copy: { gap: 0 },
  subLabel: {
    fontSize: 9, fontWeight: '700',
    color: 'rgba(255,255,255,0.25)', letterSpacing: 3,
    marginBottom: 10,
  },
  headline: {
    fontSize: 32, fontWeight: '900',
    color: '#ffffff', lineHeight: 40,
    letterSpacing: -0.5, marginBottom: 12,
  },
  divider: {
    width: 32, height: 2,
    backgroundColor: CYAN,
    borderRadius: 1, marginBottom: 12,
    shadowColor: CYAN, shadowOpacity: 0.7, shadowRadius: 6, elevation: 2,
  },
  body: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)',
    lineHeight: 20, marginBottom: 18,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ctaBtn: {
    backgroundColor: CYAN, borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 10,
    shadowColor: CYAN, shadowOpacity: 0.4, shadowRadius: 12, elevation: 4,
  },
  ctaBtnText: { color: BG, fontSize: 13, fontWeight: '800' },
  ctaLink: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.25)', letterSpacing: 2 },
})
