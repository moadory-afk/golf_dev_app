import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { C } from '../theme'
import type { RootStackParamList, RootStackProps } from '../navigation/types'
import { createTreasuryEntry, updateTreasuryEntry, type TreasuryEntryType } from '../lib/store'
import { useClub } from '../lib/ClubContext'

type Nav = NativeStackNavigationProp<RootStackParamList>

function formatDateInput(value: string) {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default function TreasuryEntryPrototypeScreen({ route }: RootStackProps<'TreasuryEntryPrototype'>) {
  const nav = useNavigation<Nav>()
  const { activeClub } = useClub()
  const entry = route.params.entry
  const isEditMode = Boolean(entry?.id)
  const isIncome = route.params.kind === 'income'
  const accentColor = isIncome ? C.green : C.danger

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [entryDate, setEntryDate] = useState(today)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (entry) {
      setAmount(String(entry.amount))
      setTitle(entry.title)
      setEntryDate(entry.entryDate || today)
      setMemo(entry.memo || '')
      return
    }

    setAmount('')
    setTitle(isIncome ? '회비 입금' : '운영비 지급')
    setEntryDate(today)
    setMemo('')
  }, [entry, isIncome, today])

  const screenTitle = isEditMode ? (isIncome ? '입금 수정' : '지급 수정') : isIncome ? '입금 등록' : '지급 등록'
  const buttonText = saving ? '저장 중...' : isEditMode ? '수정 저장' : isIncome ? '입금 저장' : '지급 저장'
  const amountNumber = Number(amount.replace(/[^0-9]/g, ''))

  async function handleSave() {
    if (!activeClub || saving) return

    if (!amountNumber || amountNumber <= 0) {
      setError('금액은 0원보다 크게 입력해 주세요.')
      return
    }

    if (!title.trim()) {
      setError('항목 이름을 입력해 주세요.')
      return
    }

    if (!isValidDate(entryDate)) {
      setError('날짜는 YYYY-MM-DD 형식으로 입력해 주세요.')
      return
    }

    setError('')
    setSaving(true)

    try {
      const entryType: TreasuryEntryType = isIncome ? 'income' : 'expense'
      const payload = {
        type: entryType,
        title: title.trim(),
        amount: amountNumber,
        entryDate,
        memo: memo.trim(),
      }

      if (isEditMode && entry) {
        await updateTreasuryEntry(entry.id, payload)
      } else {
        await createTreasuryEntry(activeClub.id, payload)
      }

      nav.goBack()
    } catch (saveError: any) {
      setError(saveError?.message ?? '저장 중 문제가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.heroEyebrow}>{activeClub?.name ?? '클럽 회계'}</Text>
        <Text style={s.heroTitle}>{screenTitle}</Text>
        <Text style={s.heroSub}>
          {isEditMode
            ? '이미 저장된 입금·지급 내역을 바로 수정합니다.'
            : isIncome
              ? '회원 회비나 기타 수입을 기록해 잔액에 반영합니다.'
              : '운영비, 예약금, 간식비처럼 클럽에서 지출한 내역을 기록합니다.'}
        </Text>
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>기본 정보</Text>

        <View style={s.field}>
          <Text style={s.label}>거래 구분</Text>
          <View style={[s.readonlyBox, { borderColor: `${accentColor}55` }]}>
            <Text style={[s.readonlyValue, { color: accentColor }]}>{isIncome ? '입금' : '지급'}</Text>
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>금액</Text>
          <TextInput
            style={s.input}
            value={amount}
            onChangeText={(value) => setAmount(value.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            placeholder="예: 50000"
            placeholderTextColor={C.muted}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>항목</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder={isIncome ? '예: 6월 회비' : '예: 라운드 예약금'}
            placeholderTextColor={C.muted}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>날짜</Text>
          <TextInput
            style={s.input}
            value={entryDate}
            onChangeText={(value) => setEntryDate(formatDateInput(value))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>메모</Text>
          <TextInput
            style={[s.input, s.memoInput]}
            value={memo}
            onChangeText={setMemo}
            placeholder={isIncome ? '입금자나 입금 설명을 적어 주세요.' : '지급 목적이나 비고를 적어 주세요.'}
            placeholderTextColor={C.muted}
            multiline
            textAlignVertical="top"
          />
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>저장 전 확인</Text>

        <View style={s.checkRow}>
          <Text style={s.checkLabel}>반영 금액</Text>
          <Text style={[s.checkValue, { color: accentColor }]}>
            {amountNumber > 0 ? `${amountNumber.toLocaleString('ko-KR')}원` : '-'}
          </Text>
        </View>

        <View style={s.checkRow}>
          <Text style={s.checkLabel}>기준 날짜</Text>
          <Text style={s.checkValue}>{entryDate || '-'}</Text>
        </View>

        <View style={s.checkRow}>
          <Text style={s.checkLabel}>항목</Text>
          <Text style={s.checkValue}>{title.trim() || '-'}</Text>
        </View>

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        <View style={s.actionRow}>
          <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.82} onPress={() => nav.goBack()}>
            <Text style={s.secondaryBtnText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: isIncome ? C.accent : C.danger, opacity: saving ? 0.7 : 1 }]}
            activeOpacity={0.82}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={[s.primaryBtnText, { color: isIncome ? C.accentText : '#fff' }]}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  hero: { backgroundColor: C.greenDark, borderRadius: 20, padding: 18 },
  heroEyebrow: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.74)', fontSize: 12, marginTop: 8, lineHeight: 18 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: C.text, marginBottom: 10 },
  field: { marginTop: 10 },
  label: { fontSize: 12, fontWeight: '800', color: C.muted, marginBottom: 8 },
  readonlyBox: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#f8fbf8',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  readonlyValue: { fontSize: 14, fontWeight: '800' },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 14,
    color: C.text,
  },
  memoInput: { minHeight: 96, paddingTop: 14 },
  checkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  checkLabel: { fontSize: 13, color: C.muted, fontWeight: '700' },
  checkValue: { fontSize: 13, color: C.text, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  errorText: { marginTop: 12, fontSize: 12, color: C.danger, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: C.greenLight,
  },
  secondaryBtnText: { color: C.green, fontSize: 13, fontWeight: '900' },
  primaryBtn: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { fontSize: 13, fontWeight: '900' },
})
