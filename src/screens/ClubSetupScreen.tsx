import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { createClub, joinClub, type ClubInfo } from '../lib/store'
import { C } from '../theme'
import { Icon } from '../components/Icon'

interface Props {
  onComplete: (club: ClubInfo) => void
}

export default function ClubSetupScreen({ onComplete }: Props) {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [clubName, setClubName] = useState('')
  const [clubSubtitle, setClubSubtitle] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!clubName.trim()) { Alert.alert('클럽명을 입력하세요.'); return }
    setLoading(true)
    try {
      const club = await createClub(clubName.trim(), clubSubtitle.trim())
      onComplete(club)
    } catch (err: unknown) {
      Alert.alert('오류', err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (inviteCode.trim().length !== 6) { Alert.alert('초대코드는 6자리입니다.'); return }
    setLoading(true)
    try {
      const club = await joinClub(inviteCode.trim())
      onComplete(club)
    } catch (err: unknown) {
      Alert.alert('오류', err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View style={s.logo}><Icon name="flag" size={50} color={C.green} strokeWidth={1.6} /></View>
          <Text style={s.title}>클럽 설정</Text>
          <Text style={s.sub}>클럽을 만들거나 초대코드로 참여하세요</Text>
        </View>

        <View style={s.form}>
          <View style={s.tabs}>
            <TouchableOpacity
              style={[s.tab, tab === 'create' && s.tabActive]}
              onPress={() => setTab('create')}
            >
              <Text style={[s.tabText, tab === 'create' && s.tabTextActive]}>클럽 만들기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, tab === 'join' && s.tabActive]}
              onPress={() => setTab('join')}
            >
              <Text style={[s.tabText, tab === 'join' && s.tabTextActive]}>초대코드 참여</Text>
            </TouchableOpacity>
          </View>

          {tab === 'create' ? (
            <>
              <Text style={s.label}>클럽명</Text>
              <TextInput
                style={s.input}
                value={clubName}
                onChangeText={setClubName}
                placeholder="예: 홍길동 골프클럽"
                maxLength={20}
              />
              <Text style={[s.label, { marginTop: 12 }]}>부제 (선택)</Text>
              <TextInput
                style={s.input}
                value={clubSubtitle}
                onChangeText={setClubSubtitle}
                placeholder="그린 위 우리들의 이야기"
                maxLength={30}
              />
              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleCreate}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>클럽 만들기</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.label}>초대코드 (6자리)</Text>
              <TextInput
                style={s.input}
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase())}
                placeholder="ABCDEF"
                autoCapitalize="characters"
                maxLength={6}
              />
              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleJoin}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>참여하기</Text>}
              </TouchableOpacity>
            </>
          )}
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
  sub: { fontSize: 14, color: C.muted, marginTop: 4, textAlign: 'center' },
  form: { backgroundColor: C.card, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  tabs: { flexDirection: 'row', marginBottom: 20, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: C.bg },
  tabActive: { backgroundColor: C.green },
  tabText: { fontSize: 14, fontWeight: '600', color: C.muted },
  tabTextActive: { color: '#fff' },
  label: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10, fontSize: 14, color: C.text, backgroundColor: C.bg, marginBottom: 4 },
  btn: { marginTop: 16, backgroundColor: C.green, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
