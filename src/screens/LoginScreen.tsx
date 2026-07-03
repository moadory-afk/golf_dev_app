import { useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { ensureProfile } from '../lib/store'
import { C } from '../theme'

function nameToEmail(name: string): string {
  const hex = Array.from(name.trim())
    .map((char) => char.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('')
  return `${hex}@gogopar.app`
}

export default function LoginScreen() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function clearError() {
    setErrorMsg(null)
  }

  async function handleLogin() {
    if (!name.trim() || !password) {
      setErrorMsg('이름과 비밀번호를 입력하세요')
      return
    }
    setErrorMsg(null)
    setLoading(true)
    const email = nameToEmail(name)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setErrorMsg(`로그인 실패: ${error.message}`)
    } else if (data.user) {
      try {
        await ensureProfile(data.user.id, name.trim())
      } catch {
        // 로그인은 성공했으므로 프로필 보정 실패는 막지 않습니다.
      }
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Image source={require('../../assets/app-icon-1024.png')} style={s.appIcon} resizeMode="contain" />
          <Text style={s.sub}>골프의 모든 경험을 하나로.</Text>
        </View>

        <View style={s.form}>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={(value) => {
              setName(value)
              clearError()
            }}
            placeholder="이름 입력"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={[s.input, { marginTop: 12 }]}
            value={password}
            onChangeText={(value) => {
              setPassword(value)
              clearError()
            }}
            placeholder="비밀번호"
            secureTextEntry
          />

          {errorMsg ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={s.btnText}>{loading ? '처리 중...' : '로그인'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.signupCard}>
          <Text style={s.signupTitle}>아직 회원이 아니신가요?</Text>
          <Text style={s.signupSub}>회원가입 연결은 다음 단계에서 작업합니다.</Text>
          <View style={s.socialRow}>
            <TouchableOpacity style={[s.socialBtn, s.googleBtn]} activeOpacity={0.86}>
              <Text style={s.googleText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.socialBtn, s.kakaoBtn]} activeOpacity={0.86}>
              <Text style={s.kakaoText}>Kakao</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.socialBtn, s.naverBtn]} activeOpacity={0.86}>
              <Text style={s.naverText}>Naver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  header: { alignItems: 'center', marginBottom: 18 },
  appIcon: { width: 96, height: 96, marginBottom: 12 },
  sub: { fontSize: 14, color: C.muted, marginTop: 6 },
  form: { backgroundColor: C.card, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10, fontSize: 14, color: C.text, backgroundColor: C.bg, marginBottom: 4 },
  errorBox: { backgroundColor: '#fff0f0', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#ffcccc' },
  errorText: { fontSize: 13, color: '#c0392b', lineHeight: 18 },
  btn: { marginTop: 16, backgroundColor: C.green, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  signupCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  signupTitle: { fontSize: 16, fontWeight: '900', color: C.text },
  signupSub: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 6 },
  socialRow: { gap: 8, marginTop: 14 },
  socialBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  kakaoBtn: { backgroundColor: '#fee500' },
  naverBtn: { backgroundColor: '#03c75a' },
  googleText: { fontSize: 12, fontWeight: '900', color: C.text },
  kakaoText: { fontSize: 12, fontWeight: '900', color: '#181600' },
  naverText: { fontSize: 12, fontWeight: '900', color: '#fff' },
})
