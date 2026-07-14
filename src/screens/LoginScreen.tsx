import { useEffect, useState } from 'react';

import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/store';
import { authEmailsForName } from '../lib/authEmail';
import { C } from '../theme';


function getSocialUserName(user: { email?: string | null; user_metadata?: Record<string, unknown> }): string {
  const metadata = user.user_metadata ?? {}
  const candidates = [metadata.full_name, metadata.name, metadata.user_name, metadata.nickname]
  const socialName = candidates.find((value) => typeof value === 'string' && value.trim().length > 0)

  if (typeof socialName === 'string') return socialName.trim()
  return user.email?.split('@')[0] ?? 'GogoPar 회원'
}

export default function LoginScreen({ navigation }: { navigation: any }) {

  const [name, setName] = useState('');
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function clearError() {
    setErrorMsg(null)
  }

  useEffect(() => {
    let active = true

    async function completeSocialLogin(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
      try {
        await ensureProfile(user.id, getSocialUserName(user))
      } catch {
        // 로그인은 성공했으므로 프로필 보정 실패는 막지 않습니다.
      }

      if (active) {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] })
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) completeSocialLogin(session.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        completeSocialLogin(session.user)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [navigation])

  async function handleGoogleLogin() {
    if (Platform.OS !== 'web') {
      setErrorMsg('현재 Google 로그인은 웹 버전에서 사용할 수 있습니다.')
      return
    }

    setErrorMsg(null)
    setLoading(true)

    const redirectTo = window.location.origin
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })

    if (error) {
      setLoading(false)
      setErrorMsg(`Google 로그인 실패: ${error.message}`)
    }
  }


  async function handleKakaoLogin() {
    if (Platform.OS !== 'web') {
      setErrorMsg('현재 Kakao 로그인은 웹 버전에서 사용할 수 있습니다.')
      return
    }

    setErrorMsg(null)
    setLoading(true)

    const redirectTo = window.location.origin
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo },
    })

    if (error) {
      setLoading(false)
      setErrorMsg(`Kakao 로그인 실패: ${error.message}`)
    }
  }

  async function handleLogin() {
    if (!name.trim() || !password) {
      setErrorMsg('이름과 비밀번호를 입력하세요')
      return
    }
    setErrorMsg(null)
    setLoading(true)
    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'] | null = null
    let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error'] | null = null
    for (const email of authEmailsForName(name)) {
      const result = await supabase.auth.signInWithPassword({ email, password })
      data = result.data
      error = result.error
      if (!result.error) break
    }
    setLoading(false)
    if (error) {
      setErrorMsg(`로그인 실패: ${error.message}`)
    } else if (data?.user) {
      try {
        await ensureProfile(data.user.id, name.trim())
      } catch {
        // 로그인은 성공했으므로 프로필 보정 실패는 막지 않습니다.
      }
      navigation.navigate('Main')
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

          <View style={s.dividerRow}>
            <View style={s.divider} />
            <Text style={s.dividerText}>간편 로그인</Text>
            <View style={s.divider} />
          </View>

          <TouchableOpacity
            style={[s.socialBtn, s.googleBtn, loading && s.btnDisabled]}
            onPress={handleGoogleLogin}
            disabled={loading}
            activeOpacity={0.86}
          >
            <AntDesign name="google" size={20} color="#4285F4" />
            <Text style={s.googleBtnText}>Google로 계속하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.socialBtn, s.kakaoBtn, loading && s.btnDisabled]}
            disabled={true}
            activeOpacity={0.86}
          >
            <Text style={s.kakaoMark}>💬</Text>
            <Text style={s.kakaoBtnText}>카카오(준비중)</Text>
          </TouchableOpacity>
        </View>

        <View style={s.signupCard}>
          <Text style={s.signupTitle}>아직 회원이 아니신가요?</Text>
          <Text style={s.signupSub}>회원가입을 위해 아래 버튼을 눌러 주세요.</Text>
          <TouchableOpacity style={s.signupBtn} onPress={() => navigation.navigate('SignUp')} activeOpacity={0.86}>
            <Text style={s.signupBtnText}>회원가입</Text>
          </TouchableOpacity>
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
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10, fontSize: 16, color: C.text, backgroundColor: C.bg, marginBottom: 4 },
  errorBox: { backgroundColor: '#fff0f0', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#ffcccc' },
  errorText: { fontSize: 13, color: '#c0392b', lineHeight: 18 },
  btn: { marginTop: 16, backgroundColor: C.green, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  signupCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  signupTitle: { fontSize: 16, fontWeight: '900', color: C.text },
  signupSub: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  divider: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: C.muted },
  socialBtn: { borderRadius: 12, minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  googleBtnText: { color: C.text, fontWeight: '700', fontSize: 14 },
  kakaoBtn: { marginTop: 10, backgroundColor: '#FEE500' },
  kakaoMark: { fontSize: 18 },
  kakaoBtnText: { color: '#191919', fontWeight: '700', fontSize: 14 },
  signupBtn: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  signupBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
