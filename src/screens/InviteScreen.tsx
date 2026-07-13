import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, Share,
} from 'react-native'
import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { joinClub, getClubByInviteCode, ensureProfile } from '../lib/store'
import { authEmailsForName, nameToAuthEmail } from '../lib/authEmail'
import { C } from '../theme'
import { Icon } from '../components/Icon'

const APP_URL = 'https://golf-seven-psi.vercel.app'

interface Props {
  joinCode: string
  onJoined: () => void
  onDismiss: () => void
}

export default function InviteScreen({ joinCode, onJoined, onDismiss }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [club, setClub] = useState<{ name: string; subtitle: string } | null>(null)
  const [loadingClub, setLoadingClub] = useState(true)
  const [joining, setJoining] = useState(false)

  // 로그인/회원가입 폼
  const [authMode, setAuthMode] = useState<'select' | 'login' | 'signup'>('select')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    getClubByInviteCode(joinCode)
      .then(setClub)
      .finally(() => setLoadingClub(false))
  }, [joinCode])

  async function handleJoin() {
    setJoining(true)
    try {
      await joinClub(joinCode)
      onJoined()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('이미')) { onJoined(); return }
      Alert.alert('참여 실패', msg)
    } finally {
      setJoining(false)
    }
  }

  async function handleGoogleLogin() {
    if (Platform.OS !== 'web') {
      Alert.alert('안내', '현재 Google 로그인은 웹 버전에서 사용할 수 있습니다.')
      return
    }
    setAuthLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    })
    if (error) {
      setAuthLoading(false)
      Alert.alert('Google 로그인 실패', error.message)
    }
  }

  async function handleKakaoLogin() {
    if (Platform.OS !== 'web') {
      Alert.alert('안내', '현재 Kakao 로그인은 웹 버전에서 사용할 수 있습니다.')
      return
    }
    setAuthLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.href },
    })
    if (error) {
      setAuthLoading(false)
      Alert.alert('Kakao 로그인 실패', error.message)
    }
  }

  async function handleLogin() {
    if (!name.trim() || !password) { Alert.alert('이름과 비밀번호를 입력하세요.'); return }
    setAuthLoading(true)
    try {
      let lastError: unknown = null
      let signedIn = false
      for (const email of authEmailsForName(name)) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        lastError = error
        if (!error) {
          signedIn = true
          break
        }
      }
      if (!signedIn && lastError) Alert.alert('로그인 실패', '이름 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignUp() {
    if (!name.trim()) { Alert.alert('이름을 입력하세요.'); return }
    if (password.length < 6) { Alert.alert('비밀번호는 6자리 이상이어야 합니다.'); return }
    setAuthLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: nameToAuthEmail(name), password,
        options: { data: { name: name.trim() } },
      })
      if (error) {
        Alert.alert('가입 실패', error.message)
        return
      }
      // 프로필 저장 실패해도 가입은 진행
      if (data.user) {
        try { await ensureProfile(data.user.id, name.trim()) } catch { /* 무시 */ }
      }
      setShowInstallGuide(true)
    } finally {
      setAuthLoading(false)
    }
  }

  async function shareInstallLink() {
    const message = [
      'GogoPar 앱 설치 안내',
      '',
      club ? `${club.name} 클럽에 참여하려면 아래 링크를 열어주세요.` : '아래 링크를 열고 홈 화면에 추가해 사용하세요.',
      APP_URL,
    ].join('\n')
    try {
      await Share.share({ title: 'GogoPar 앱 설치 안내', message })
    } catch {
      Alert.alert('공유 실패', message)
    }
  }

  const installSteps = Platform.OS === 'ios'
    ? ['Safari에서 접속', '공유 버튼 선택', '홈 화면에 추가']
    : Platform.OS === 'android'
      ? ['Chrome에서 접속', '메뉴 선택', '앱 설치 또는 홈 화면에 추가']
      : ['모바일 브라우저에서 접속', '브라우저 메뉴 선택', '홈 화면에 추가']

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* 초대 카드 */}
        <View style={s.inviteCard}>
          <View style={s.golf}><Icon name="flag" size={46} color={C.green} strokeWidth={1.6} /></View>
          {loadingClub ? (
            <ActivityIndicator color={C.green} style={{ marginVertical: 12 }} />
          ) : club ? (
            <>
              <Text style={s.clubName}>{club.name}</Text>
              {club.subtitle ? <Text style={s.clubSub}>{club.subtitle}</Text> : null}
            </>
          ) : (
            <Text style={s.clubName}>골프 클럽</Text>
          )}
          <View style={s.divider} />
          <Text style={s.inviteMsg}>골프 클럽에 초대합니다 🏌️</Text>
        </View>

        {/* 로그인 상태 → 수락 버튼 */}
        {showInstallGuide ? (
          <View style={s.section}>
            <Text style={s.installTitle}>회원가입이 완료되었습니다</Text>
            <Text style={s.sectionTitle}>홈 화면에 추가하면 앱처럼 사용할 수 있습니다.</Text>
            {installSteps.map((step, index) => (
              <View key={step} style={s.stepRow}>
                <Text style={s.stepNo}>{index + 1}</Text>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[s.btnPrimary, joining && { opacity: 0.6 }, { marginTop: 14 }]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimaryText}>클럽 참여 계속하기</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSecondaryInstall} onPress={shareInstallLink}>
              <Text style={s.btnSecondaryInstallText}>설치 링크 공유하기</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' ? (
              <TouchableOpacity style={s.btnGhost} onPress={() => Linking.openURL(APP_URL)}>
                <Text style={s.btnGhostText}>설치 페이지 열기</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : session ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {session.user.user_metadata?.name ?? session.user.email}님, 반갑습니다!
            </Text>
            <TouchableOpacity
              style={[s.btnPrimary, joining && { opacity: 0.6 }]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimaryText}>✅ 수락하고 참여하기</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.btnGhost} onPress={onDismiss}>
              <Text style={s.btnGhostText}>거절</Text>
            </TouchableOpacity>
          </View>
        ) : authMode === 'select' ? (
          /* 비로그인 → 선택 화면 */
          <View style={s.section}>
            <Text style={s.sectionTitle}>참여하려면 로그인이 필요합니다</Text>
            <TouchableOpacity style={s.btnPrimary} onPress={() => setAuthMode('login')}>
              <Text style={s.btnPrimaryText}>로그인하고 참여</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnSecondary, { marginTop: 10 }]} onPress={() => setAuthMode('signup')}>
              <Text style={s.btnSecondaryText}>회원가입하고 참여</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnGhost} onPress={onDismiss}>
              <Text style={s.btnGhostText}>나중에</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* 로그인 / 회원가입 폼 */
          <View style={s.section}>
            <View style={s.tabs}>
              <TouchableOpacity style={[s.tab, authMode === 'login' && s.tabActive]} onPress={() => setAuthMode('login')}>
                <Text style={[s.tabText, authMode === 'login' && s.tabTextActive]}>로그인</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.tab, authMode === 'signup' && s.tabActive]} onPress={() => setAuthMode('signup')}>
                <Text style={[s.tabText, authMode === 'signup' && s.tabTextActive]}>회원가입</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.inputLabel}>이름</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="이름 입력" autoCapitalize="none" />
            <Text style={s.inputLabel}>비밀번호</Text>
            <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder={authMode === 'signup' ? '6자리 이상' : '비밀번호'} secureTextEntry />
            <TouchableOpacity
              style={[s.btnPrimary, authLoading && { opacity: 0.6 }]}
              onPress={authMode === 'login' ? handleLogin : handleSignUp}
              disabled={authLoading}
            >
              {authLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimaryText}>{authMode === 'login' ? '로그인' : '가입하기'}</Text>}
            </TouchableOpacity>
            <View style={s.socialBlock}>
              <Text style={s.socialTitle}>간편 로그인으로 참여</Text>
              <TouchableOpacity style={s.googleBtn} onPress={handleGoogleLogin} disabled={authLoading}>
                <Text style={s.googleBtnText}>Google로 계속하기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.kakaoBtn} onPress={handleKakaoLogin} disabled={authLoading}>
                <Text style={s.kakaoBtnText}>카카오로 계속하기</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.btnGhost} onPress={() => setAuthMode('select')}>
              <Text style={s.btnGhostText}>← 뒤로</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f6' },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },

  inviteCard: {
    backgroundColor: C.card, borderRadius: 24, padding: 28,
    alignItems: 'center', marginBottom: 20,
    shadowColor: C.green, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4,
    borderWidth: 2, borderColor: C.greenLight,
  },
  golf: { fontSize: 52, marginBottom: 10 },
  clubName: { fontSize: 24, fontWeight: '800', color: C.text, textAlign: 'center' },
  clubSub: { fontSize: 14, color: C.muted, marginTop: 4, textAlign: 'center' },
  divider: { width: 40, height: 2, backgroundColor: C.greenLight, borderRadius: 1, marginVertical: 14 },
  inviteMsg: { fontSize: 15, color: C.green, fontWeight: '600' },

  section: { backgroundColor: C.card, borderRadius: 20, padding: 20 },
  sectionTitle: { fontSize: 14, color: C.muted, textAlign: 'center', marginBottom: 16 },

  btnPrimary: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 15, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnSecondary: { backgroundColor: C.greenLight, borderRadius: 50, paddingVertical: 15, alignItems: 'center' },
  btnSecondaryText: { color: C.green, fontWeight: '700', fontSize: 16 },
  btnGhost: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  btnGhostText: { color: C.muted, fontSize: 14 },

  tabs: { flexDirection: 'row', marginBottom: 16, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#f8f8f8' },
  tabActive: { backgroundColor: C.green },
  tabText: { fontSize: 14, fontWeight: '600', color: C.muted },
  tabTextActive: { color: '#fff' },
  inputLabel: { fontSize: 12, color: C.muted, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 11, fontSize: 15, color: C.text, backgroundColor: '#fff', marginBottom: 4 },
  socialBlock: { marginTop: 16, gap: 8 },
  socialTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textAlign: 'center', marginBottom: 2 },
  googleBtn: { minHeight: 44, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  googleBtnText: { fontSize: 14, fontWeight: '800', color: C.text },
  kakaoBtn: { minHeight: 44, borderRadius: 12, backgroundColor: '#FEE500', alignItems: 'center', justifyContent: 'center' },
  kakaoBtnText: { fontSize: 14, fontWeight: '900', color: '#181600' },
  installTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', color: C.text, textAlign: 'center', marginBottom: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  stepNo: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.greenLight, color: C.green, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center' },
  stepText: { flex: 1, fontSize: 14, fontWeight: '800', color: C.text },
  btnSecondaryInstall: { borderWidth: 1.5, borderColor: C.green, borderRadius: 50, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  btnSecondaryInstallText: { color: C.green, fontWeight: '800', fontSize: 15 },
})
