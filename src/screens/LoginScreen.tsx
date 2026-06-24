import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { supabase } from '../lib/supabase'
import { ensureProfile } from '../lib/store'
import { C } from '../theme'

// 이름을 내부 이메일로 변환 (사용자에게 노출 안 됨)
// 한글 등 유니코드를 hex로 인코딩하여 유효한 이메일 형식 생성
function nameToEmail(name: string): string {
  const hex = Array.from(name.trim())
    .map(c => c.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('')
  return `${hex}@gogopar.app`
}

function showMessage(title: string, message?: string) {
  if (Platform.OS === 'web') {
    // window.alert이 차단되는 환경(카카오 인앱브라우저)에서도 동작하도록 별도 처리 없이 리턴 값으로 처리
    // 이 함수 대신 인라인 에러 상태를 사용할 것
  } else {
    Alert.alert(title, message)
  }
}

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function clearError() { setErrorMsg(null) }

  async function handleLogin() {
    if (!name.trim() || !password) {
      setErrorMsg('이름과 비밀번호를 입력하세요.')
      return
    }
    setErrorMsg(null)
    setLoading(true)
    const email = nameToEmail(name)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setErrorMsg(`실패: ${email}\n${error.message}`)
    } else if (data.user) {
      try { await ensureProfile(data.user.id, name.trim()) } catch { /* 무시 */ }
    }
  }

  async function handleSignUp() {
    if (!name.trim()) { setErrorMsg('이름을 입력하세요.'); return }
    if (password.length < 4) { setErrorMsg('비밀번호는 4자 이상이어야 합니다.'); return }
    setErrorMsg(null)
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: nameToEmail(name),
      password,
      options: { data: { name: name.trim() } },
    })
    setLoading(false)
    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        setErrorMsg('이미 사용 중인 이름입니다. 다른 이름을 사용하세요.')
      } else {
        setErrorMsg(`가입 실패: ${error.message}`)
      }
    } else if (data.session && data.user) {
      try { await ensureProfile(data.user.id, name.trim()) } catch { /* 무시 */ }
    } else {
      Alert.alert(
        'Supabase 설정 필요',
        'Supabase 대시보드 → Authentication → Sign In / Providers → Email → "Confirm email" 을 OFF 로 꺼주세요.',
      )
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <Text style={s.logo}>⛳</Text>
        <Text style={s.title}>Let's GogoPar</Text>
        <Text style={s.sub}>골프 스코어 관리</Text>
      </View>

      <View style={s.form}>
        {/* 탭 */}
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, mode === 'login' && s.tabActive]} onPress={() => { setMode('login'); clearError() }}>
            <Text style={[s.tabText, mode === 'login' && s.tabTextActive]}>로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, mode === 'signup' && s.tabActive]} onPress={() => { setMode('signup'); clearError() }}>
            <Text style={[s.tabText, mode === 'signup' && s.tabTextActive]}>회원가입</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>이름</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={(v) => { setName(v); clearError() }}
          placeholder="이름 입력"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[s.label, { marginTop: 12 }]}>비밀번호</Text>
        <TextInput
          style={s.input}
          value={password}
          onChangeText={(v) => { setPassword(v); clearError() }}
          placeholder={mode === 'signup' ? '4자 이상' : '비밀번호'}
          secureTextEntry
        />

        {errorMsg && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.btn, loading && s.btnDisabled]}
          onPress={mode === 'login' ? handleLogin : handleSignUp}
          disabled={loading}
        >
          <Text style={s.btnText}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: C.green },
  sub: { fontSize: 14, color: C.muted, marginTop: 4 },
  form: { backgroundColor: C.card, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  tabs: { flexDirection: 'row', marginBottom: 20, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: C.bg },
  tabActive: { backgroundColor: C.green },
  tabText: { fontSize: 14, fontWeight: '600', color: C.muted },
  tabTextActive: { color: '#fff' },
  label: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10, fontSize: 14, color: C.text, backgroundColor: C.bg, marginBottom: 4 },
  errorBox: { backgroundColor: '#fff0f0', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#ffcccc' },
  errorText: { fontSize: 13, color: '#c0392b', lineHeight: 18 },
  btn: { marginTop: 16, backgroundColor: C.green, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
