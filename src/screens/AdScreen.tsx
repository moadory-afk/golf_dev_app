import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'

const ADS = [
  {
    id: 1,
    bg: '#0d3320',
    accentColor: '#ffffff',
    render: (s: typeof styles) => (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 60, paddingHorizontal: 32 }}>
        {/* Golf ball */}
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <View style={s.ball}>
            <View style={[s.dimpleRow, { marginTop: 28 }]}>
              {[0,1,2,3,4].map(i => <View key={i} style={s.dimple} />)}
            </View>
            <View style={[s.dimpleRow, { marginTop: 10 }]}>
              {[0,1,2,3,4,5].map(i => <View key={i} style={s.dimple} />)}
            </View>
            <View style={[s.dimpleRow, { marginTop: 10 }]}>
              {[0,1,2,3,4].map(i => <View key={i} style={s.dimple} />)}
            </View>
            <View style={s.ballShine} />
          </View>
          <View style={s.ballShadow} />
        </View>

        {/* Text */}
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, letterSpacing: 4, fontWeight: '600' }}>
            2025 TOUR PERFORMANCE
          </Text>
          <Text style={{ color: '#ffffff', fontSize: 48, fontWeight: '900', letterSpacing: -1, textAlign: 'center', lineHeight: 52 }}>
            APEX{'\n'}PRO
          </Text>
          <View style={{ width: 48, height: 3, backgroundColor: '#c9900a', borderRadius: 2, marginVertical: 4 }} />
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, fontWeight: '600', textAlign: 'center', lineHeight: 26 }}>
            로리 맥길로이가 선택한{'\n'}바로 그 볼
          </Text>
          <Text style={{ color: '#c9900a', fontSize: 13, fontWeight: '700', marginTop: 8, letterSpacing: 2 }}>
            APEX-GOLF.COM →
          </Text>
        </View>
      </View>
    ),
  },
  {
    id: 2,
    bg: '#060f1e',
    accentColor: '#c9900a',
    render: (s: typeof styles) => (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 60, paddingHorizontal: 32 }}>
        {/* Top emblem */}
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <View style={s.emblem}>
            <Text style={{ fontSize: 40 }}>⛳</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <View style={{ height: 1, width: 60, backgroundColor: '#c9900a' }} />
            <Text style={{ color: '#c9900a', fontSize: 11, letterSpacing: 4, fontWeight: '700' }}>SINCE 1992</Text>
            <View style={{ height: 1, width: 60, backgroundColor: '#c9900a' }} />
          </View>
        </View>

        {/* Main text */}
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Text style={{ color: '#c9900a', fontSize: 13, letterSpacing: 5, fontWeight: '700' }}>
            PREMIUM MEMBERSHIP
          </Text>
          <Text style={{ color: '#ffffff', fontSize: 34, fontWeight: '900', textAlign: 'center', lineHeight: 42, letterSpacing: -0.5 }}>
            그린힐{'\n'}골프 & 컨트리 클럽
          </Text>
          <View style={{ width: 48, height: 2, backgroundColor: 'rgba(201,144,10,0.4)', marginVertical: 6 }} />
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
            최상의 코스, 완벽한 서비스{'\n'}신규 회원을 모집합니다
          </Text>

          {/* Feature badges */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {['18홀 정규코스', '클럽하우스', '연습장'].map(t => (
              <View key={t} style={{ borderWidth: 1, borderColor: 'rgba(201,144,10,0.5)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ color: '#c9900a', fontSize: 11, fontWeight: '600' }}>{t}</Text>
              </View>
            ))}
          </View>

          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8, letterSpacing: 2 }}>
            GREENHILL-GOLF.CO.KR
          </Text>
        </View>
      </View>
    ),
  },
  {
    id: 3,
    bg: '#0a2218',
    accentColor: '#f0b429',
    render: (_s: typeof styles) => (
      <View style={{ flex: 1, paddingTop: 56, paddingBottom: 40, paddingHorizontal: 28, justifyContent: 'space-between' }}>

        {/* 상단 뱃지 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Text style={{ fontSize: 22 }}>🏌️</Text>
          <View style={{ backgroundColor: '#f0b429', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 }}>
            <Text style={{ color: '#0a2218', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }}>회원 모집 중</Text>
          </View>
          <Text style={{ fontSize: 22 }}>🏌️</Text>
        </View>

        {/* 메인 헤드라인 */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 4, fontWeight: '700', marginBottom: 10 }}>
            GOGOPAR GOLF CLUB
          </Text>
          <Text style={{ color: '#ffffff', fontSize: 38, fontWeight: '900', textAlign: 'center', lineHeight: 48, letterSpacing: -1 }}>
            골프,{'\n'}제대로 즐길{'\n'}분 구합니다 ⛳
          </Text>
        </View>

        {/* 특징 리스트 */}
        <View style={{ gap: 10 }}>
          {[
            { icon: '🤗', title: '가족 같은 분위기',    desc: '첫 라운드부터 금방 친해져요' },
            { icon: '🏆', title: 'PGA 룰 그대로',      desc: '퍼팅도, 드롭도, 진지하게' },
            { icon: '📉', title: '철저한 핸디 관리',    desc: '신페리오 AI 자동 계산' },
            { icon: '🎁', title: '알짤 없는 보상',      desc: '1등은 반드시 챙겨갑니다' },
          ].map((item) => (
            <View key={item.title} style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: 'rgba(255,255,255,0.07)',
              borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
            }}>
              <Text style={{ fontSize: 22, width: 30 }}>{item.icon}</Text>
              <View>
                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>{item.title}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={{
            backgroundColor: '#f0b429', borderRadius: 30,
            paddingHorizontal: 32, paddingVertical: 13,
            shadowColor: '#f0b429', shadowOpacity: 0.4, shadowRadius: 12, elevation: 4,
          }}>
            <Text style={{ color: '#0a2218', fontSize: 15, fontWeight: '900' }}>지금 바로 참여하기 🏌️</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, letterSpacing: 3, fontWeight: '700' }}>GOGOPAR.APP</Text>
        </View>

      </View>
    ),
  },

  // ─── Ad 4: DESCENTE GOLF (크림/라이트) ────────────────────────────────────────
  {
    id: 4,
    bg: '#f5f0e6',
    accentColor: '#a07830',
    render: (_s: typeof styles) => (
      <View style={{ flex: 1, backgroundColor: '#f5f0e6', paddingHorizontal: 32, paddingTop: 52, paddingBottom: 40, justifyContent: 'space-between' }}>
        {/* 시즌 태그 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
          <View style={{ backgroundColor: '#111', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 3 }}>2025 S / S</Text>
          </View>
          <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.12)' }} />
        </View>

        {/* 스윙 비주얼 */}
        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 180, height: 180, borderRadius: 90, borderWidth: 3, borderColor: 'rgba(0,0,0,0.08)', position: 'absolute', borderTopColor: '#a07830', borderRightColor: '#a07830' }}>
            <View style={{ position: 'absolute', top: 16, left: 16, width: 144, height: 144, borderRadius: 72, borderWidth: 1.5, borderColor: 'rgba(160,120,48,0.25)' }} />
          </View>
          <View style={{ width: 3, height: 110, backgroundColor: '#111', borderRadius: 2, transform: [{ rotate: '30deg' }], position: 'absolute' }} />
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#a07830', position: 'absolute', bottom: 44, shadowColor: '#a07830', shadowOpacity: 0.6, shadowRadius: 8, elevation: 4 }} />
          <View style={{ position: 'absolute', bottom: 0, width: 220, height: 2, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 1 }} />
        </View>

        {/* 카피 */}
        <View>
          <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(0,0,0,0.35)', letterSpacing: 5, marginBottom: 10 }}>DESCENTE GOLF</Text>
          <Text style={{ fontSize: 36, fontWeight: '900', color: '#111', lineHeight: 44, letterSpacing: -0.5, marginBottom: 12 }}>움직임이{'\n'}예술이 될 때</Text>
          <View style={{ width: 40, height: 3, backgroundColor: '#a07830', borderRadius: 2, marginBottom: 12 }} />
          <Text style={{ fontSize: 14, color: 'rgba(0,0,0,0.55)', lineHeight: 22, marginBottom: 16 }}>최고의 소재, 완벽한 핏{'\n'}당신의 스윙을 완성합니다</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {['STRETCH FIT', 'UV PROTECT', 'ECO FABRIC'].map((t) => (
              <View key={t} style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(0,0,0,0.45)', letterSpacing: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#a07830', letterSpacing: 2 }}>DESCENTE.CO.KR  →</Text>
        </View>
      </View>
    ),
  },

  // ─── Ad 5: GOLFZONE 스크린골프 (다크 네온) ───────────────────────────────────
  {
    id: 5,
    bg: '#07090f',
    accentColor: '#22d3ee',
    render: (_s: typeof styles) => (
      <View style={{ flex: 1, backgroundColor: '#07090f', paddingHorizontal: 28, paddingTop: 52, paddingBottom: 36, justifyContent: 'space-between' }}>
        {/* 그리드 오버레이 */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          {[0,1,2,3,4].map((i) => (
            <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(34,211,238,0.05)', top: `${i * 25}%` as any }} />
          ))}
        </View>

        {/* HUD 헤더 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' }} />
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700', letterSpacing: 4 }}>SIMULATOR  ON</Text>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22d3ee' }} />
        </View>

        {/* 시뮬레이터 화면 */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(34,211,238,0.2)', padding: 16, gap: 14 }}>
          <View style={{ height: 90, backgroundColor: 'rgba(74,222,128,0.08)', borderRadius: 8, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
            <View style={{ width: 60, height: 70, backgroundColor: 'rgba(74,222,128,0.15)', borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center', paddingTop: 8 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 14, height: 8, backgroundColor: '#ef4444', borderRadius: 1, alignSelf: 'flex-end' }} />
                <View style={{ width: 2, height: 22, backgroundColor: 'rgba(255,255,255,0.7)' }} />
                <View style={{ width: 10, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 5 }} />
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, alignSelf: 'center' }}>
            <Text style={{ fontSize: 36, fontWeight: '900', color: '#22d3ee' }}>214</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: 'rgba(34,211,238,0.6)' }}>m</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[{ l: 'SPEED', v: 92, c: '#22d3ee' }, { l: 'SPIN', v: 74, c: '#a78bfa' }, { l: 'DIR', v: 88, c: '#4ade80' }].map((item) => (
              <View key={item.l} style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>{item.l}</Text>
                <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: item.c, width: `${item.v}%` as any }} />
                </View>
                <Text style={{ fontSize: 11, fontWeight: '800', color: item.c }}>{item.v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 카피 */}
        <View>
          <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.25)', letterSpacing: 3, marginBottom: 10 }}>AI POWERED  ·  REAL COURSE DATA</Text>
          <Text style={{ fontSize: 32, fontWeight: '900', color: '#fff', lineHeight: 40, letterSpacing: -0.5, marginBottom: 12 }}>
            <Text style={{ color: '#22d3ee' }}>어디서든,</Text>{'\n'}실제 코스를{'\n'}경험하다
          </Text>
          <View style={{ width: 32, height: 2, backgroundColor: '#22d3ee', borderRadius: 1, marginBottom: 12 }} />
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20, marginBottom: 18 }}>전국 250개 코스 · AI 스윙 분석{'\n'}나만의 스크린 골프 스튜디오</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ backgroundColor: '#22d3ee', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: '#07090f', fontSize: 13, fontWeight: '800' }}>지금 예약하기</Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.25)', letterSpacing: 2 }}>GOLFZONE.COM</Text>
          </View>
        </View>
      </View>
    ),
  },
]

export default function AdScreen({ onDone }: { onDone: () => void }) {
  const [countdown, setCountdown] = useState(5)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const ad = useRef(ADS[Math.floor(Math.random() * ADS.length)]).current

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: false }).start()

    const done = setTimeout(() => onDoneRef.current(), 5000)
    const interval = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)

    return () => {
      clearTimeout(done)
      clearInterval(interval)
    }
  }, [])

  return (
    <Animated.View style={[styles.container, { backgroundColor: ad.bg, opacity: fadeAnim }]}>
      {ad.render(styles)}

      {/* Skip button */}
      <TouchableOpacity style={styles.skipBtn} onPress={onDone}>
        <Text style={styles.skipText}>
          {countdown > 0 ? `건너뛰기 ${countdown}` : '건너뛰기'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  // Golf ball elements
  ball: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#f8f8f6',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  dimpleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dimple: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(180,180,180,0.45)',
  },
  ballShine: {
    position: 'absolute',
    top: 20,
    left: 28,
    width: 52,
    height: 34,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-20deg' }],
  },
  ballShadow: {
    width: 130,
    height: 20,
    borderRadius: 65,
    backgroundColor: 'rgba(0,0,0,0.35)',
    marginTop: 10,
  },
  // Emblem
  emblem: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(201,144,10,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,144,10,0.08)',
  },
})
