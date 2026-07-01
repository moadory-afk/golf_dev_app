import { supabase } from './supabase'
import { selectShinperioHoles } from '../features/shinperio'

export interface PlayerScore {
  name: string
  strokes: number[]
}

export interface BaepanConditions {
  strokeOverpar: boolean  // 파3 더블↑ / 파4이상 트리플↑
  tie: boolean            // 2명이상 동타
  birdie: boolean         // 버디 이하
}

export interface SettlementConfig {
  participants: string[]
  strokeFee: number
  birdieBonus: 5000 | 10000
  baepanConditions?: BaepanConditions
}

export interface SavedRound {
  id: string
  date: string
  courseName: string
  pars: number[]
  shinperioHoles: number[]
  players: PlayerScore[]
  handicaps?: Record<string, number>
  photoData: string[]
  settlement?: SettlementConfig
  golfCourseId?: string
  isComplete: boolean
}

interface RoundRow {
  id: string
  date: string
  course_name: string
  pars: number[]
  shinperio_holes: number[]
  players: PlayerScore[]
  handicaps?: Record<string, number>
  photo_data?: string[]
  settlement?: SettlementConfig
  golf_course_id?: string
  is_complete?: boolean
}

function fromRow(row: RoundRow): SavedRound {
  return {
    id: row.id,
    date: row.date,
    courseName: row.course_name,
    pars: row.pars,
    shinperioHoles: row.shinperio_holes,
    players: row.players,
    handicaps: row.handicaps,
    photoData: row.photo_data ?? [],
    settlement: row.settlement,
    golfCourseId: row.golf_course_id,
    isComplete: row.is_complete ?? false,
  }
}

async function getUser() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

export async function getRounds(clubId: string): Promise<SavedRound[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, date, course_name, pars, shinperio_holes, players, handicaps, is_complete')
    .eq('club_id', clubId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function getRound(id: string): Promise<SavedRound | null> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data) : null
}

// 같은 홀은 기존 값 유지, 새로 채워진 홀(타수>0)만 반영 → "변경분만 업데이트"
function mergeStrokes(existing: number[], incoming: number[]): number[] {
  const len = Math.max(existing.length, incoming.length, 18)
  return Array.from({ length: len }, (_, i) => {
    const inc = incoming[i] ?? 0
    return inc > 0 ? inc : (existing[i] ?? 0)
  })
}

// 선수 이름 기준 병합. 기존에 없으면 추가, 있으면 홀별 스코어를 병합한다.
function mergePlayers(existing: PlayerScore[], incoming: PlayerScore[]): PlayerScore[] {
  const byName = new Map(existing.map((p) => [p.name, { name: p.name, strokes: [...p.strokes] }]))
  for (const inc of incoming) {
    const cur = byName.get(inc.name)
    if (cur) cur.strokes = mergeStrokes(cur.strokes, inc.strokes)
    else byName.set(inc.name, { name: inc.name, strokes: [...inc.strokes] })
  }
  return [...byName.values()]
}

async function getRoundClubId(id: string): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('rounds')
    .select('club_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  const row = data as { club_id?: string } | null
  return row?.club_id
}

async function computeHandicapSnapshot(
  clubId: string,
  date: string,
  players: PlayerScore[],
  basis = 5,
  excludeRoundId?: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, date, course_name, pars, shinperio_holes, players, handicaps, is_complete')
    .eq('club_id', clubId)
    .lt('date', date)
    .order('date', { ascending: true })
  if (error) throw error

  const priorRounds = ((data ?? []) as RoundRow[])
    .filter((r) => r.id !== excludeRoundId)
    .map(fromRow)
  const names = players.map((p) => p.name)
  return Object.fromEntries(names.map((name) => [name, handicapBefore(name, priorRounds, date, basis)]))
}

export async function saveRound(input: {
  courseName: string
  pars: number[]
  players: PlayerScore[]
  date?: string
  photoData?: string[]
  clubId?: string
  settlement?: SettlementConfig
  golfCourseId?: string
}): Promise<SavedRound> {
  const user = await getUser()
  if (!user) throw new Error('로그인이 필요합니다.')
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  const handicaps = input.clubId
    ? await computeHandicapSnapshot(input.clubId, date, input.players)
    : {}

  // 중복 방지: 키 = 날짜 + 선수 + 홀별 스코어 (골프장/코스는 무시)
  // 같은 클럽·같은 날짜에 선수가 겹치는 라운드가 있으면 그 라운드에 병합한다.
  if (input.clubId) {
    const incomingNames = new Set(input.players.map((p) => p.name))
    const { data: sameDay } = await supabase
      .from('rounds')
      .select('*')
      .eq('club_id', input.clubId)
      .eq('date', date)
    const existingRow = ((sameDay ?? []) as RoundRow[]).find((r) =>
      r.course_name === input.courseName || (r.players ?? []).some((p) => incomingNames.has(p.name))
    )
    if (existingRow) {
      const existing = fromRow(existingRow)
      const players = mergePlayers(existing.players, input.players)
      const payload: Record<string, unknown> = {
        players,
        handicaps: await computeHandicapSnapshot(input.clubId, date, players, 5, existing.id),
      }
      if (input.settlement) payload.settlement = input.settlement
      if (input.photoData && input.photoData.length > 0)
        payload.photo_data = [...existing.photoData, ...input.photoData]
      const { data, error } = await supabase
        .from('rounds').update(payload).eq('id', existingRow.id).select().single()
      if (error) throw error
      return fromRow(data)
    }
  }

  const payload: Record<string, unknown> = {
    user_id: user.id,
    date,
    course_name: input.courseName || '이름 없는 코스',
    pars: input.pars,
    shinperio_holes: selectShinperioHoles(12),
    players: input.players,
    handicaps,
    photo_data: input.photoData ?? [],
  }
  if (input.clubId) payload.club_id = input.clubId
  if (input.settlement) payload.settlement = input.settlement
  if (input.golfCourseId) payload.golf_course_id = input.golfCourseId
  const { data, error } = await supabase.from('rounds').insert(payload).select().single()
  if (error) throw error
  return fromRow(data)
}

export async function createRoundDraft(input: {
  courseName: string
  pars: number[]
  players: PlayerScore[]
  date?: string
  clubId?: string
  settlement?: SettlementConfig
  golfCourseId?: string
}): Promise<SavedRound> {
  const user = await getUser()
  if (!user) throw new Error('로그인이 필요합니다.')
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  const handicaps = input.clubId
    ? await computeHandicapSnapshot(input.clubId, date, input.players)
    : {}
  const payload: Record<string, unknown> = {
    user_id: user.id,
    date,
    course_name: input.courseName || '이름 없는 코스',
    pars: input.pars,
    shinperio_holes: selectShinperioHoles(12),
    players: input.players,
    handicaps,
    photo_data: [],
  }
  if (input.clubId) payload.club_id = input.clubId
  if (input.settlement) payload.settlement = input.settlement
  if (input.golfCourseId) payload.golf_course_id = input.golfCourseId
  const { data, error } = await supabase.from('rounds').insert(payload).select().single()
  if (error) throw error
  return fromRow(data)
}

export async function updateRound(
  id: string,
  input: { courseName: string; pars: number[]; players: PlayerScore[]; date?: string; photoData?: string[]; settlement?: SettlementConfig; golfCourseId?: string }
): Promise<SavedRound> {
  const current = await getRound(id)
  const date = input.date ?? current?.date ?? new Date().toISOString().slice(0, 10)
  const payload: Record<string, unknown> = {
    course_name: input.courseName || '이름 없는 코스',
    pars: input.pars,
    players: input.players,
  }
  if (input.date) payload.date = input.date
  const clubId = await getRoundClubId(id)
  if (clubId) payload.handicaps = await computeHandicapSnapshot(clubId, date, input.players, 5, id)
  if (input.photoData && input.photoData.length > 0) payload.photo_data = input.photoData
  if (input.settlement !== undefined) payload.settlement = input.settlement
  if (input.golfCourseId) payload.golf_course_id = input.golfCourseId
  const { data, error } = await supabase.from('rounds').update(payload).eq('id', id).select().single()
  if (error) throw error
  return fromRow(data)
}

export async function updateRoundSettlement(id: string, settlement: SettlementConfig): Promise<void> {
  const { error } = await supabase.from('rounds').update({ settlement }).eq('id', id)
  if (error) throw error
}

// ─── Club member system ───────────────────────────────────────────────────────

export interface ClubInfo {
  id: string
  name: string
  subtitle: string
  inviteCode: string
  role: 'admin' | 'member'
  icon: string
}

export async function ensureProfile(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({ id: userId, name })
  if (error) throw error
}

export async function getMyClub(): Promise<ClubInfo | null> {
  const user = await getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('club_members')
    .select('club_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return null

  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, subtitle, invite_code')
    .eq('id', membership.club_id)
    .maybeSingle()

  if (!club) return null

  return {
    id: club.id,
    name: club.name,
    subtitle: club.subtitle ?? '',
    inviteCode: club.invite_code,
    role: membership.role as 'admin' | 'member',
    icon: '⛳',
  }
}

export async function getMyClubs(): Promise<ClubInfo[]> {
  const user = await getUser()
  if (!user) return []

  const { data: memberships } = await supabase
    .from('club_members')
    .select('club_id, role')
    .eq('user_id', user.id)

  if (!memberships || memberships.length === 0) return []

  const clubIds = memberships.map((m) => m.club_id)
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name, subtitle, invite_code')
    .in('id', clubIds)

  if (!clubs) return []

  return clubs.map((club) => {
    const membership = memberships.find((m) => m.club_id === club.id)!
    return {
      id: club.id,
      name: club.name,
      subtitle: club.subtitle ?? '',
      inviteCode: club.invite_code,
      role: membership.role as 'admin' | 'member',
      icon: '⛳',
    }
  })
}

export async function createClub(name: string, subtitle: string, icon?: string): Promise<ClubInfo> {
  const user = await getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .insert({ name, subtitle, invite_code: inviteCode, created_by: user.id })
    .select()
    .single()
  if (clubError) throw clubError

  const { error: memberError } = await supabase
    .from('club_members')
    .insert({ club_id: club.id, user_id: user.id, role: 'admin' })
  if (memberError) throw memberError

  await supabase.from('rounds').update({ club_id: club.id }).is('club_id', null)

  return {
    id: club.id,
    name: club.name,
    subtitle: club.subtitle ?? '',
    inviteCode: club.invite_code,
    role: 'admin',
    icon: icon ?? '⛳',
  }
}

export async function joinClub(inviteCode: string): Promise<ClubInfo> {
  const user = await getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data: club, error: findError } = await supabase
    .from('clubs')
    .select('id, name, subtitle, invite_code')
    .eq('invite_code', inviteCode.toUpperCase())
    .maybeSingle()
  if (findError) throw findError
  if (!club) throw new Error('초대코드가 올바르지 않습니다.')

  const { error: memberError } = await supabase
    .from('club_members')
    .insert({ club_id: club.id, user_id: user.id, role: 'member' })
  if (memberError) {
    if (memberError.code === '23505') throw new Error('이미 가입된 클럽입니다.')
    throw memberError
  }

  return {
    id: club.id,
    name: club.name,
    subtitle: club.subtitle ?? '',
    inviteCode: club.invite_code,
    role: 'member',
    icon: '⛳',
  }
}

export async function getClubMembers(clubId: string): Promise<Array<{ userId: string; name: string; role: string }>> {
  // Step 1: club_members 조회 (JOIN 없이)
  const { data: members, error } = await supabase
    .from('club_members')
    .select('user_id, role')
    .eq('club_id', clubId)
  if (error) throw error
  if (!members || members.length === 0) return []

  // Step 2: 해당 userId들의 프로필 이름 조회
  const userIds = members.map((m) => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds)

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; name: string }) => [p.id, p.name])
  )
  return members.map((m) => ({
    userId: m.user_id,
    name: profileMap.get(m.user_id) ?? '(이름 없음)',
    role: m.role,
  }))
}

export async function removeMember(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function updateMemberRole(clubId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  const { error } = await supabase
    .from('club_members')
    .update({ role })
    .eq('club_id', clubId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function updateClubSettings(clubId: string, name: string, subtitle: string, icon?: string): Promise<void> {
  // icon 컬럼은 Supabase에 추가 후 활성화: ALTER TABLE clubs ADD COLUMN icon TEXT DEFAULT '⛳';
  const { error } = await supabase.from('clubs').update({ name, subtitle }).eq('id', clubId)
  if (error) throw error
}

export async function getClubSettlement(clubId: string): Promise<SettlementConfig | null> {
  const { data, error } = await supabase
    .from('clubs')
    .select('settlement')
    .eq('id', clubId)
    .maybeSingle()
  if (error) throw error
  return (data?.settlement as SettlementConfig | null) ?? null
}

export async function saveClubSettlement(clubId: string, config: SettlementConfig | null): Promise<void> {
  const { error } = await supabase.from('clubs').update({ settlement: config }).eq('id', clubId)
  if (error) throw error
}

export type FeeMode = 'monthly' | 'yearly'
export type FeeVisibility = 'admin_only' | 'members'
export type FeePaymentStatus = 'paid' | 'partial' | 'unpaid'
export type TreasuryEntryType = 'income' | 'expense'
export type FeePolicyAdjustmentType = 'contribution' | 'discount'

export interface FeePolicyAdjustmentItem {
  userId: string
  name: string
  amount: string
}

export interface ClubFeePolicy {
  clubId: string
  feeMode: FeeMode
  defaultAmount: number
  visibility: FeeVisibility
  autoCreateCycles: boolean
  active: boolean
  contributions: FeePolicyAdjustmentItem[]
  discounts: FeePolicyAdjustmentItem[]
}

export interface ClubFeeCycle {
  id: string
  clubId: string
  cycleKey: string
  label: string
  feeYear: number
  feeMonth: number | null
  amount: number
  dueDate: string | null
  status: 'open' | 'closed'
}

export interface FeeMemberStatusItem {
  id: string
  cycleId: string
  userId: string
  name: string
  amountDue: number
  amountPaid: number
  status: FeePaymentStatus
  updatedAt: string
  cycleLabel?: string
  feeYear?: number
  feeMonth?: number | null
}

export interface TreasuryEntryItem {
  id: string
  clubId: string
  type: TreasuryEntryType
  title: string
  amount: number
  entryDate: string
  memo: string
}

export interface FeeDashboardData {
  connectionReady: boolean
  policy: ClubFeePolicy | null
  cycle: ClubFeeCycle | null
  members: FeeMemberStatusItem[]
  treasuryEntries: TreasuryEntryItem[]
}

export interface FeePaymentMonthData {
  connectionReady: boolean
  policy: ClubFeePolicy | null
  cycle: ClubFeeCycle | null
  members: FeeMemberStatusItem[]
}

function isFeeTableMissing(err: any): boolean {
  const code = err?.code ?? ''
  const message = String(err?.message ?? '')
  return code === '42P01' || message.includes('club_fee_') || message.includes('club_treasury_entries')
}

function isFeeAdjustmentTableMissing(err: any): boolean {
  const code = err?.code ?? ''
  const message = String(err?.message ?? '')
  return code === '42P01' || message.includes('club_fee_policy_adjustments')
}

function getCycleParts(mode: FeeMode, now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (mode === 'yearly') {
    return {
      cycleKey: `${year}`,
      label: `${year}년 회비`,
      feeYear: year,
      feeMonth: null as number | null,
    }
  }
  return {
    cycleKey: `${year}-${String(month).padStart(2, '0')}`,
    label: `${year}년 ${month}월 회비`,
    feeYear: year,
    feeMonth: month,
  }
}

function getCyclePartsByOffset(mode: FeeMode, offset: number, now = new Date()) {
  if (mode === 'yearly') {
    return getCycleParts(mode, new Date(now.getFullYear() + offset, 0, 1))
  }
  return getCycleParts(mode, new Date(now.getFullYear(), now.getMonth() + offset, 1))
}

export function feeStatusToKorean(status: FeePaymentStatus): '완납' | '일부납' | '미납' {
  if (status === 'paid') return '완납'
  if (status === 'partial') return '일부납'
  return '미납'
}

function normalizeCycleRow(row: any): ClubFeeCycle {
  return {
    id: row.id,
    clubId: row.club_id,
    cycleKey: row.cycle_key,
    label: row.label,
    feeYear: row.fee_year,
    feeMonth: row.fee_month ?? null,
    amount: row.amount ?? 0,
    dueDate: row.due_date ?? null,
    status: row.status ?? 'open',
  }
}

function normalizePolicyRow(row: any): ClubFeePolicy {
  return {
    clubId: row.club_id,
    feeMode: row.fee_mode,
    defaultAmount: row.default_amount ?? 0,
    visibility: row.visibility ?? 'members',
    autoCreateCycles: row.auto_create_cycles ?? true,
    active: row.active ?? true,
    contributions: [],
    discounts: [],
  }
}

function normalizePolicyAdjustments(rows: any[], nameMap: Map<string, string>) {
  const contributions: FeePolicyAdjustmentItem[] = []
  const discounts: FeePolicyAdjustmentItem[] = []

  for (const row of rows) {
    const item = {
      userId: row.member_user_id,
      name: nameMap.get(row.member_user_id) ?? '',
      amount: String(row.amount ?? 0),
    }
    if (row.adjustment_type === 'contribution') contributions.push(item)
    if (row.adjustment_type === 'discount') discounts.push(item)
  }

  return { contributions, discounts }
}

async function getClubFeePolicy(clubId: string): Promise<ClubFeePolicy | null> {
  const [policyResult, adjustmentResult, members] = await Promise.all([
    supabase
      .from('club_fee_policies')
      .select('club_id, fee_mode, default_amount, visibility, auto_create_cycles, active')
      .eq('club_id', clubId)
      .maybeSingle(),
    supabase
      .from('club_fee_policy_adjustments')
      .select('member_user_id, amount, adjustment_type')
      .eq('club_id', clubId),
    getClubMembers(clubId),
  ])
  if (policyResult.error) throw policyResult.error
  if (!policyResult.data) return null

  const nameMap = new Map(members.map((member) => [member.userId, member.name]))
  const adjustments = adjustmentResult.error
    ? (isFeeAdjustmentTableMissing(adjustmentResult.error)
        ? { contributions: [], discounts: [] }
        : (() => { throw adjustmentResult.error })())
    : normalizePolicyAdjustments(adjustmentResult.data ?? [], nameMap)
  return { ...normalizePolicyRow(policyResult.data), ...adjustments }
}

export async function saveClubFeePolicy(input: {
  clubId: string
  feeMode: FeeMode
  defaultAmount: number
  visibility?: FeeVisibility
  autoCreateCycles?: boolean
  active?: boolean
  contributions?: FeePolicyAdjustmentItem[]
  discounts?: FeePolicyAdjustmentItem[]
}): Promise<ClubFeePolicy> {
  const payload = {
    club_id: input.clubId,
    fee_mode: input.feeMode,
    default_amount: input.defaultAmount,
    visibility: input.visibility ?? 'members',
    auto_create_cycles: input.autoCreateCycles ?? true,
    active: input.active ?? true,
  }

  const { data, error } = await supabase
    .from('club_fee_policies')
    .upsert(payload, { onConflict: 'club_id' })
    .select('club_id, fee_mode, default_amount, visibility, auto_create_cycles, active')
    .single()
  if (error) throw error

  const contributionRows = (input.contributions ?? []).map((item) => ({
    club_id: input.clubId,
    member_user_id: item.userId,
    amount: Number(item.amount.replace(/[^0-9]/g, '')) || 0,
    adjustment_type: 'contribution' as FeePolicyAdjustmentType,
  }))
  const discountRows = (input.discounts ?? []).map((item) => ({
    club_id: input.clubId,
    member_user_id: item.userId,
    amount: Number(item.amount.replace(/[^0-9]/g, '')) || 0,
    adjustment_type: 'discount' as FeePolicyAdjustmentType,
  }))

  try {
    const { error: deleteError } = await supabase
      .from('club_fee_policy_adjustments')
      .delete()
      .eq('club_id', input.clubId)
    if (deleteError) throw deleteError

    const adjustmentRows = [...contributionRows, ...discountRows]
    if (adjustmentRows.length > 0) {
      const { error: insertError } = await supabase
        .from('club_fee_policy_adjustments')
        .insert(adjustmentRows)
      if (insertError) throw insertError
    }
  } catch (err) {
    if (!isFeeAdjustmentTableMissing(err)) throw err
  }

  return {
    ...normalizePolicyRow(data),
    contributions: input.contributions ?? [],
    discounts: input.discounts ?? [],
  }
}

async function ensureCurrentFeeCycle(clubId: string, policy: ClubFeePolicy): Promise<ClubFeeCycle | null> {
  const cycleParts = getCycleParts(policy.feeMode)
  return ensureFeeCycleByParts(clubId, policy, cycleParts)
}

async function ensureFeeCycleByParts(
  clubId: string,
  policy: ClubFeePolicy,
  cycleParts: ReturnType<typeof getCycleParts>
): Promise<ClubFeeCycle | null> {
  const { data: existing, error } = await supabase
    .from('club_fee_cycles')
    .select('id, club_id, cycle_key, label, fee_year, fee_month, amount, due_date, status')
    .eq('club_id', clubId)
    .eq('cycle_key', cycleParts.cycleKey)
    .maybeSingle()
  if (error) throw error
  if (existing) return normalizeCycleRow(existing)
  if (!policy.autoCreateCycles) return null

  const { data, error: insertError } = await supabase
    .from('club_fee_cycles')
    .insert({
      club_id: clubId,
      cycle_key: cycleParts.cycleKey,
      label: cycleParts.label,
      fee_year: cycleParts.feeYear,
      fee_month: cycleParts.feeMonth,
      amount: policy.defaultAmount,
      status: 'open',
    })
    .select('id, club_id, cycle_key, label, fee_year, fee_month, amount, due_date, status')
    .single()
  if (insertError) throw insertError
  return normalizeCycleRow(data)
}

async function ensureFeeCycleByOffset(clubId: string, policy: ClubFeePolicy, offset: number): Promise<ClubFeeCycle | null> {
  const cycleParts = getCyclePartsByOffset(policy.feeMode, offset)
  return ensureFeeCycleByParts(clubId, policy, cycleParts)
}

async function ensureFeeStatusesForCycle(clubId: string, cycle: ClubFeeCycle, policy: ClubFeePolicy): Promise<void> {
  const clubMembers = await getClubMembers(clubId)
  const { data: existingRows, error } = await supabase
    .from('club_fee_member_statuses')
    .select('member_user_id')
    .eq('cycle_id', cycle.id)
  if (error) throw error

  const existing = new Set((existingRows ?? []).map((row: any) => row.member_user_id))
  const missing = clubMembers.filter((member) => !existing.has(member.userId))
  if (missing.length === 0) return

  const { error: insertError } = await supabase
    .from('club_fee_member_statuses')
    .insert(
      missing.map((member) => ({
        club_id: clubId,
        cycle_id: cycle.id,
        member_user_id: member.userId,
        amount_due: policy.defaultAmount,
        amount_paid: policy.defaultAmount,
        status: 'paid',
      }))
    )
  if (insertError) throw insertError
}

async function getCycleMemberStatuses(clubId: string, cycleId: string): Promise<FeeMemberStatusItem[]> {
  const [clubMembers, statusResult] = await Promise.all([
    getClubMembers(clubId),
    supabase
      .from('club_fee_member_statuses')
      .select('id, cycle_id, member_user_id, amount_due, amount_paid, status, updated_at')
      .eq('cycle_id', cycleId)
      .order('updated_at', { ascending: false }),
  ])

  if (statusResult.error) throw statusResult.error
  const nameMap = new Map(clubMembers.map((member) => [member.userId, member.name]))
  return (statusResult.data ?? []).map((row: any) => ({
    id: row.id,
    cycleId: row.cycle_id,
    userId: row.member_user_id,
    name: nameMap.get(row.member_user_id) ?? '(이름 없음)',
    amountDue: row.amount_due ?? 0,
    amountPaid: row.amount_paid ?? 0,
    status: row.status ?? 'unpaid',
    updatedAt: row.updated_at ?? '',
  }))
}

export async function getFeeDashboard(clubId: string): Promise<FeeDashboardData> {
  try {
    const policy = await getClubFeePolicy(clubId)
    if (!policy || !policy.active) {
      return { connectionReady: true, policy: null, cycle: null, members: [], treasuryEntries: [] }
    }

    const cycle = await ensureCurrentFeeCycle(clubId, policy)
    if (!cycle) {
      return { connectionReady: true, policy, cycle: null, members: [], treasuryEntries: [] }
    }

    await ensureFeeStatusesForCycle(clubId, cycle, policy)
    const [members, treasuryResult] = await Promise.all([
      getCycleMemberStatuses(clubId, cycle.id),
      supabase
        .from('club_treasury_entries')
        .select('id, club_id, entry_type, title, amount, entry_date, memo')
        .eq('club_id', clubId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    if (treasuryResult.error) throw treasuryResult.error

    const treasuryEntries: TreasuryEntryItem[] = (treasuryResult.data ?? []).map((row: any) => ({
      id: row.id,
      clubId: row.club_id,
      type: row.entry_type,
      title: row.title,
      amount: row.amount ?? 0,
      entryDate: row.entry_date,
      memo: row.memo ?? '',
    }))

    return { connectionReady: true, policy, cycle, members, treasuryEntries }
  } catch (err) {
    if (isFeeTableMissing(err)) {
      return { connectionReady: false, policy: null, cycle: null, members: [], treasuryEntries: [] }
    }
    throw err
  }
}

export async function getFeePaymentMonthData(clubId: string, offset = 0): Promise<FeePaymentMonthData> {
  try {
    const policy = await getClubFeePolicy(clubId)
    if (!policy || !policy.active) {
      return { connectionReady: true, policy: null, cycle: null, members: [] }
    }

    const cycle = await ensureFeeCycleByOffset(clubId, policy, offset)
    if (!cycle) {
      return { connectionReady: true, policy, cycle: null, members: [] }
    }

    await ensureFeeStatusesForCycle(clubId, cycle, policy)
    const members = await getCycleMemberStatuses(clubId, cycle.id)
    return { connectionReady: true, policy, cycle, members }
  } catch (err) {
    if (isFeeTableMissing(err)) {
      return { connectionReady: false, policy: null, cycle: null, members: [] }
    }
    throw err
  }
}

export async function getFeeMemberHistory(clubId: string, memberUserId: string): Promise<FeeMemberStatusItem[]> {
  const { data, error } = await supabase
    .from('club_fee_member_statuses')
    .select('id, cycle_id, member_user_id, amount_due, amount_paid, status, updated_at')
    .eq('club_id', clubId)
    .eq('member_user_id', memberUserId)
    .order('updated_at', { ascending: false })
  if (error) throw error

  const clubMembers = await getClubMembers(clubId)
  const name = clubMembers.find((member) => member.userId === memberUserId)?.name ?? '(이름 없음)'
  const cycleIds = [...new Set((data ?? []).map((row: any) => row.cycle_id).filter(Boolean))]
  const cycleMap = new Map<string, { label: string; feeYear: number; feeMonth: number | null }>()

  if (cycleIds.length > 0) {
    const { data: cycles, error: cycleError } = await supabase
      .from('club_fee_cycles')
      .select('id, label, fee_year, fee_month')
      .in('id', cycleIds)
    if (cycleError) throw cycleError

    for (const cycle of cycles ?? []) {
      cycleMap.set(cycle.id, {
        label: cycle.label,
        feeYear: cycle.fee_year,
        feeMonth: cycle.fee_month,
      })
    }
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    cycleId: row.cycle_id,
    userId: row.member_user_id,
    name,
    amountDue: row.amount_due ?? 0,
    amountPaid: row.amount_paid ?? 0,
    status: row.status ?? 'unpaid',
    updatedAt: row.updated_at ?? '',
    cycleLabel: cycleMap.get(row.cycle_id)?.label,
    feeYear: cycleMap.get(row.cycle_id)?.feeYear,
    feeMonth: cycleMap.get(row.cycle_id)?.feeMonth,
  }))
}

export async function updateFeeMemberStatus(statusId: string, nextStatus: FeePaymentStatus): Promise<void> {
  const user = await getUser()
  const { data, error } = await supabase
    .from('club_fee_member_statuses')
    .select('amount_due, amount_paid')
    .eq('id', statusId)
    .single()
  if (error) throw error

  const amountDue = data.amount_due ?? 0
  const amountPaid = nextStatus === 'paid'
    ? amountDue
    : nextStatus === 'partial'
      ? Math.max(Math.floor(amountDue / 2), data.amount_paid ?? 0)
      : 0

  const { error: updateError } = await supabase
    .from('club_fee_member_statuses')
    .update({
      status: nextStatus,
      amount_paid: amountPaid,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    })
    .eq('id', statusId)
  if (updateError) throw updateError
}

export async function updateFeeMemberPayment(
  statusId: string,
  nextStatus: FeePaymentStatus,
  amountPaid: number
): Promise<void> {
  const user = await getUser()
  const { error } = await supabase
    .from('club_fee_member_statuses')
    .update({
      status: nextStatus,
      amount_paid: Math.max(0, amountPaid),
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    })
    .eq('id', statusId)
  if (error) throw error
}

export async function getTreasuryEntries(clubId: string): Promise<TreasuryEntryItem[]> {
  const { data, error } = await supabase
    .from('club_treasury_entries')
    .select('id, club_id, entry_type, title, amount, entry_date, memo')
    .eq('club_id', clubId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    clubId: row.club_id,
    type: row.entry_type,
    title: row.title,
    amount: row.amount ?? 0,
    entryDate: row.entry_date,
    memo: row.memo ?? '',
  }))
}

export async function createTreasuryEntry(
  clubId: string,
  input: { type: TreasuryEntryType; title: string; amount: number; entryDate?: string; memo?: string }
): Promise<void> {
  const user = await getUser()
  const { error } = await supabase
    .from('club_treasury_entries')
    .insert({
      club_id: clubId,
      entry_type: input.type,
      title: input.title,
      amount: input.amount,
      entry_date: input.entryDate ?? new Date().toISOString().slice(0, 10),
      memo: input.memo ?? '',
      created_by: user?.id ?? null,
    })
  if (error) throw error
}

export async function updateTreasuryEntry(
  entryId: string,
  input: { type: TreasuryEntryType; title: string; amount: number; entryDate?: string; memo?: string }
): Promise<void> {
  const { error } = await supabase
    .from('club_treasury_entries')
    .update({
      entry_type: input.type,
      title: input.title,
      amount: input.amount,
      entry_date: input.entryDate ?? new Date().toISOString().slice(0, 10),
      memo: input.memo ?? '',
    })
    .eq('id', entryId)
  if (error) throw error
}

export async function deleteTreasuryEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('club_treasury_entries')
    .delete()
    .eq('id', entryId)
  if (error) throw error
}

export async function getClubByInviteCode(code: string): Promise<{ name: string; subtitle: string } | null> {
  const { data } = await supabase
    .from('clubs')
    .select('name, subtitle')
    .eq('invite_code', code.toUpperCase())
    .maybeSingle()
  return data ?? null
}

export async function deleteClub(clubId: string): Promise<void> {
  // 라운드는 club_id만 null로 초기화 (데이터 보존)
  await supabase.from('rounds').update({ club_id: null }).eq('club_id', clubId)
  // club_members는 FK cascade로 자동 삭제됨
  const { error } = await supabase.from('clubs').delete().eq('id', clubId)
  if (error) throw error
}

export async function completeRound(id: string): Promise<void> {
  const { error } = await supabase.from('rounds').update({ is_complete: true }).eq('id', id)
  if (error) throw error
}

export async function deleteRound(id: string): Promise<void> {
  const { data, error } = await supabase.from('rounds').delete().eq('id', id).select('id')
  if (error) throw error
  // RLS로 막히면 에러 없이 0행 삭제됨 → 명시적으로 실패 처리
  if (!data || data.length === 0) throw new Error('삭제 권한이 없거나 라운드를 찾을 수 없습니다.')
}

// ─── Golf Course DB ──────────────────────────────────────────────────────────

export interface GolfCourse {
  id: string
  name: string
  region: string
}

export interface CourseLayout {
  id: string
  golfCourseId: string
  name: string
  holes: number
  pars: number[]
}

export async function getGolfCourses(): Promise<GolfCourse[]> {
  const { data, error } = await supabase
    .from('golf_courses')
    .select('id, name, region')
    .order('name')
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, region: r.region }))
}

export async function getCourseLayouts(golfCourseId: string): Promise<CourseLayout[]> {
  const { data, error } = await supabase
    .from('course_layouts')
    .select('id, golf_course_id, name, holes, pars')
    .eq('golf_course_id', golfCourseId)
    .order('name')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    golfCourseId: r.golf_course_id,
    name: r.name,
    holes: r.holes,
    pars: r.pars,
  }))
}

export function shortName(name: string): string {
  return name.length > 1 ? name.slice(1) : name
}

export function playerTotal(strokes: number[]): number {
  return strokes.reduce((a, b) => a + b, 0)
}

export function totalPar(pars: number[]): number {
  return pars.reduce((a, b) => a + b, 0)
}

export function computeHandicaps(rounds: SavedRound[], basis = 5): Map<string, number> {
  const byPlayer = new Map<string, Array<{ date: string; diff: number }>>()
  for (const r of rounds) {
    const par = totalPar(r.pars)
    for (const p of r.players) {
      const arr = byPlayer.get(p.name) ?? []
      arr.push({ date: r.date, diff: playerTotal(p.strokes) - par })
      byPlayer.set(p.name, arr)
    }
  }
  const result = new Map<string, number>()
  for (const [name, entries] of byPlayer) {
    const lastN = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-basis)
    result.set(name, Math.ceil(lastN.reduce((s, e) => s + e.diff, 0) / lastN.length))
  }
  return result
}

export function handicapBefore(name: string, rounds: SavedRound[], beforeDate: string, basis = 5): number {
  const prior = rounds
    .filter((r) => r.date < beforeDate && r.players.some((p) => p.name === name))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-basis)
  if (!prior.length) return 0
  return Math.ceil(prior.reduce((sum, r) => {
    const player = r.players.find((p) => p.name === name)!
    return sum + (playerTotal(player.strokes) - totalPar(r.pars))
  }, 0) / prior.length)
}

export function getHandicapsForRound(round: SavedRound, rounds: SavedRound[], basis = 5): Map<string, number> {
  const result = new Map<string, number>()
  for (const player of round.players) {
    const saved = round.handicaps?.[player.name]
    result.set(
      player.name,
      typeof saved === 'number' && Number.isFinite(saved)
        ? saved
        : handicapBefore(player.name, rounds, round.date, basis)
    )
  }
  return result
}
