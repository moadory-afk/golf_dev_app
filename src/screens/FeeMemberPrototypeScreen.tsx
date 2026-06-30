import { useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { C } from '../theme'
import type { RootStackProps } from '../navigation/types'
import { feeStatusToKorean, getFeeMemberHistory, type FeePaymentStatus, updateFeeMemberStatus } from '../lib/store'
import { useAsync } from '../lib/useAsync'

function formatKrw(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`
}

function formatShortDate(input: string) {
  if (!input) return '-'
  return input.includes('-') ? input.slice(5).replace('-', '.') : input
}

function statusColor(status: FeePaymentStatus) {
  if (status === 'paid') return C.green
  if (status === 'partial') return C.warn
  return C.danger
}

export default function FeeMemberPrototypeScreen({ route }: RootStackProps<'FeeMemberPrototype'>) {
  const { clubId, memberUserId, memberName, statusId } = route.params
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading } = useAsync(() => getFeeMemberHistory(clubId, memberUserId), [clubId, memberUserId, refreshKey])

  const history = data ?? []
  const current = history[0] ?? null
  const currentStatus = current?.status ?? 'unpaid'
  const tone = statusColor(currentStatus)

  async function changeStatus(nextStatus: FeePaymentStatus) {
    await updateFeeMemberStatus(statusId, nextStatus)
    setRefreshKey((value) => value + 1)
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRefreshKey((value) => value + 1)} tintColor={C.green} />}
    >
      <View style={s.hero}>
        <Text style={s.name}>{memberName}</Text>
        <Text style={s.sub}>회원별 회비 상태와 최근 변경 이력을 확인합니다</Text>
        <View style={[s.badge, { backgroundColor: `${tone}18` }]}>
          <Text style={[s.badgeText, { color: tone }]}>{feeStatusToKorean(currentStatus)}</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.title}>현재 회비 상태</Text>
        <View style={s.infoRow}>
          <Text style={s.label}>청구 금액</Text>
          <Text style={s.value}>{formatKrw(current?.amountDue ?? 0)}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.label}>납부 금액</Text>
          <Text style={s.value}>{formatKrw(current?.amountPaid ?? 0)}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.label}>최근 변경일</Text>
          <Text style={s.value}>{formatShortDate(current?.updatedAt ?? '')}</Text>
        </View>
        <View style={s.actionRow}>
          <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.82} onPress={() => changeStatus('partial')}>
            <Text style={s.secondaryBtnText}>일부납 처리</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.primaryBtn} activeOpacity={0.82} onPress={() => changeStatus('paid')}>
            <Text style={s.primaryBtnText}>완납 처리</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.title}>월별 변경 이력</Text>
        {history.map((item) => (
          <View key={item.id} style={s.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.historyMonth}>{item.cycleId}</Text>
              <Text style={s.historyMeta}>변경일 {formatShortDate(item.updatedAt)}</Text>
            </View>
            <Text style={s.historyAmount}>{formatKrw(item.amountPaid)}</Text>
            <View style={[s.badge, { backgroundColor: `${statusColor(item.status)}18` }]}>
              <Text style={[s.badgeText, { color: statusColor(item.status) }]}>{feeStatusToKorean(item.status)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  hero: { backgroundColor: C.greenDark, borderRadius: 20, padding: 18 },
  name: { color: '#fff', fontSize: 24, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 8, lineHeight: 18 },
  badge: { alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginTop: 12 },
  badgeText: { fontSize: 11, fontWeight: '900' },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border },
  title: { fontSize: 15, fontWeight: '900', color: C.text, marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  label: { fontSize: 13, color: C.muted, fontWeight: '700' },
  value: { fontSize: 14, color: C.text, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondaryBtn: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: C.greenLight },
  secondaryBtnText: { color: C.green, fontSize: 13, fontWeight: '900' },
  primaryBtn: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: C.accent },
  primaryBtnText: { color: C.accentText, fontSize: 13, fontWeight: '900' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  historyMonth: { fontSize: 13, fontWeight: '800', color: C.text },
  historyMeta: { fontSize: 11, color: C.muted, marginTop: 3 },
  historyAmount: { fontSize: 13, fontWeight: '800', color: C.text },
})
