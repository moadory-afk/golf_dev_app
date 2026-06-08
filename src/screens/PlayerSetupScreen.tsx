import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useState } from 'react'
import { getClubMembers } from '../lib/store'
import { useAsync } from '../lib/useAsync'
import { useClub } from '../lib/ClubContext'
import { C } from '../theme'
import type { RootStackProps } from '../navigation/types'

type Nav = RootStackProps<'PlayerSetup'>['navigation']

export default function PlayerSetupScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<RootStackProps<'PlayerSetup'>['route']>()
  const { date, courseName, pars, golfCourseId, ocrPlayers, settlement } = route.params

  const { activeClub } = useClub()
  const { data: members } = useAsync(
    () => activeClub ? getClubMembers(activeClub.id) : Promise.resolve([]),
    [activeClub?.id]
  )

  // OCR 플레이어가 있으면 기본 선택
  const [selected, setSelected] = useState<string[]>(
    () => ocrPlayers?.map((p) => p.name) ?? []
  )
  const [guestInput, setGuestInput] = useState('')
  const [guests, setGuests] = useState<string[]>([])

  function toggleMember(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  function addGuest() {
    const name = guestInput.trim()
    if (!name || guests.includes(name) || selected.includes(name)) return
    setGuests((prev) => [...prev, name])
    setGuestInput('')
  }

  function removeGuest(name: string) {
    setGuests((prev) => prev.filter((n) => n !== name))
    setSelected((prev) => prev.filter((n) => n !== name))
  }

  const allPlayers = [
    ...(members ?? []).filter((m) => selected.includes(m.name)).map((m) => m.name),
    ...guests,
  ]

  function handleNext() {
    if (allPlayers.length < 1) return
    const players = allPlayers.map((name) => {
      const ocr = ocrPlayers?.find((p) => p.name === name)
      return {
        name,
        strokes: ocr?.strokes ?? pars.map((p) => p),  // OCR 타수 or 파 기본값
      }
    })
    nav.navigate('ScoreEntry', {
      date, courseName, pars, golfCourseId, players, settlement,
    })
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* 코스 요약 */}
      <View style={[s.card, { paddingVertical: 12 }]}>
        <Text style={s.summary}>{courseName} · {date}</Text>
        <Text style={[s.summary, { color: C.green }]}>파{pars.reduce((a, b) => a + b, 0)} · 18홀</Text>
      </View>

      {/* 클럽 멤버 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>클럽 멤버</Text>
        {(!members || members.length === 0) ? (
          <Text style={s.muted}>클럽 멤버가 없습니다.</Text>
        ) : (
          members.map((m) => {
            const on = selected.includes(m.name)
            return (
              <TouchableOpacity key={m.userId} style={s.memberRow} onPress={() => toggleMember(m.name)}>
                <View style={[s.checkbox, on && s.checkboxOn]}>
                  {on && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={[s.memberName, on && { color: C.green, fontWeight: '700' }]}>{m.name}</Text>
                {ocrPlayers?.find((p) => p.name === m.name) && (
                  <View style={s.ocrBadge}><Text style={s.ocrBadgeText}>OCR</Text></View>
                )}
              </TouchableOpacity>
            )
          })
        )}
      </View>

      {/* 게스트 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>게스트 (직접 입력)</Text>
        <View style={s.guestInputRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={guestInput}
            onChangeText={setGuestInput}
            placeholder="게스트 이름"
            onSubmitEditing={addGuest}
            returnKeyType="done"
          />
          <TouchableOpacity style={s.addBtn} onPress={addGuest}>
            <Text style={s.addBtnText}>+ 추가</Text>
          </TouchableOpacity>
        </View>
        {guests.map((g) => (
          <View key={g} style={s.guestTag}>
            <Text style={s.guestTagText}>{g}</Text>
            <TouchableOpacity onPress={() => removeGuest(g)}>
              <Text style={{ color: C.danger, fontSize: 16, fontWeight: '700', marginLeft: 8 }}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* 선택 요약 */}
      {allPlayers.length > 0 && (
        <View style={s.selectedSummary}>
          <Text style={s.selectedText}>선택된 플레이어 {allPlayers.length}명: {allPlayers.join(', ')}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.btn, allPlayers.length < 1 && s.btnDisabled]}
        onPress={handleNext}
        disabled={allPlayers.length < 1}
      >
        <Text style={s.btnText}>다음 → 스코어 입력</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 },
  summary: { fontSize: 13, color: C.muted, fontWeight: '600' },
  muted: { fontSize: 13, color: C.muted },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxOn: { borderColor: C.green, backgroundColor: C.green },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '900' },
  memberName: { fontSize: 14, color: C.text, flex: 1 },
  ocrBadge: { backgroundColor: '#e8f4ff', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ocrBadgeText: { fontSize: 10, color: '#2980b9', fontWeight: '700' },
  guestInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: C.text, backgroundColor: C.bg },
  addBtn: { backgroundColor: C.greenLight, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: C.green, fontWeight: '700', fontSize: 13 },
  guestTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 6, alignSelf: 'flex-start' },
  guestTagText: { fontSize: 13, color: C.text, fontWeight: '600' },
  selectedSummary: { backgroundColor: C.greenLight, borderRadius: 10, padding: 12, marginBottom: 12 },
  selectedText: { fontSize: 13, color: C.green, fontWeight: '600' },
  btn: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
