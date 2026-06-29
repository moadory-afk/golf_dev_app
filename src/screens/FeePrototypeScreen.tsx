import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { C } from '../theme'
import { Icon } from '../components/Icon'

type FeeStatus = '완납' | '일부납' | '미납'

const members: Array<{ name: string; status: FeeStatus; amount: string; updatedAt: string }> = [
  { name: '김민준', status: '일부납', amount: '30,000원', updatedAt: '06.21' },
  { name: '이서연', status: '일부납', amount: '20,000원', updatedAt: '06.19' },
  { name: '박지훈', status: '미납', amount: '50,000원', updatedAt: '06.01' },
  { name: '최유진', status: '완납', amount: '50,000원', updatedAt: '06.12' },
]

const transactions = [
  { type: '입금', title: '6월 회비', amount: '+50,000원', date: '06.22' },
  { type: '지급', title: '라운드 예약금', amount: '-120,000원', date: '06.20' },
  { type: '입금', title: '찬조금', amount: '+100,000원', date: '06.18' },
  { type: '지급', title: '간식비', amount: '-35,000원', date: '06.16' },
  { type: '입금', title: '6월 회비', amount: '+50,000원', date: '06.15' },
]

function statusColor(status: FeeStatus) {
  if (status === '완납') return C.green
  if (status === '일부납') return C.warn
  return C.danger
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
      {action && <Text style={s.sectionAction}>{action}</Text>}
    </View>
  )
}

export default function FeePrototypeScreen() {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroEyebrow}>고고파 골프회</Text>
          <Text style={s.heroTitle}>2026년 6월 회비</Text>
          <Text style={s.heroSub}>가장 최근 생성된 회차 기준</Text>
        </View>
        <TouchableOpacity style={s.policyBtn} activeOpacity={0.82}>
          <Icon name="settings" size={15} color={C.accentText} />
          <Text style={s.policyBtnText}>정책</Text>
        </TouchableOpacity>
      </View>

      <View style={s.summaryGrid}>
        <SummaryCard label="총 회비" value="850,000원" />
        <SummaryCard label="완납" value="14명" tone={C.green} />
        <SummaryCard label="일부납" value="2명" tone={C.warn} />
        <SummaryCard label="미납" value="1명" tone={C.danger} />
      </View>

      <View style={s.toolRow}>
        <View style={[s.chip, s.chipActive]}><Text style={s.chipActiveText}>전체</Text></View>
        <View style={s.chip}><Text style={s.chipText}>일부납</Text></View>
        <View style={s.chip}><Text style={s.chipText}>미납</Text></View>
        <View style={s.searchChip}><Text style={s.chipText}>검색</Text></View>
      </View>

      <View style={s.card}>
        <SectionTitle title="회원별 납부 상태" action="일부납 우선" />
        {members.map((member) => (
          <TouchableOpacity key={member.name} style={s.memberRow} activeOpacity={0.84}>
            <View style={{ flex: 1 }}>
              <Text style={s.memberName}>{member.name}</Text>
              <Text style={s.memberMeta}>최근 변경 {member.updatedAt}</Text>
            </View>
            <Text style={s.memberAmount}>{member.amount}</Text>
            <View style={[s.statusBadge, { backgroundColor: `${statusColor(member.status)}18` }]}>
              <Text style={[s.statusText, { color: statusColor(member.status) }]}>{member.status}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.card}>
        <SectionTitle title="자금 현황" action="전체 보기" />
        <View style={s.treasurySummary}>
          <View style={s.balanceBox}>
            <Text style={s.summaryLabel}>현재 잔액</Text>
            <Text style={s.balanceValue}>1,240,000원</Text>
          </View>
          <View style={s.flowRow}>
            <View style={s.flowBox}>
              <Text style={s.summaryLabel}>이번 달 입금</Text>
              <Text style={[s.flowValue, { color: C.green }]}>850,000원</Text>
            </View>
            <View style={s.flowBox}>
              <Text style={s.summaryLabel}>이번 달 지급</Text>
              <Text style={[s.flowValue, { color: C.danger }]}>320,000원</Text>
            </View>
          </View>
        </View>

        <View style={s.transactionTabs}>
          <Text style={[s.tabText, s.tabTextActive]}>전체</Text>
          <Text style={s.tabText}>입금</Text>
          <Text style={s.tabText}>지급</Text>
        </View>

        {transactions.map((item) => (
          <View key={`${item.title}-${item.date}-${item.amount}`} style={s.transactionRow}>
            <View style={[s.transactionIcon, item.type === '입금' ? s.incomeIcon : s.expenseIcon]}>
              <Text style={s.transactionIconText}>{item.type === '입금' ? '+' : '-'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.transactionTitle}>{item.title}</Text>
              <Text style={s.memberMeta}>{item.date}</Text>
            </View>
            <Text style={[s.transactionAmount, { color: item.type === '입금' ? C.green : C.danger }]}>{item.amount}</Text>
          </View>
        ))}

        <View style={s.actionRow}>
          <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.82}>
            <Text style={s.secondaryBtnText}>입금 등록</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.primaryBtn} activeOpacity={0.82}>
            <Text style={s.primaryBtnText}>지급 등록</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 8 },
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
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryLabel: { fontSize: 11, color: C.muted, fontWeight: '700' },
  summaryValue: { fontSize: 18, color: C.text, fontWeight: '900', marginTop: 8 },
  toolRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  chipActiveText: { color: C.accentText, fontSize: 12, fontWeight: '800' },
  searchChip: { marginLeft: 'auto', backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  sectionAction: { fontSize: 12, fontWeight: '800', color: C.green },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  memberName: { fontSize: 14, fontWeight: '800', color: C.text },
  memberMeta: { fontSize: 11, color: C.muted, marginTop: 3 },
  memberAmount: { fontSize: 13, fontWeight: '800', color: C.text },
  statusBadge: { minWidth: 54, alignItems: 'center', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '900' },
  treasurySummary: { gap: 10 },
  balanceBox: { backgroundColor: C.greenLight, borderRadius: 16, padding: 14 },
  balanceValue: { fontSize: 24, color: C.text, fontWeight: '900', marginTop: 8 },
  flowRow: { flexDirection: 'row', gap: 10 },
  flowBox: { flex: 1, backgroundColor: C.bg, borderRadius: 14, padding: 12 },
  flowValue: { fontSize: 15, fontWeight: '900', marginTop: 7 },
  transactionTabs: { flexDirection: 'row', gap: 14, marginTop: 16, marginBottom: 4 },
  tabText: { fontSize: 12, fontWeight: '800', color: C.muted },
  tabTextActive: { color: C.text },
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
})
