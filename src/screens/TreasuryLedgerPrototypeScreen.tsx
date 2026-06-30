import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { C } from '../theme'
import { getTreasuryEntries, type TreasuryEntryItem } from '../lib/store'
import { useClub } from '../lib/ClubContext'
import { useAsync } from '../lib/useAsync'
import type { RootStackParamList } from '../navigation/types'

type Filter = 'all' | 'income' | 'expense'
type Nav = NativeStackNavigationProp<RootStackParamList>

function formatKrw(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`
}

function formatDate(value: string) {
  if (!value) return '-'
  if (value.includes('T')) return value.slice(0, 10)
  return value
}

export default function TreasuryLedgerPrototypeScreen() {
  const nav = useNavigation<Nav>()
  const { activeClub } = useClub()
  const [filter, setFilter] = useState<Filter>('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading } = useAsync(
    () => (activeClub ? getTreasuryEntries(activeClub.id) : Promise.resolve([])),
    [activeClub?.id, refreshKey]
  )

  const items = data ?? []
  const filtered = useMemo(() => {
    if (filter === 'income') return items.filter((item) => item.type === 'income')
    if (filter === 'expense') return items.filter((item) => item.type === 'expense')
    return items
  }, [filter, items])

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1)
    }, [])
  )

  function openEdit(item: TreasuryEntryItem) {
    nav.navigate('TreasuryEntryPrototype', {
      kind: item.type,
      entry: {
        id: item.id,
        type: item.type,
        title: item.title,
        amount: item.amount,
        entryDate: item.entryDate,
        memo: item.memo ?? '',
      },
    })
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRefreshKey((value) => value + 1)} tintColor={C.green} />}
    >
      <View style={s.hero}>
        <Text style={s.heroTitle}>입금 · 지급 내역</Text>
        <Text style={s.heroSub}>최근 거래를 기준으로 회비와 운영비 흐름을 자세히 확인하고 수정할 수 있습니다.</Text>
      </View>

      <View style={s.filterRow}>
        <TouchableOpacity style={[s.chip, filter === 'all' && s.chipActive]} onPress={() => setFilter('all')} activeOpacity={0.82}>
          <Text style={[s.chipText, filter === 'all' && s.chipActiveText]}>전체</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.chip, filter === 'income' && s.chipActive]} onPress={() => setFilter('income')} activeOpacity={0.82}>
          <Text style={[s.chipText, filter === 'income' && s.chipActiveText]}>입금</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.chip, filter === 'expense' && s.chipActive]} onPress={() => setFilter('expense')} activeOpacity={0.82}>
          <Text style={[s.chipText, filter === 'expense' && s.chipActiveText]}>지급</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        {filtered.map((item) => (
          <TouchableOpacity key={item.id} style={s.row} activeOpacity={0.82} onPress={() => openEdit(item)}>
            <View style={[s.toneBar, item.type === 'income' ? s.incomeTone : s.expenseTone]} />
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.meta}>
                {formatDate(item.entryDate)} · {item.memo || '메모 없음'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.amount, { color: item.type === 'income' ? C.green : C.danger }]}>
                {item.type === 'income' ? '+' : '-'}
                {formatKrw(item.amount)}
              </Text>
              <Text style={s.type}>{item.type === 'income' ? '입금' : '지급'}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  hero: { backgroundColor: C.greenDark, borderRadius: 20, padding: 18 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 8, lineHeight: 18 },
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  chipActiveText: { color: C.accentText, fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  toneBar: { width: 5, alignSelf: 'stretch', borderRadius: 999 },
  incomeTone: { backgroundColor: C.green },
  expenseTone: { backgroundColor: C.danger },
  title: { fontSize: 13, fontWeight: '800', color: C.text },
  meta: { fontSize: 11, color: C.muted, marginTop: 3 },
  amount: { fontSize: 13, fontWeight: '900' },
  type: { fontSize: 11, color: C.muted, marginTop: 4 },
})
