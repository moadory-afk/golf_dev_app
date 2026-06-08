import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { useState } from 'react'
import { C } from '../theme'
import LoginScreen from './LoginScreen'

export default function PromoScreen({ onDismiss }: { onDismiss: () => void }) {
  const [showLogin, setShowLogin] = useState(false)

  if (showLogin) return <LoginScreen />

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scroll}>

      {/* 헤더 */}
      <View style={s.hero}>
        <Text style={s.heroEmoji}>⛳</Text>
        <Text style={s.heroTitle}>GogoPar</Text>
        <Text style={s.heroSub}>우리 골프 클럽의 스코어 관리</Text>
      </View>

      {/* CTA - 히어로 바로 아래 */}
      <View style={s.ctaSection}>
        <TouchableOpacity style={s.ctaBtn} onPress={() => setShowLogin(true)}>
          <Text style={s.ctaBtnText}>⛳ 무료로 시작하기</Text>
        </TouchableOpacity>
        <Text style={s.ctaNote}>가입비 없음 · 언제든 무료 사용</Text>
      </View>

      {/* 기능 소개 */}
      <View style={s.featuresCard}>
        <Text style={s.featuresTitle}>주요 기능</Text>
        {[
          { icon: '📸', title: '사진으로 스코어 입력', desc: 'AI가 스코어카드 타수를 자동 인식' },
          { icon: '🏆', title: '실시간 순위 및 통계', desc: '핸디캡·버디 등 다양한 통계 한눈에' },
          { icon: '📊', title: '개인 성적 추이', desc: '평균 타수 변화를 그래프로 확인' },
          { icon: '🏌️', title: '신페리오 자동 계산', desc: '공정한 핸디캡으로 즐거운 경기' },
          { icon: '👥', title: '클럽 멤버 관리', desc: '초대 링크로 멤버를 쉽게 추가' },
        ].map((f) => (
          <View key={f.title} style={s.featureRow}>
            <Text style={s.featureIcon}>{f.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={s.dismissBtn} onPress={onDismiss}>
        <Text style={s.dismissBtnText}>나중에</Text>
      </TouchableOpacity>

    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f6' },
  scroll: { paddingBottom: 40 },

  hero: {
    backgroundColor: C.greenDark, alignItems: 'center',
    paddingTop: 50, paddingBottom: 32, paddingHorizontal: 24,
  },
  heroEmoji: { fontSize: 56, marginBottom: 10 },
  heroTitle: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 6, textAlign: 'center' },

  ctaSection: {
    backgroundColor: '#fff', paddingVertical: 24, paddingHorizontal: 20,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  ctaBtn: {
    backgroundColor: C.green, borderRadius: 50, paddingVertical: 16,
    paddingHorizontal: 40, alignItems: 'center', width: '100%',
    shadowColor: C.green, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  ctaBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  ctaNote: { color: '#999', fontSize: 13, marginTop: 10 },

  featuresCard: {
    backgroundColor: '#fff', margin: 14, borderRadius: 18,
    padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  featuresTitle: { fontSize: 14, fontWeight: '700', color: C.muted, marginBottom: 12, letterSpacing: 0.5 },
  featureRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  featureIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  featureTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  featureDesc: { fontSize: 12, color: '#888', lineHeight: 17 },

  dismissBtn: { paddingVertical: 14, alignItems: 'center' },
  dismissBtnText: { color: '#bbb', fontSize: 13 },
})
