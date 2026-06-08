import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { joinClub, getClubByInviteCode, ensureProfile } from '../lib/store'
import { C } from '../theme'

function nameToEmail(name: string): string {
  const hex = Array.from(name.trim())
    .map(c => c.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('')
  return `${hex}@gogopar.app`
}

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

  async function handleLogin() {
    if (!name.trim() || !password) { Alert.alert('이름과 비밀번호를 입력하세요.'); return }
    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: nameToEmail(name), password })
      if (error) Alert.alert('로그인 실패', '이름 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignUp() {
    if (!name.trim()) { Alert.alert('이름을 입력하세요.'); return }
    if (password.length < 4) { Alert.alert('비밀번호는 4자 이상이어야 합니다.'); return }
    setAuthLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: nameToEmail(name), password,
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
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* 초대 카드 */}
        <View style={s.inviteCard}>
          <Text style={s.golf}>⛳</Text>
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
        {session ? (
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
            <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder={authMode === 'signup' ? '4자 이상' : '비밀번호'} secureTextEntry />
            <TouchableOpacity
              style={[s.btnPrimary, authLoading && { opacity: 0.6 }]}
              onPress={authMode === 'login' ? handleLogin : handleSignUp}
              disabled={authLoading}
            >
              {authLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimaryText}>{authMode === 'login' ? '로그인' : '가입하기'}</Text>}
            </TouchableOpacity>
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
})
