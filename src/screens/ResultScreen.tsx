import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useState } from 'react'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { saveRound, updateRound, playerTotal, totalPar } from '../lib/store'
import { useClub } from '../lib/ClubContext'
import { C } from '../theme'
import type { RootStackProps } from '../navigation/types'

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

// Supabase 에러 객체(message/details/hint/code)까지 사람이 읽을 수 있게 풀어줌
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; details?: string; hint?: string; code?: string }
    return [e.message, e.details, e.hint, e.code].filter(Boolean).join(' · ') || JSON.stringify(err)
  }
  return String(err)
}

// 웹에서는 Alert.alert가 동작하지 않음 → window.alert 사용
function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`)
  else Alert.alert(title, message)
}

export default function ResultScreen() {
  const route = useRoute<RootStackProps<'Result'>['route']>()
  const nav = useNavigation<RootStackProps<'Result'>['navigation']>()
  const { editId, pars, players, courseName: initCourse, date: initDate, photoUris, settlement } = route.params

  const [courseName, setCourseName] = useState(initCourse ?? '')
  const [date, setDate] = useState(initDate ?? new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const { activeClub } = useClub()
  const clubId = activeClub?.id

  const par = totalPar(pars)
  const ranked = [...players]
    .map((p) => {
      const total = playerTotal(p.strokes)
      let birdie = 0, bog = 0, dbl = 0
      p.strokes.forEach((s, i) => {
        const d = s - pars[i]
        if (d <= -1) birdie++
        else if (d === 1) bog++
        else if (d >= 2) dbl++
      })
      return { name: p.name, total, diff: total - par, birdie, bog, dbl }
    })
    .sort((a, b) => a.total - b.total)

  async function handleSave() {
    // 코스명은 자유 입력(빈칸 포함)으로 저장 — 추후 총무가 일괄 정리. 빈칸이면 '이름 없는 코스'로 저장됨.
    setSaving(true)
    try {
      // 촬영된 사진을 800px / 60% 화질로 압축 후 base64 변환
      const photoData: string[] = []
      for (const uri of (photoUris ?? [])) {
        try {
          const res = await manipulateAsync(
            uri,
            [{ resize: { width: 800 } }],
            { compress: 0.6, format: SaveFormat.JPEG, base64: true },
          )
          if (res.base64) photoData.push(`data:image/jpeg;base64,${res.base64}`)
        } catch {
          // 개별 사진 처리 실패는 무시
        }
      }
      const input = { courseName, date, pars, players, photoData, clubId, settlement }
      const saved = editId
        ? await updateRound(editId, input)
        : await saveRound(input)
      nav.navigate('RoundDetail', { id: saved.id })
    } catch (err: unknown) {
      notify('저장 실패', errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* 순위 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>순위 (총타수)</Text>
        {ranked.map((r, i) => (
          <View key={r.name} style={s.rankRow}>
            <Text style={s.rankNum}>{i + 1}</Text>
            <Text style={[s.rankName, { flex: 1 }]}>{r.name}</Text>
            <Text style={s.rankScore}>{r.total}</Text>
            <Text style={[s.muted, { width: 44, textAlign: 'right' }]}>{diffText(r.diff)}</Text>
            {r.birdie > 0 && <Text style={{ width: 42, textAlign: 'right', color: C.info, fontWeight: '600', fontSize: 12 }}>🐦{r.birdie}</Text>}
          </View>
        ))}
        <Text style={[s.muted, { marginTop: 8 }]}>코스 파 {par}</Text>
      </View>

      {/* 저장 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>저장</Text>
        <Text style={s.label}>날짜</Text>
        <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <Text style={[s.label, { marginTop: 12 }]}>골프장</Text>
        <TextInput style={s.input} value={courseName} onChangeText={setCourseName} placeholder="예: 레이크사이드CC" />
        <TouchableOpacity
          style={[s.btn, { marginTop: 16 }, saving && s.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={s.btnText}>{saving ? '저장 중...' : editId ? '수정 저장' : '이 라운드 저장'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[s.btn, { backgroundColor: '#888' }]} onPress={() => nav.goBack()}>
        <Text style={s.btnText}>다시 수정하기</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10, fontSize: 14, color: C.text, backgroundColor: C.bg, marginBottom: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  rankNum: { width: 24, fontWeight: '600', color: C.text },
  rankName: { fontSize: 14, color: C.text },
  rankScore: { fontSize: 16, fontWeight: '700', color: C.text, width: 40, textAlign: 'right' },
  muted: { fontSize: 13, color: C.muted },
  btn: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
