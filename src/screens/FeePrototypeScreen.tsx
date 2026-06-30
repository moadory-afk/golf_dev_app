import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { C } from '../theme'
import { Icon } from '../components/Icon'
import DateField, { todayLocal } from '../components/DateField'
import type { RootStackParamList } from '../navigation/types'
import { useClub } from '../lib/ClubContext'
import { useAsync } from '../lib/useAsync'
import {
  createTreasuryEntry,
  deleteTreasuryEntry,
  feeStatusToKorean,
  getFeeDashboard,
  getClubMembers,
  getFeePaymentMonthData,
  saveClubFeePolicy,
  updateTreasuryEntry,
  updateFeeMemberPayment,
  type FeeMemberStatusItem,
  type FeePaymentStatus,
  type FeePolicyAdjustmentItem,
  type FeeMode,
  type TreasuryEntryItem,
} from '../lib/store'

type FeeTab = 'treasury' | 'payment'
type PaymentFilter = 'all' | 'partial' | 'unpaid'
type TransactionFilter = 'all' | 'income' | 'expense'
type Nav = NativeStackNavigationProp<RootStackParamList>
type PolicyAdjustmentItem = FeePolicyAdjustmentItem
type TransactionDraft = {
  id: string | null
  type: 'income' | 'expense'
  detail: string
  customDetail: string
  amount: string
  memo: string
  entryDate: string
}

const INCOME_DETAILS = ['회비', '찬조금', '기타'] as const
const EXPENSE_DETAILS = ['캐디피', '식사', '간식', '숙소', '기타'] as const

const FALLBACK_MEMBERS: FeeMemberStatusItem[] = [
  { id: 'mock-1', cycleId: 'mock-cycle', userId: 'mock-user-1', name: '정재룡', amountDue: 100000, amountPaid: 100000, status: 'paid', updatedAt: '2026-06-29T08:30:18.441+00:00' },
  { id: 'mock-2', cycleId: 'mock-cycle', userId: 'mock-user-2', name: '손병락', amountDue: 100000, amountPaid: 100000, status: 'paid', updatedAt: '2026-06-29T08:30:14.657+00:00' },
  { id: 'mock-3', cycleId: 'mock-cycle', userId: 'mock-user-3', name: '김수진', amountDue: 100000, amountPaid: 100000, status: 'paid', updatedAt: '2026-06-29T08:30:08.123+00:00' },
  { id: 'mock-4', cycleId: 'mock-cycle', userId: 'mock-user-4', name: '노경훈', amountDue: 100000, amountPaid: 100000, status: 'paid', updatedAt: '2026-06-29T08:29:16.812+00:00' },
  { id: 'mock-5', cycleId: 'mock-cycle', userId: 'mock-user-5', name: '김성혁', amountDue: 100000, amountPaid: 0, status: 'unpaid', updatedAt: '2026-06-29T08:29:03.687326+00:00' },
  { id: 'mock-6', cycleId: 'mock-cycle', userId: 'mock-user-6', name: '황재현', amountDue: 100000, amountPaid: 0, status: 'unpaid', updatedAt: '2026-06-29T08:29:03.687326+00:00' },
  { id: 'mock-7', cycleId: 'mock-cycle', userId: 'mock-user-7', name: '김지현', amountDue: 100000, amountPaid: 0, status: 'unpaid', updatedAt: '2026-06-29T08:29:03.687326+00:00' },
]

const FALLBACK_TRANSACTIONS: TreasuryEntryItem[] = [
  { id: 'tx-1', clubId: 'mock-club', type: 'income', title: '6월 회비', amount: 50000, entryDate: '2026-06-22', memo: '김민수 1명' },
  { id: 'tx-2', clubId: 'mock-club', type: 'expense', title: '라운드 예약금', amount: 120000, entryDate: '2026-06-20', memo: '6월 정기 라운드' },
  { id: 'tx-3', clubId: 'mock-club', type: 'income', title: '출연금', amount: 100000, entryDate: '2026-06-18', memo: '박현영' },
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

function getMonthLabel(offset: number) {
  const base = new Date()
  const target = new Date(base.getFullYear(), base.getMonth() + offset, 1)
  return `${target.getFullYear()}년 ${target.getMonth() + 1}월`
}

function getMonthKey(offset: number) {
  const base = new Date()
  const target = new Date(base.getFullYear(), base.getMonth() + offset, 1)
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`
}

function formatAmountInput(value: string) {
  const digits = value.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('ko-KR')
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

function SummaryCard({ label, value, tone, active, onPress }: { label: string; value: string; tone?: string; active?: boolean; onPress?: () => void }) {
  const content = (
    <>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, tone ? { color: tone } : null]}>{value}</Text>
    </>
  )
  if (onPress) {
    return (
      <TouchableOpacity style={[s.summaryCard, active && s.summaryCardActive]} activeOpacity={0.82} onPress={onPress}>
        {content}
      </TouchableOpacity>
    )
  }
  return (
    <View style={s.summaryCard}>
      {content}
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
  const [treasuryMonthOffset, setTreasuryMonthOffset] = useState(0)
  const [paymentMonthOffset, setPaymentMonthOffset] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [partialEditorId, setPartialEditorId] = useState<string | null>(null)
  const [partialAmount, setPartialAmount] = useState('')
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)
  const [fallbackMembers, setFallbackMembers] = useState(FALLBACK_MEMBERS)
  const [paymentOverrides, setPaymentOverrides] = useState<Record<string, FeePaymentStatus>>({})
  const [policyOpen, setPolicyOpen] = useState(false)
  const [policySaving, setPolicySaving] = useState(false)
  const [policyFeeMode, setPolicyFeeMode] = useState<FeeMode>('monthly')
  const [policyAmount, setPolicyAmount] = useState('100000')
  const [selectedContributionUserId, setSelectedContributionUserId] = useState<string | null>(null)
  const [selectedDiscountUserId, setSelectedDiscountUserId] = useState<string | null>(null)
  const [contributionAmount, setContributionAmount] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [contributions, setContributions] = useState<PolicyAdjustmentItem[]>([])
  const [discounts, setDiscounts] = useState<PolicyAdjustmentItem[]>([])
  const [transactionEditorOpen, setTransactionEditorOpen] = useState(false)
  const [transactionItems, setTransactionItems] = useState<TreasuryEntryItem[]>([])
  const [transactionDraft, setTransactionDraft] = useState<TransactionDraft>({
    id: null,
    type: 'income',
    detail: '회비',
    customDetail: '',
    amount: '',
    memo: '',
    entryDate: todayLocal(),
  })

  const { data, loading, error } = useAsync(
    () => (club ? getFeeDashboard(club.id) : Promise.resolve(null)),
    [club?.id, refreshKey]
  )
  const { data: paymentData } = useAsync(
    () => (club ? getFeePaymentMonthData(club.id, paymentMonthOffset) : Promise.resolve(null)),
    [club?.id, refreshKey, paymentMonthOffset]
  )
  const { data: clubMembers } = useAsync(
    () => (club ? getClubMembers(club.id) : Promise.resolve([])),
    [club?.id]
  )

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1)
    }, [])
  )

  useEffect(() => {
    setPolicyFeeMode(data?.policy?.feeMode ?? 'monthly')
    setPolicyAmount(String(data?.policy?.defaultAmount ?? 100000))
    setContributions(data?.policy?.contributions ?? [])
    setDiscounts(data?.policy?.discounts ?? [])
  }, [data?.policy?.feeMode, data?.policy?.defaultAmount, data?.policy?.contributions, data?.policy?.discounts])

  const usingFallback = data?.connectionReady === false
  const usingPaymentFallback = paymentData?.connectionReady === false
  const members = useMemo(() => {
    if (usingPaymentFallback) return fallbackMembers
    if ((paymentData?.members ?? []).length > 0) return paymentData?.members ?? []
    return (clubMembers ?? []).map((member) => ({
      id: `empty-${member.userId}`,
      cycleId: paymentData?.cycle?.id ?? 'no-cycle',
      userId: member.userId,
      name: member.name,
      amountDue: paymentData?.cycle?.amount ?? (Number(policyAmount || 0) || 0),
      amountPaid: 0,
      status: 'unpaid' as FeePaymentStatus,
      updatedAt: '',
    }))
  }, [usingPaymentFallback, paymentData?.members, paymentData?.cycle?.id, paymentData?.cycle?.amount, clubMembers, policyAmount])
  const transactions = usingFallback ? FALLBACK_TRANSACTIONS : (data?.treasuryEntries ?? [])
  const isAdmin = club?.role === 'admin'
  const treasuryMonthLabel = getMonthLabel(treasuryMonthOffset)
  const paymentMonthLabel = paymentData?.cycle?.label ?? getMonthLabel(paymentMonthOffset)

  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <View style={s.headerActionRow}>
          <TouchableOpacity
            style={[s.headerPolicyBtn, !isAdmin && { opacity: 0.55 }]}
            activeOpacity={0.82}
            onPress={() => isAdmin && setPolicyOpen(true)}
            disabled={!isAdmin}
          >
            <Icon name="settings" size={15} color={C.accentText} />
            <Text style={s.headerPolicyBtnText}>정책</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.headerCloseBtn} onPress={() => nav.goBack()}>
            <Text style={s.headerCloseBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>
      ),
    })
  }, [isAdmin, nav])

  useEffect(() => {
    setTransactionItems(transactions)
  }, [transactions])

  const filteredMembers = useMemo(() => {
    const withOverride = members.map((member) => ({
      ...member,
      status: paymentOverrides[member.id] ?? member.status,
    }))
    if (paymentFilter === 'partial') return withOverride.filter((member) => member.status === 'partial')
    if (paymentFilter === 'unpaid') return withOverride.filter((member) => member.status === 'unpaid')
    return withOverride
  }, [members, paymentFilter, paymentOverrides])

  const filteredTransactions = useMemo(() => {
    const monthKey = getMonthKey(treasuryMonthOffset)
    const monthlyItems = transactionItems.filter((item) => item.entryDate.startsWith(monthKey))
    if (transactionFilter === 'income') return monthlyItems.filter((item) => item.type === 'income')
    if (transactionFilter === 'expense') return monthlyItems.filter((item) => item.type === 'expense')
    return monthlyItems
  }, [transactionItems, transactionFilter, treasuryMonthOffset])

  const paymentSummary = useMemo(() => {
    const totalDue = members.reduce((sum, member) => sum + member.amountDue, 0)
    const paidCount = members.filter((member) => member.status === 'paid').length
    const partialCount = members.filter((member) => member.status === 'partial').length
    const unpaidCount = members.filter((member) => member.status === 'unpaid').length
    return { totalDue, paidCount, partialCount, unpaidCount }
  }, [members])

  const treasurySummary = useMemo(() => {
    const monthKey = getMonthKey(treasuryMonthOffset)
    const previousItems = transactionItems.filter((item) => item.entryDate < monthKey)
    const monthlyItems = transactionItems.filter((item) => item.entryDate.startsWith(monthKey))
    const previousIncome = previousItems.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
    const previousExpense = previousItems.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    const income = monthlyItems.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
    const expense = monthlyItems.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    const previousBalance = previousIncome - previousExpense
    const balance = previousBalance + income - expense
    return { balance, previousBalance, income, expense, count: monthlyItems.length }
  }, [transactionItems, treasuryMonthOffset])

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
    const next: FeePaymentStatus = member.status === 'paid' ? 'unpaid' : 'paid'
    setPartialEditorId(null)
    setPartialAmount('')
    setPaymentOverrides((current) => ({ ...current, [member.id]: next }))

    const nextAmount = next === 'paid' ? member.amountDue : 0
    if (usingFallback) {
      updateFallbackMember(member.id, next, nextAmount)
      return
    }

    setSavingStatusId(member.id)
    try {
      await updateFeeMemberPayment(member.id, next, nextAmount)
      setRefreshKey((value) => value + 1)
      setPaymentOverrides((current) => {
        const nextMap = { ...current }
        delete nextMap[member.id]
        return nextMap
      })
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

  function upsertAdjustment(
    current: PolicyAdjustmentItem[],
    nextItem: PolicyAdjustmentItem
  ) {
    const existing = current.find((item) => item.userId === nextItem.userId)
    if (!existing) return [...current, nextItem]
    return current.map((item) => (item.userId === nextItem.userId ? nextItem : item))
  }

  function handleAddContribution() {
    if (!selectedContributionUserId || !contributionAmount.trim()) return
    const member = (clubMembers ?? []).find((item) => item.userId === selectedContributionUserId)
    if (!member) return
    setContributions((current) => upsertAdjustment(current, {
      userId: member.userId,
      name: member.name,
      amount: contributionAmount.replace(/[^0-9]/g, ''),
    }))
    setContributionAmount('')
  }

  function handleAddDiscount() {
    if (!selectedDiscountUserId || !discountAmount.trim()) return
    const member = (clubMembers ?? []).find((item) => item.userId === selectedDiscountUserId)
    if (!member) return
    setDiscounts((current) => upsertAdjustment(current, {
      userId: member.userId,
      name: member.name,
      amount: discountAmount.replace(/[^0-9]/g, ''),
    }))
    setDiscountAmount('')
  }

  function removeContribution(userId: string) {
    setContributions((current) => current.filter((item) => item.userId !== userId))
  }

  function removeDiscount(userId: string) {
    setDiscounts((current) => current.filter((item) => item.userId !== userId))
  }

  async function handleSavePolicy() {
    if (!club) return
    const amount = Number(policyAmount.replace(/[^0-9]/g, ''))
    if (!amount) return

    setPolicySaving(true)
    try {
      await saveClubFeePolicy({
        clubId: club.id,
        feeMode: policyFeeMode,
        defaultAmount: amount,
        visibility: data?.policy?.visibility ?? 'members',
        autoCreateCycles: data?.policy?.autoCreateCycles ?? true,
        active: true,
        contributions,
        discounts,
      })
      setPolicyOpen(false)
      setRefreshKey((value) => value + 1)
    } finally {
      setPolicySaving(false)
    }
  }

  function openTransactionEditor(item?: TreasuryEntryItem) {
    if (item) {
      const details = item.type === 'income' ? INCOME_DETAILS : EXPENSE_DETAILS
      const isDefaultDetail = details.includes(item.title as any)
      setTransactionDraft({
        id: item.id,
        type: item.type,
        detail: isDefaultDetail ? item.title : '기타',
        customDetail: isDefaultDetail ? '' : item.title,
        amount: item.amount.toLocaleString('ko-KR'),
        memo: item.memo ?? '',
        entryDate: item.entryDate,
      })
    } else {
      setTransactionDraft({
        id: null,
        type: 'income',
        detail: '회비',
        customDetail: '',
        amount: '',
        memo: '',
        entryDate: todayLocal(),
      })
    }
    setTransactionEditorOpen(true)
  }

  async function saveTransactionDraft() {
    const amount = Number(transactionDraft.amount.replace(/[^0-9]/g, ''))
    if (!amount) return
    const finalDetail = transactionDraft.detail === '기타' && transactionDraft.customDetail.trim()
      ? transactionDraft.customDetail.trim()
      : transactionDraft.detail

    const nextItem: TreasuryEntryItem = {
      id: transactionDraft.id ?? `draft-${Date.now()}`,
      clubId: club?.id ?? 'mock-club',
      type: transactionDraft.type,
      title: finalDetail,
      amount,
      entryDate: transactionDraft.entryDate,
      memo: transactionDraft.memo,
    }

    if (usingFallback) {
      setTransactionItems((current) => {
        if (!transactionDraft.id) return [nextItem, ...current]
        return current.map((item) => (item.id === transactionDraft.id ? nextItem : item))
      })
      setTransactionEditorOpen(false)
      return
    }

    if (!club?.id) return

    if (transactionDraft.id) {
      await updateTreasuryEntry(transactionDraft.id, {
        type: transactionDraft.type,
        title: finalDetail,
        amount,
        entryDate: transactionDraft.entryDate,
        memo: transactionDraft.memo,
      })
    } else {
      await createTreasuryEntry(club.id, {
        type: transactionDraft.type,
        title: finalDetail,
        amount,
        entryDate: transactionDraft.entryDate,
        memo: transactionDraft.memo,
      })
    }

    setTransactionEditorOpen(false)
    setRefreshKey((value) => value + 1)
  }

  async function deleteTransactionDraft() {
    if (!transactionDraft.id) {
      setTransactionEditorOpen(false)
      return
    }

    if (usingFallback) {
      setTransactionItems((current) => current.filter((item) => item.id !== transactionDraft.id))
      setTransactionEditorOpen(false)
      return
    }

    await deleteTreasuryEntry(transactionDraft.id)
    setTransactionEditorOpen(false)
    setRefreshKey((value) => value + 1)
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRefreshKey((value) => value + 1)} tintColor={C.green} />}
    >
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

      <View style={s.monthNavBar}>
        <TouchableOpacity
          style={s.monthNavBtn}
          onPress={() => activeTab === 'treasury' ? setTreasuryMonthOffset((value) => value - 1) : setPaymentMonthOffset((value) => value - 1)}
          activeOpacity={0.82}
        >
          <Icon name="chevronLeft" size={15} color={C.green} />
          <Text style={s.monthNavText}>이전달</Text>
        </TouchableOpacity>
        <View style={s.monthNavCenter}>
          <Text style={s.monthNavTitle}>{activeTab === 'treasury' ? treasuryMonthLabel : paymentMonthLabel}</Text>
        </View>
        <TouchableOpacity
          style={[s.monthNavBtn, { justifyContent: 'flex-end' }]}
          onPress={() => activeTab === 'treasury' ? setTreasuryMonthOffset((value) => value + 1) : setPaymentMonthOffset((value) => value + 1)}
          activeOpacity={0.82}
        >
          <Text style={s.monthNavText}>다음달</Text>
          <Icon name="chevronRight" size={15} color={C.green} />
        </TouchableOpacity>
      </View>

      {activeTab === 'treasury' ? (
        <>

          <View style={s.summaryGrid}>
            <SummaryCard label="전월잔액" value={formatKrw(treasurySummary.previousBalance)} />
            <SummaryCard label="현재잔액" value={formatKrw(treasurySummary.balance)} active={transactionFilter === 'all'} onPress={() => setTransactionFilter('all')} />
            <SummaryCard label="이번 달 입금" value={formatKrw(treasurySummary.income)} tone={C.green} active={transactionFilter === 'income'} onPress={() => setTransactionFilter('income')} />
            <SummaryCard label="이번 달 지급" value={formatKrw(treasurySummary.expense)} tone={C.danger} active={transactionFilter === 'expense'} onPress={() => setTransactionFilter('expense')} />
          </View>

          <View style={s.card}>
            <View style={s.monthCardHeader}>
              <Text style={s.sectionTitle}>거래 내역</Text>
            </View>

            <View style={s.transactionCardList}>
              {filteredTransactions.map((item) => (
                <TouchableOpacity key={item.id} style={s.transactionCard} activeOpacity={0.82} onPress={() => openTransactionEditor(item)}>
                  <View style={[s.transactionIcon, item.type === 'income' ? s.incomeIcon : s.expenseIcon]}>
                    <Text style={s.transactionIconText}>{item.type === 'income' ? '+' : '-'}</Text>
                  </View>
                  <View style={s.transactionBody}>
                    <View style={s.transactionTopRow}>
                      <Text style={s.transactionDate}>{formatShortDate(item.entryDate)}</Text>
                      <Text style={s.transactionTitle}>
                        {item.title === '기타' && item.memo ? item.memo : item.title}
                      </Text>
                    </View>
                  </View>
                  <Text style={[s.transactionAmount, { color: item.type === 'income' ? C.green : C.danger }]}>
                    {item.type === 'income' ? '+' : '-'}
                    {formatKrw(item.amount)}
                  </Text>
                </TouchableOpacity>
              ))}

              {filteredTransactions.length === 0 ? (
                <TouchableOpacity style={s.newTransactionCard} activeOpacity={0.82} onPress={() => openTransactionEditor()}>
                  <View style={s.newTransactionIcon}>
                    <Icon name="plus" size={16} color={C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.newTransactionTitle}>신규거래 추가</Text>
                    <Text style={s.newTransactionSub}>등록된 거래가 없습니다. 첫 거래를 추가해 주세요.</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.newTransactionCard} activeOpacity={0.82} onPress={() => openTransactionEditor()}>
                  <View style={s.newTransactionIcon}>
                    <Icon name="plus" size={16} color={C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.newTransactionTitle}>신규거래 추가</Text>
                    <Text style={s.newTransactionSub}>입금 또는 지급 항목을 새로 등록합니다.</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </>
      ) : (
        <>
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
            <View style={s.monthCardHeader}>
              <View style={s.monthInlineCenter}>
                <Text style={s.sectionTitle}>회원별 납부 상태</Text>
              </View>
            </View>

            <View style={s.memberGrid}>
              {filteredMembers.map((member) => {
                const isSaving = savingStatusId === member.id
                const isPaid = member.status === 'paid'

                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      s.memberToggle,
                      isPaid ? s.memberTogglePaid : s.memberToggleUnpaid,
                      isSaving && { opacity: 0.7 },
                    ]}
                    activeOpacity={0.82}
                    onPress={() => handleStatusToggle(member)}
                    disabled={isSaving}
                  >
                    <Text style={[s.memberToggleText, isPaid ? s.memberToggleTextPaid : s.memberToggleTextUnpaid]}>
                      {member.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
              {filteredMembers.length === 0 && (
                <View style={s.emptyPaymentBox}>
                  <Text style={s.emptyPaymentText}>해당 월 회비 데이터가 없습니다.</Text>
                </View>
              )}
            </View>
          </View>
        </>
      )}

      <Modal transparent animationType="fade" visible={policyOpen} onRequestClose={() => setPolicyOpen(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setPolicyOpen(false)}>
          <TouchableOpacity style={s.policyModal} activeOpacity={1} onPress={() => {}}>
            <View style={s.policyHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.policyTitle}>회비 정책</Text>
                <Text style={s.policyDescription}>회비 납부 방식과 회원별 출연금, 할인 기준을 설정합니다.</Text>
              </View>
              <TouchableOpacity style={s.policyCloseBtn} onPress={() => setPolicyOpen(false)}>
                <Text style={s.policyCloseText}>닫기</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.policySection}>
                <Text style={s.policySectionTitle}>회비 납부 방식</Text>
                <View style={s.segmentRow}>
                  <TouchableOpacity style={[s.segmentBtn, policyFeeMode === 'monthly' && s.segmentBtnActive]} onPress={() => setPolicyFeeMode('monthly')}>
                    <Text style={[s.segmentText, policyFeeMode === 'monthly' && s.segmentTextActive]}>월납</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.segmentBtn, policyFeeMode === 'yearly' && s.segmentBtnActive]} onPress={() => setPolicyFeeMode('yearly')}>
                    <Text style={[s.segmentText, policyFeeMode === 'yearly' && s.segmentTextActive]}>연납</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.policySection}>
                <Text style={s.policySectionTitle}>회비 금액</Text>
                <TextInput
                  style={s.policyInput}
                  value={policyAmount}
                  onChangeText={(value) => setPolicyAmount(value.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="금액 입력"
                  placeholderTextColor={C.muted}
                />
                <Text style={s.policyHint}>{policyFeeMode === 'monthly' ? '월 기준 회비 금액' : '연 기준 회비 금액'}</Text>
              </View>

              <View style={s.policySection}>
                <Text style={s.policySectionTitle}>출연금 설정</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.memberPickerRow}>
                  {(clubMembers ?? []).map((member) => (
                    <TouchableOpacity
                      key={member.userId}
                      style={[s.memberPickerChip, selectedContributionUserId === member.userId && s.memberPickerChipActive]}
                      onPress={() => setSelectedContributionUserId(member.userId)}
                    >
                      <Text style={[s.memberPickerText, selectedContributionUserId === member.userId && s.memberPickerTextActive]}>{member.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={s.policyInputRow}>
                  <TextInput
                    style={[s.policyInput, { flex: 1 }]}
                    value={contributionAmount}
                    onChangeText={(value) => setContributionAmount(value.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholder="출연금 입력"
                    placeholderTextColor={C.muted}
                  />
                  <TouchableOpacity style={s.policyAddBtn} onPress={handleAddContribution}>
                    <Text style={s.policyAddBtnText}>추가</Text>
                  </TouchableOpacity>
                </View>
                {contributions.map((item) => (
                  <View key={item.userId} style={s.policyListRow}>
                    <Text style={s.policyListName}>{item.name}</Text>
                    <Text style={s.policyListAmount}>{formatKrw(Number(item.amount || 0))}</Text>
                    <TouchableOpacity style={s.policyDeleteBtn} onPress={() => removeContribution(item.userId)}>
                      <Text style={s.policyDeleteText}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={s.policySection}>
                <Text style={s.policySectionTitle}>할인 설정</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.memberPickerRow}>
                  {(clubMembers ?? []).map((member) => (
                    <TouchableOpacity
                      key={member.userId}
                      style={[s.memberPickerChip, selectedDiscountUserId === member.userId && s.memberPickerChipActive]}
                      onPress={() => setSelectedDiscountUserId(member.userId)}
                    >
                      <Text style={[s.memberPickerText, selectedDiscountUserId === member.userId && s.memberPickerTextActive]}>{member.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={s.policyInputRow}>
                  <TextInput
                    style={[s.policyInput, { flex: 1 }]}
                    value={discountAmount}
                    onChangeText={(value) => setDiscountAmount(value.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholder="할인 금액 입력"
                    placeholderTextColor={C.muted}
                  />
                  <TouchableOpacity style={s.policyAddBtn} onPress={handleAddDiscount}>
                    <Text style={s.policyAddBtnText}>추가</Text>
                  </TouchableOpacity>
                </View>
                {discounts.map((item) => (
                  <View key={item.userId} style={s.policyListRow}>
                    <Text style={s.policyListName}>{item.name}</Text>
                    <Text style={s.policyListAmount}>{formatKrw(Number(item.amount || 0))}</Text>
                    <TouchableOpacity style={s.policyDeleteBtn} onPress={() => removeDiscount(item.userId)}>
                      <Text style={s.policyDeleteText}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={[s.policySaveBtn, policySaving && { opacity: 0.7 }]} onPress={handleSavePolicy} disabled={policySaving}>
              <Text style={s.policySaveText}>{policySaving ? '저장 중...' : '정책 저장'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal transparent animationType="fade" visible={transactionEditorOpen} onRequestClose={() => setTransactionEditorOpen(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setTransactionEditorOpen(false)}>
          <TouchableOpacity style={s.policyModal} activeOpacity={1} onPress={() => {}}>
            <View style={s.policyHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.policyTitle}>{transactionDraft.id ? '거래 수정' : '신규거래 추가'}</Text>
              </View>
              <TouchableOpacity style={s.policyCloseBtn} onPress={() => setTransactionEditorOpen(false)}>
                <Text style={s.policyCloseText}>닫기</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.policySection}>
                <Text style={s.policySectionTitle}>구분</Text>
                <View style={s.segmentRow}>
                  <TouchableOpacity
                    style={[s.segmentBtn, transactionDraft.type === 'income' && s.segmentBtnActive]}
                    onPress={() => setTransactionDraft((current) => ({
                      ...current,
                      type: 'income',
                      detail: INCOME_DETAILS.includes(current.detail as any) ? current.detail : '회비',
                      customDetail: '',
                    }))}
                  >
                    <Text style={[s.segmentText, transactionDraft.type === 'income' && s.segmentTextActive]}>입금</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.segmentBtn, transactionDraft.type === 'expense' && s.segmentBtnActive]}
                    onPress={() => setTransactionDraft((current) => ({
                      ...current,
                      type: 'expense',
                      detail: EXPENSE_DETAILS.includes(current.detail as any) ? current.detail : '캐디피',
                      customDetail: '',
                    }))}
                  >
                    <Text style={[s.segmentText, transactionDraft.type === 'expense' && s.segmentTextActive]}>지급</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.policySection}>
                <Text style={s.policySectionTitle}>날짜</Text>
                <DateField
                  value={transactionDraft.entryDate}
                  onChange={(entryDate) => setTransactionDraft((current) => ({ ...current, entryDate }))}
                />
              </View>

              <View style={s.policySection}>
                <Text style={s.policySectionTitle}>세부항목</Text>
                <View style={s.detailGrid}>
                  {(transactionDraft.type === 'income' ? INCOME_DETAILS : EXPENSE_DETAILS).map((detail) => (
                    <TouchableOpacity
                      key={detail}
                      style={[s.detailChip, transactionDraft.detail === detail && s.detailChipActive]}
                      onPress={() => setTransactionDraft((current) => ({
                        ...current,
                        detail,
                        customDetail: detail === '기타' ? current.customDetail : '',
                      }))}
                    >
                      <Text style={[s.detailChipText, transactionDraft.detail === detail && s.detailChipTextActive]}>{detail}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {transactionDraft.detail === '기타' ? (
                  <TextInput
                    style={[s.policyInput, { marginTop: 10 }]}
                    value={transactionDraft.customDetail}
                    onChangeText={(customDetail) => setTransactionDraft((current) => ({ ...current, customDetail }))}
                    placeholder="세부항목 직접 입력"
                    placeholderTextColor={C.muted}
                  />
                ) : null}
              </View>

              <View style={s.policySection}>
                <Text style={s.policySectionTitle}>금액</Text>
                <TextInput
                  style={s.policyInput}
                  value={transactionDraft.amount}
                  onChangeText={(value) => setTransactionDraft((current) => ({ ...current, amount: formatAmountInput(value) }))}
                  keyboardType="numeric"
                  placeholder="금액 입력"
                  placeholderTextColor={C.muted}
                />
              </View>

              <View style={s.policySection}>
                <Text style={s.policySectionTitle}>비고</Text>
                <TextInput
                  style={[s.policyInput, s.memoInput]}
                  value={transactionDraft.memo}
                  onChangeText={(value) => setTransactionDraft((current) => ({ ...current, memo: value }))}
                  placeholder="비고 입력"
                  placeholderTextColor={C.muted}
                  multiline
                />
              </View>
            </ScrollView>

            <View style={s.editorActionRow}>
              <TouchableOpacity style={s.editorDeleteBtn} onPress={deleteTransactionDraft}>
                <Text style={s.editorDeleteText}>삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.editorSaveBtn} onPress={saveTransactionDraft}>
                <Text style={s.policySaveText}>저장</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  headerActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  headerPolicyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerPolicyBtnText: { color: C.accentText, fontSize: 12, fontWeight: '800' },
  headerCloseBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerCloseBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
  summaryCardActive: { borderColor: C.green, backgroundColor: C.greenLight },
  summaryLabel: { fontSize: 11, color: C.muted, fontWeight: '700' },
  summaryValue: { fontSize: 18, color: C.text, fontWeight: '900', marginTop: 8 },
  monthCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  monthInlineCenter: { flex: 1, alignItems: 'center' },
  monthNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  monthNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 72 },
  monthNavText: { fontSize: 12, fontWeight: '800', color: C.green },
  monthNavCenter: { flex: 1, alignItems: 'center' },
  monthNavTitle: { fontSize: 14, fontWeight: '900', color: C.text },
  monthNavLabel: { fontSize: 11, fontWeight: '700', color: C.muted, marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  chipActiveText: { color: C.accentText, fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  sectionAction: { fontSize: 12, fontWeight: '800', color: C.green },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emptyPaymentBox: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#f8fbf8',
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPaymentText: { fontSize: 13, fontWeight: '700', color: C.muted },
  memberToggle: {
    width: '23%',
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  memberTogglePaid: { backgroundColor: '#e9f8ef', borderColor: '#c7ebd3' },
  memberToggleUnpaid: { backgroundColor: '#fdeeee', borderColor: '#f5c9c3' },
  memberToggleText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  memberToggleTextPaid: { color: C.green },
  memberToggleTextUnpaid: { color: '#d65b4a' },
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
  transactionCardList: { gap: 10 },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#fbfcfa',
    borderWidth: 1,
    borderColor: C.border,
  },
  transactionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  incomeIcon: { backgroundColor: C.greenLight },
  expenseIcon: { backgroundColor: '#fbe8e5' },
  transactionIconText: { fontSize: 15, fontWeight: '900', color: C.text },
  transactionBody: { flex: 1, minWidth: 0 },
  transactionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  transactionDate: { fontSize: 12, fontWeight: '800', color: C.muted },
  transactionTitle: { fontSize: 13, fontWeight: '800', color: C.text },
  transactionMeta: { fontSize: 12, color: C.muted, marginTop: 4 },
  transactionAmount: { fontSize: 13, fontWeight: '900' },
  newTransactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    backgroundColor: '#f6fbf7',
  },
  newTransactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.greenLight,
  },
  newTransactionTitle: { fontSize: 14, fontWeight: '900', color: C.text },
  newTransactionSub: { fontSize: 12, color: C.muted, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: C.greenLight },
  secondaryBtnText: { color: C.green, fontSize: 13, fontWeight: '900' },
  primaryBtn: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: C.accent },
  primaryBtnText: { color: C.accentText, fontSize: 13, fontWeight: '900' },
  ghostLink: { marginTop: 12, borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  ghostLinkText: { color: C.text, fontSize: 13, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  policyModal: { backgroundColor: C.card, borderRadius: 22, padding: 18, maxHeight: '84%' },
  policyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  policyTitle: { fontSize: 18, fontWeight: '900', color: C.text },
  policyDescription: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 6 },
  policyCloseBtn: { backgroundColor: C.greenLight, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  policyCloseText: { color: C.green, fontSize: 12, fontWeight: '800' },
  policySection: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  policySectionTitle: { fontSize: 14, fontWeight: '900', color: C.text, marginBottom: 10 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff' },
  segmentBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  segmentText: { fontSize: 13, fontWeight: '800', color: C.muted },
  segmentTextActive: { color: C.accentText },
  policyInput: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 14,
    color: C.text,
  },
  policyHint: { fontSize: 11, color: C.muted, marginTop: 8 },
  memberPickerRow: { gap: 8, paddingBottom: 2 },
  memberPickerChip: { borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8 },
  memberPickerChipActive: { backgroundColor: C.greenLight, borderColor: C.greenLight },
  memberPickerText: { fontSize: 12, fontWeight: '700', color: C.muted },
  memberPickerTextActive: { color: C.green },
  policyInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  policyAddBtn: { borderRadius: 14, backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 12 },
  policyAddBtnText: { color: C.accentText, fontSize: 12, fontWeight: '900' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  detailChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  detailChipText: { fontSize: 12, fontWeight: '700', color: C.muted },
  detailChipTextActive: { color: C.accentText },
  memoInput: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' as const },
  editorActionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  editorDeleteBtn: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#f7ece8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  editorDeleteText: { color: C.danger, fontSize: 14, fontWeight: '900' },
  editorSaveBtn: {
    flex: 1,
    marginTop: 0,
    borderRadius: 16,
    backgroundColor: C.green,
    paddingVertical: 14,
    alignItems: 'center',
  },
  policyListRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  policyListName: { flex: 1, fontSize: 13, fontWeight: '800', color: C.text },
  policyListAmount: { fontSize: 13, fontWeight: '800', color: C.text },
  policyDeleteBtn: { borderRadius: 12, backgroundColor: '#f7ece8', paddingHorizontal: 10, paddingVertical: 7 },
  policyDeleteText: { fontSize: 11, fontWeight: '800', color: C.danger },
  policySaveBtn: { marginTop: 14, borderRadius: 16, backgroundColor: C.green, paddingVertical: 14, alignItems: 'center' },
  policySaveText: { color: '#fff', fontSize: 14, fontWeight: '900' },
})

