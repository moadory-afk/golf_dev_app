import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { C } from '../theme'
import { Icon } from '../components/Icon'
import type { RootStackParamList } from '../navigation/types'
import { useClub } from '../lib/ClubContext'
import { useAsync } from '../lib/useAsync'
import {
  feeStatusToKorean,
  getFeeDashboard,
  updateFeeMemberPayment,
  type FeeMemberStatusItem,
  type FeePaymentStatus,
  type TreasuryEntryItem,
} from '../lib/store'

type FeeTab = 'treasury' | 'payment'
type PaymentFilter = 'all' | 'partial' | 'unpaid'
type TransactionFilter = 'all' | 'income' | 'expense'
type Nav = NativeStackNavigationProp<RootStackParamList>

const FALLBACK_MEMBERS: FeeMemberStatusItem[] = [
  {
    id: 'mock-1',
    clubId: 'mock-club',
    cycleId: 'mock-cycle',
    userId: 'mock-user-1',
    memberName: '정재룡',
    amountDue: 100000,
    amountPaid: 100000,
    status: 'paid',
    updatedAt: '2026-06-29T08:30:18.441+00:00',
  },
  {
    id: 'mock-2',
    clubId: 'mock-club',
    cycleId: 'mock-cycle',
    userId: 'mock-user-2',
    memberName: '손병락',
    amountDue: 100000,
    amountPaid: 100000,
    status: 'paid',
    updatedAt: '2026-06-29T08:30:14.657+00:00',
  },
  {
    id: 'mock-3',
    clubId: 'mock-club',
    cycleId: 'mock-cycle',
    userId: 'mock-user-3',
    memberName: '김수진',
    amountDue: 100000,
    amountPaid: 100000,
    status: 'paid',
    updatedAt: '2026-06-29T08:30:08.123+00:00',
  },
  {
    id: 'mock-4',
    clubId: 'mock-club',
    cycleId: 'mock-cycle',
    userId: 'mock-user-4',
    memberName: '노경훈',
    amountDue: 100000,
    amountPaid: 100000,
    status: 'paid',
    updatedAt: '2026-06-29T08:29:16.812+00:00',
  },
  {
    id: 'mock-5',
    clubId: 'mock-club',
    cycleId: 'mock-cycle',
    userId: 'mock-user-5',
    memberName: '김성혁',
    amountDue: 100000,
    amountPaid: 0,
    status: 'unpaid',
    updatedAt: '2026-06-29T08:29:03.687326+00:00',
  },
  {
    id: 'mock-6',
    clubId: 'mock-club',
    cycleId: 'mock-cycle',
    userId: 'mock-user-6',
    memberName: '황재현',
    amountDue: 100000,
    amountPaid: 0,
    status: 'unpaid',
    updatedAt: '2026-06-29T08:29:03.687326+00:00',
  },
  {
    id: 'mock-7',
    clubId: 'mock-club',
    cycleId: 'mock-cycle',
    userId: 'mock-user-7',
    memberName: '김지현',
    amountDue: 100000,
    amountPaid: 0,
    status: 'unpaid',
    updatedAt: '2026-06-29T08:29:03.687326+00:00',
  },
]

const FALLBACK_TRANSACTIONS: TreasuryEntryItem[] = [
  { id: 'tx-1', clubId: 'mock-club', type: 'income', title: '6월 회비', amount: 50000, entryDate: '2026-06-22', memo: '김민수 1명' },
  { id: 'tx-2', clubId: 'mock-club', type: 'expense', title: '라운드 예약금', amount: 120000, entryDate: '2026-06-20', memo: '6월 정기 라운드' },
  { id: 'tx-3', clubId: 'mock-club', type: 'income', title: '찬조금', amount: 100000, entryDate: '2026-06-18', memo: '박현영' },
  { id: 'tx-4', clubId: 'mock-club', type: 'expense', title: '간식비', amount: 35000, entryDate: '2026-06-16', memo: '모임 준비' },
]

function formatKrw(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`
}

function formatShortDate(input: string) {
  if (!input) return '-'
  if (input.includes('T')) return input.slice(5, 10).replace('-', '.')
  if (input.includes('-')) return input.slice(5).replace('-', '.')
  return input
}

function formatRecentDate(input: string) {
  if (!input) return '-'
  if (input.includes('T')) return input.replace('T', ' ').slice(0, 16)
  return input
}

function statusColor(status: FeePaymentStatus) {
  if (status === 'paid') return C.green
  if (status === 'partial') return C.warn
  return C.danger
}

function nextStatus(status: FeePaymentStatus): FeePaymentStatus {
  if (status === 'paid') return 'unpaid'
  if (status === 'unpaid') return 'partial'
  return 'paid'
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={s.summaryCard}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  )
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action ? <Text style={s.sectionAction}>{action}</Text> : null}
    </View>
  )
}

export default function FeePrototypeScreen() {
  const nav = useNavigation<Nav>()
  const { activeClub: club } = useClub()
  const [activeTab, setActiveTab] = useState<FeeTab>('treasury')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all')
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [partialEditorId, setPartialEditorId] = useState<string | null>(null)
  const [partialAmount, setPartialAmount] = useState('')
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)
  const [fallbackMembers, setFallbackMembers] = useState(FALLBACK_MEMBERS)

  const { data, loading, error } = useAsync(
    () => (club ? getFeeDashboard(club.id) : Promise.resolve(null)),
    [club?.id, refreshKey]
  )

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1)
    }, [])
  )

  const usingFallback = !data?.connectionReady || !data?.policy
  const members = usingFallback ? fallbackMembers : (data?.members ?? [])
  const transactions = usingFallback ? FALLBACK_TRANSACTIONS : (data?.treasuryEntries ?? [])

  const filteredMembers = useMemo(() => {
    if (paymentFilter === 'partial') return members.filter((member) => member.status === 'partial')
    if (paymentFilter === 'unpaid') return members.filter((member) => member.status === 'unpaid')
    return members
  }, [members, paymentFilter])

  const filteredTransactions = useMemo(() => {
    if (transactionFilter === 'income') return transactions.filter((item) => item.type === 'income')
    if (transactionFilter === 'expense') return transactions.filter((item) => item.type === 'expense')
    return transactions
  }, [transactions, transactionFilter])

  const paymentSummary = useMemo(() => {
    const totalDue = members.reduce((sum, member) => sum + member.amountDue, 0)
    const paidCount = members.filter((member) => member.status === 'paid').length
    const partialCount = members.filter((member) => member.status === 'partial').length
    const unpaidCount = members.filter((member) => member.status === 'unpaid').length
    return { totalDue, paidCount, partialCount, unpaidCount }
  }, [members])

  const treasurySummary = useMemo(() => {
    const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
    const expense = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    return { balance: income - expense, income, expense, count: transactions.length }
  }, [transactions])

  function updateFallbackMember(statusId: string, next: FeePaymentStatus, amountPaid: number) {
    setFallbackMembers((current) =>
      current.map((member) =>
        member.id === statusId
          ? {
              ...member,
              status: next,
              amountPaid,
              updatedAt: new Date().toISOString(),
            }
          : member
      )
    )
  }

  async function handleStatusToggle(member: FeeMemberStatusItem) {
    const next = nextStatus(member.status)

    if (next === 'partial') {
      const defaultAmount = member.amountPaid > 0 ? member.amountPaid : Math.floor(member.amountDue / 2)
      setPartialEditorId(member.id)
      setPartialAmount(String(defaultAmount))
      if (usingFallback) {
        updateFallbackMember(member.id, 'partial', defaultAmount)
        return
      }

      setSavingStatusId(member.id)
      try {
        await updateFeeMemberPayment(member.id, 'partial', defaultAmount)
        setRefreshKey((value) => value + 1)
      } finally {
        setSavingStatusId(null)
      }
      return
    }

    setPartialEditorId(null)
    setPartialAmount('')

    const nextAmount = next === 'paid' ? member.amountDue : 0
    if (usingFallback) {
      updateFallbackMember(member.id, next, nextAmount)
      return
    }

    setSavingStatusId(member.id)
    try {
      await updateFeeMemberPayment(member.id, next, nextAmount)
      setRefreshKey((value) => value + 1)
    } finally {
      setSavingStatusId(null)
    }
  }

  async function handleSavePartial(member: FeeMemberStatusItem) {
    const value = Number(partialAmount.replace(/[^0-9]/g, ''))
    if (!value) return

    if (usingFallback) {
      updateFallbackMember(member.id, 'partial', value)
      setPartialEditorId(null)
      setPartialAmount('')
      return
    }

    setSavingStatusId(member.id)
    try {
      await updateFeeMemberPayment(member.id, 'partial', value)
      setPartialEditorId(null)
      setPartialAmount('')
      setRefreshKey((current) => current + 1)
    } finally {
      setSavingStatusId(null)
    }
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRefreshKey((value) => value + 1)} tintColor={C.green} />}
    >
      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroEyebrow}>{club?.name ?? '클럽 운영'}</Text>
          <Text style={s.heroTitle}>회비 관리</Text>
          <Text style={s.heroSub}>총무가 자금 흐름과 회원별 납부 상태를 한 화면에서 관리하는 영역입니다.</Text>
        </View>
        <TouchableOpacity style={s.policyBtn} activeOpacity={0.82}>
          <Icon name="settings" size={15} color={C.accentText} />
          <Text style={s.policyBtnText}>정책</Text>
        </TouchableOpacity>
      </View>

      {usingFallback && (
        <View style={s.noticeCard}>
          <Text style={s.noticeTitle}>회비 테이블 연결 전 미리보기 화면</Text>
          <Text style={s.noticeBody}>실제 정책이나 회계 데이터가 없을 때는 예시 데이터로 화면이 보입니다.</Text>
        </View>
      )}

      {!!error && (
        <View style={s.noticeCard}>
          <Text style={s.noticeTitle}>데이터 조회 오류</Text>
          <Text style={s.noticeBody}>{error}</Text>
        </View>
      )}

      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tabButton, activeTab === 'treasury' && s.tabButtonActive]} onPress={() => setActiveTab('treasury')} activeOpacity={0.86}>
          <Text style={[s.tabButtonText, activeTab === 'treasury' && s.tabButtonTextActive]}>회비관리 현황</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabButton, activeTab === 'payment' && s.tabButtonActive]} onPress={() => setActiveTab('payment')} activeOpacity={0.86}>
          <Text style={[s.tabButtonText, activeTab === 'payment' && s.tabButtonTextActive]}>회비납부 현황</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'treasury' ? (
        <>
          <View style={s.summaryGrid}>
            <SummaryCard label="현재 잔액" value={formatKrw(treasurySummary.balance)} />
            <SummaryCard label="이번 달 입금" value={formatKrw(treasurySummary.income)} tone={C.green} />
            <SummaryCard label="이번 달 지급" value={formatKrw(treasurySummary.expense)} tone={C.danger} />
            <SummaryCard label="최근 거래" value={`${treasurySummary.count}건`} />
          </View>

          <View style={s.card}>
            <SectionTitle title="최근 거래 내역" action="전체 보기" />

            <View style={s.filterRow}>
              <TouchableOpacity style={[s.chip, transactionFilter === 'all' && s.chipActive]} onPress={() => setTransactionFilter('all')} activeOpacity={0.82}>
                <Text style={[s.chipText, transactionFilter === 'all' && s.chipActiveText]}>전체</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, transactionFilter === 'income' && s.chipActive]} onPress={() => setTransactionFilter('income')} activeOpacity={0.82}>
                <Text style={[s.chipText, transactionFilter === 'income' && s.chipActiveText]}>입금</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, transactionFilter === 'expense' && s.chipActive]} onPress={() => setTransactionFilter('expense')} activeOpacity={0.82}>
                <Text style={[s.chipText, transactionFilter === 'expense' && s.chipActiveText]}>지급</Text>
              </TouchableOpacity>
            </View>

            {filteredTransactions.map((item) => (
              <View key={item.id} style={s.transactionRow}>
                <View style={[s.transactionIcon, item.type === 'income' ? s.incomeIcon : s.expenseIcon]}>
                  <Text style={s.transactionIconText}>{item.type === 'income' ? '+' : '-'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.transactionTitle}>{item.title}</Text>
                  <Text style={s.memberMeta}>
                    {formatShortDate(item.entryDate)} · {item.type === 'income' ? '입금' : '지급'}
                  </Text>
                </View>
                <Text style={[s.transactionAmount, { color: item.type === 'income' ? C.green : C.danger }]}>
                  {item.type === 'income' ? '+' : '-'}
                  {formatKrw(item.amount)}
                </Text>
              </View>
            ))}

            <View style={s.actionRow}>
              <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.82} onPress={() => nav.navigate('TreasuryEntryPrototype', { kind: 'income' })}>
                <Text style={s.secondaryBtnText}>입금 등록</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} activeOpacity={0.82} onPress={() => nav.navigate('TreasuryEntryPrototype', { kind: 'expense' })}>
                <Text style={s.primaryBtnText}>지급 등록</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.ghostLink} activeOpacity={0.82} onPress={() => nav.navigate('TreasuryLedgerPrototype')}>
              <Text style={s.ghostLinkText}>입금 · 지급 내역 전체 보기</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={s.summaryGrid}>
            <SummaryCard label="총 회비" value={formatKrw(paymentSummary.totalDue)} />
            <SummaryCard label="완납" value={`${paymentSummary.paidCount}명`} tone={C.green} />
            <SummaryCard label="일부납" value={`${paymentSummary.partialCount}명`} tone={C.warn} />
            <SummaryCard label="미납" value={`${paymentSummary.unpaidCount}명`} tone={C.danger} />
          </View>

          <View style={s.filterRow}>
            <TouchableOpacity style={[s.chip, paymentFilter === 'all' && s.chipActive]} onPress={() => setPaymentFilter('all')} activeOpacity={0.82}>
              <Text style={[s.chipText, paymentFilter === 'all' && s.chipActiveText]}>전체</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.chip, paymentFilter === 'partial' && s.chipActive]} onPress={() => setPaymentFilter('partial')} activeOpacity={0.82}>
              <Text style={[s.chipText, paymentFilter === 'partial' && s.chipActiveText]}>일부납</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.chip, paymentFilter === 'unpaid' && s.chipActive]} onPress={() => setPaymentFilter('unpaid')} activeOpacity={0.82}>
              <Text style={[s.chipText, paymentFilter === 'unpaid' && s.chipActiveText]}>미납</Text>
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <SectionTitle title="회원별 납부 상태" action={data?.cycle?.label ?? '현재 회차'} />

            {filteredMembers.map((member) => {
              const isPartialEditing = partialEditorId === member.id
              const isSaving = savingStatusId === member.id

              return (
                <View key={member.id} style={s.memberBlock}>
                  <View style={s.memberRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName}>{member.memberName}</Text>
                      <Text style={s.memberMeta}>최근 변경 {formatRecentDate(member.updatedAt)}</Text>
                    </View>

                    <Text style={s.memberAmount}>{formatKrw(member.amountPaid)}</Text>

                    <TouchableOpacity
                      style={[s.statusBadge, { backgroundColor: `${statusColor(member.status)}18`, opacity: isSaving ? 0.7 : 1 }]}
                      activeOpacity={0.82}
                      onPress={() => handleStatusToggle(member)}
                      disabled={isSaving}
                    >
                      <Text style={[s.statusText, { color: statusColor(member.status) }]}>{feeStatusToKorean(member.status)}</Text>
                    </TouchableOpacity>
                  </View>

                  {isPartialEditing && (
                    <View style={s.partialEditor}>
                      <Text style={s.partialLabel}>일부납 금액</Text>
                      <View style={s.partialRow}>
                        <TextInput
                          style={s.partialInput}
                          value={partialAmount}
                          onChangeText={(value) => setPartialAmount(value.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          placeholder="금액 입력"
                          placeholderTextColor={C.muted}
                        />
                        <TouchableOpacity
                          style={[s.partialSaveBtn, { opacity: isSaving ? 0.7 : 1 }]}
                          activeOpacity={0.82}
                          onPress={() => handleSavePartial(member)}
                          disabled={isSaving}
                        >
                          <Text style={s.partialSaveBtnText}>저장</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  hero: {
    backgroundColor: C.greenDark,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroEyebrow: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 8, lineHeight: 18 },
  policyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  policyBtnText: { color: C.accentText, fontSize: 12, fontWeight: '800' },
  noticeCard: { backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
  noticeTitle: { fontSize: 13, fontWeight: '900', color: C.text },
  noticeBody: { fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 18 },
  tabBar: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 18, padding: 4, borderWidth: 1, borderColor: C.border },
  tabButton: { flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: 'center' },
  tabButtonActive: { backgroundColor: C.accent },
  tabButtonText: { fontSize: 13, fontWeight: '800', color: C.muted },
  tabButtonTextActive: { color: C.accentText },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexBasis: '47%', flexGrow: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
  summaryLabel: { fontSize: 11, color: C.muted, fontWeight: '700' },
  summaryValue: { fontSize: 18, color: C.text, fontWeight: '900', marginTop: 8 },
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  chipActiveText: { color: C.accentText, fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  sectionAction: { fontSize: 12, fontWeight: '800', color: C.green },
  memberBlock: { borderTopWidth: 1, borderTopColor: C.border },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  memberName: { fontSize: 14, fontWeight: '800', color: C.text },
  memberMeta: { fontSize: 11, color: C.muted, marginTop: 3 },
  memberAmount: { fontSize: 13, fontWeight: '800', color: C.text },
  statusBadge: { minWidth: 62, alignItems: 'center', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7 },
  statusText: { fontSize: 11, fontWeight: '900' },
  partialEditor: {
    backgroundColor: '#f8fbf8',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  partialLabel: { fontSize: 12, fontWeight: '800', color: C.muted, marginBottom: 8 },
  partialRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  partialInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    fontSize: 14,
    color: C.text,
  },
  partialSaveBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: C.accent,
  },
  partialSaveBtnText: { color: C.accentText, fontSize: 12, fontWeight: '900' },
  transactionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  transactionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  incomeIcon: { backgroundColor: C.greenLight },
  expenseIcon: { backgroundColor: '#fbe8e5' },
  transactionIconText: { fontSize: 15, fontWeight: '900', color: C.text },
  transactionTitle: { fontSize: 13, fontWeight: '800', color: C.text },
  transactionAmount: { fontSize: 13, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: C.greenLight },
  secondaryBtnText: { color: C.green, fontSize: 13, fontWeight: '900' },
  primaryBtn: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: C.accent },
  primaryBtnText: { color: C.accentText, fontSize: 13, fontWeight: '900' },
  ghostLink: { marginTop: 12, borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  ghostLinkText: { color: C.text, fontSize: 13, fontWeight: '800' },
})
