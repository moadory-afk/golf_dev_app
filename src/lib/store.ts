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

export interface ClubAwardConfig {
  count: number
  items: string[]
  winnerCounts?: Record<string, number>
  manualWinners?: Record<string, string[]>
}

export interface LottoAwardConfig {
  prizes: Record<'3' | '4' | '5' | '6', number>
  rollover: boolean
  rolloverIncrement: number
  carryoverAmount: number
}

export const DEFAULT_LOTTO_AWARD_CONFIG: LottoAwardConfig = {
  prizes: { '3': 0, '4': 0, '5': 0, '6': 0 },
  rollover: true,
  rolloverIncrement: 0,
  carryoverAmount: 0,
}

export interface ClubAwardSnapshotInput {
  awardKey: string
  icon: string
  label: string
  winner: string
  detail: string
}

export interface ClubAwardSnapshot extends ClubAwardSnapshotInput {
  id: string
  sortOrder: number
}

export interface ClubNotice {
  id: string
  clubId: string
  title: string
  body: string
  isPublished: boolean
  isImportant: boolean
  createdAt: string
  updatedAt: string
}

export interface NotificationSubscriptionInput {
  userId: string
  clubId: string
  channel: 'web' | 'native'
  endpoint: string
  p256dh?: string | null
  auth?: string | null
  platform?: string | null
  userAgent?: string | null
}

export interface NotificationSendResult {
  sent: number
  failed: number
  total: number
}

function errorMessageFromPayload(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  if (typeof value === 'object') {
    const item = value as { error?: unknown; message?: unknown; msg?: unknown; details?: unknown }
    const nested = item.error ?? item.message ?? item.msg
    if (nested && nested !== value) return errorMessageFromPayload(nested)
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}


export type PersonalRoundFir = 'long' | 'center' | 'short' | 'left_ob' | 'right_ob' | 'other_ob' | 'hazard' | null

export interface PersonalRoundHoleStat {
  layoutId?: string
  layoutName?: string
  hole: number
  par: number
  fir: PersonalRoundFir
  putts: number
  penalties: number
}

export interface PersonalRoundStat {
  clubId: string
  scheduleId: string
  userId: string
  holeStats: PersonalRoundHoleStat[]
  updatedAt?: string
}

export interface CourseHoleGuide {
  golfCourseId: string
  layoutId: string
  holeNo: number
  par?: number
  blueTeeM?: number
  whiteTeeM?: number
  redTeeM?: number
  title?: string
  summary: string
  strategy?: string
  caution?: string
  baseDifficulty?: number
  difficultyFactors?: Record<string, number> | string[]
}

export interface RoundLottoEntry {
  clubId: string
  scheduleId: string
  userId: string
  selectedHoles: {
    par3: number[]
    par4: number[]
    par5: number[]
  }
  updatedAt?: string
}

export type RoundLottoDrawStatus = 'PENDING' | 'COMPLETED'

export interface RoundLottoDraw {
  clubId: string
  scheduleId: string
  drafterUserId: string | null
  drawStatus: RoundLottoDrawStatus
  drawnScores?: Record<string, RoundLottoDrawScore> | null
  drawnAt?: string | null
  updatedAt?: string
}

export interface RoundLottoDrawScore {
  hole: number
  par: number
  score: number
  label: string
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
  scheduleId?: string
  holeLabels?: string[]
  isComplete: boolean
  /** 기록 화면에서 같은 일정으로 묶인 원본 rounds 행 ID */
  sourceRoundIds?: string[]
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
  schedule_id?: string
  hole_labels?: string[]
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
    scheduleId: row.schedule_id,
    holeLabels: row.hole_labels ?? undefined,
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
    .select('id, date, course_name, pars, shinperio_holes, players, handicaps, photo_data, settlement, golf_course_id, schedule_id, hole_labels, is_complete')
    .eq('club_id', clubId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function getRoundSummaries(clubId: string): Promise<SavedRound[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, date, course_name, pars, shinperio_holes, players, handicaps, golf_course_id, schedule_id, hole_labels, is_complete')
    .eq('club_id', clubId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

function mergeRoundHistoryRows(rows: SavedRound[]): SavedRound[] {
  const grouped = new Map<string, SavedRound[]>()

  for (const round of rows) {
    // 일정과 연결된 기록만 schedule_id 기준으로 합친다.
    // 일정이 없는 과거 수기 기록은 기존처럼 rounds.id 단위로 유지한다.
    const key = round.scheduleId ? `schedule:${round.scheduleId}` : `round:${round.id}`
    const bucket = grouped.get(key)
    if (bucket) bucket.push(round)
    else grouped.set(key, [round])
  }

  return Array.from(grouped.values()).map((bucket) => {
    if (bucket.length === 1) {
      const only = bucket[0]
      return { ...only, sourceRoundIds: [only.id] }
    }

    const base = bucket[0]
    const canonicalLabels = base.holeLabels ?? []
    const playerMap = new Map<string, PlayerScore>()
    const handicaps: Record<string, number> = {}
    const photos: string[] = []

    for (const row of bucket) {
      const rowLabels = row.holeLabels ?? []
      const labelIndex = new Map(rowLabels.map((label, index) => [label, index]))
      const canRemap = canonicalLabels.length > 0
        && rowLabels.length > 0
        && canonicalLabels.every((label) => labelIndex.has(label))

      for (const player of row.players) {
        const normalizedStrokes = canRemap
          ? canonicalLabels.map((label) => player.strokes[labelIndex.get(label)!] ?? 0)
          : [...player.strokes]
        const existing = playerMap.get(player.name)
        playerMap.set(player.name, existing
          ? { name: player.name, strokes: mergeStrokes(existing.strokes, normalizedStrokes) }
          : { name: player.name, strokes: normalizedStrokes })
      }

      Object.assign(handicaps, row.handicaps ?? {})
      for (const photo of row.photoData ?? []) {
        if (photo && !photos.includes(photo)) photos.push(photo)
      }
    }

    return {
      ...base,
      players: Array.from(playerMap.values()),
      handicaps: Object.keys(handicaps).length > 0 ? handicaps : undefined,
      photoData: photos,
      isComplete: bucket.every((row) => row.isComplete),
      sourceRoundIds: bucket.map((row) => row.id),
    }
  }).sort((a, b) => b.date.localeCompare(a.date))
}

export async function getRoundHistoryCards(clubId: string): Promise<SavedRound[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, date, course_name, pars, shinperio_holes, players, handicaps, photo_data, golf_course_id, schedule_id, hole_labels, is_complete')
    .eq('club_id', clubId)
    .order('date', { ascending: false })
  if (error) throw error
  return mergeRoundHistoryRows((data ?? []).map(fromRow))
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


export async function getRoundHistoryDetail(id: string): Promise<SavedRound | null> {
  const base = await getRound(id)
  if (!base?.scheduleId) return base

  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('schedule_id', base.scheduleId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const merged = mergeRoundHistoryRows((data ?? []).map(fromRow))
  return merged[0] ?? base
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
    .select('id, date, course_name, pars, shinperio_holes, players, handicaps, schedule_id, hole_labels, is_complete')
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
  scheduleId?: string
  holeLabels?: string[]
}): Promise<SavedRound> {
  const user = await getUser()
  if (!user) throw new Error('로그인이 필요합니다.')
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  const handicaps = input.clubId
    ? await computeHandicapSnapshot(input.clubId, date, input.players)
    : {}

  // 중복 방지: 같은 클럽·같은 날짜에 선수가 겹치는 라운드만 병합한다.
  // 코스명만 같다고 병합하면 조별 스코어가 한 라운드로 합쳐져
  // 조마다 다른 전/후반 코스 순서와 par 기준을 보존할 수 없다.
  if (input.clubId) {
    const incomingNames = new Set(input.players.map((p) => p.name))
    const { data: sameDay } = await supabase
      .from('rounds')
      .select('*')
      .eq('club_id', input.clubId)
      .eq('date', date)
    const existingRow = ((sameDay ?? []) as RoundRow[]).find((r) =>
      (r.players ?? []).some((p) => incomingNames.has(p.name))
    )
    if (existingRow) {
      const existing = fromRow(existingRow)
      const players = mergePlayers(existing.players, input.players)
      const payload: Record<string, unknown> = {
        pars: input.pars,
        players,
        handicaps: await computeHandicapSnapshot(input.clubId, date, players, 5, existing.id),
      }
      if (input.settlement) {
        payload.settlement = existing.settlement
          ? {
              ...input.settlement,
              participants: Array.from(new Set([
                ...existing.settlement.participants,
                ...input.settlement.participants,
              ])),
            }
          : input.settlement
      }
      if (input.scheduleId) payload.schedule_id = input.scheduleId
      payload.hole_labels = input.holeLabels ?? null
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
  if (input.scheduleId) payload.schedule_id = input.scheduleId
  if (input.holeLabels) payload.hole_labels = input.holeLabels
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
  holeLabels?: string[]
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
  if (input.holeLabels) payload.hole_labels = input.holeLabels
  const { data, error } = await supabase.from('rounds').insert(payload).select().single()
  if (error) throw error
  return fromRow(data)
}

export async function updateRound(
  id: string,
  input: { courseName: string; pars: number[]; players: PlayerScore[]; date?: string; photoData?: string[]; settlement?: SettlementConfig; golfCourseId?: string; holeLabels?: string[] }
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
  if (input.photoData !== undefined) payload.photo_data = input.photoData
  if (input.settlement !== undefined) payload.settlement = input.settlement
  if (input.golfCourseId) payload.golf_course_id = input.golfCourseId
  if (input.holeLabels) payload.hole_labels = input.holeLabels
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
  coverImage: string
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
    .select('id, name, subtitle, cover_image, invite_code')
    .eq('id', membership.club_id)
    .maybeSingle()

  if (!club) return null

  return {
    id: club.id,
    name: club.name,
    subtitle: club.subtitle ?? '',
    coverImage: club.cover_image ?? '',
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
    .select('id, name, subtitle, cover_image, invite_code')
    .in('id', clubIds)

  if (!clubs) return []

  return clubs.map((club) => {
    const membership = memberships.find((m) => m.club_id === club.id)!
    return {
      id: club.id,
      name: club.name,
      subtitle: club.subtitle ?? '',
      coverImage: club.cover_image ?? '',
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
    coverImage: club.cover_image ?? '',
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
    .select('id, name, subtitle, cover_image, invite_code')
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
    coverImage: club.cover_image ?? '',
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
    .select('id, name, nickname')
    .in('id', userIds)

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; name?: string | null; nickname?: string | null }) => [
      p.id,
      (p.name ?? p.nickname ?? '').trim(),
    ])
  )

  return members.map((m) => ({
    userId: m.user_id,
    name: profileMap.get(m.user_id) ?? '(이름 없음)',
    role: m.role,
  }))
}

export async function removeMember(clubId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .select('club_id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error('클럽 탈퇴 권한이 없거나 이미 탈퇴 처리된 회원입니다.')
  }
}


export async function leaveClub(clubId: string): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw new Error(userError.message)
  if (!user) throw new Error('로그인 정보를 확인할 수 없습니다.')

  const { data: deletedRows, error: deleteError } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .select('club_id')

  if (deleteError) {
    if (deleteError.code === '42501') {
      throw new Error('클럽 탈퇴 권한이 없습니다. Supabase의 club_members 본인 삭제 정책을 확인해 주세요.')
    }
    throw new Error(deleteError.message)
  }

  if (!deletedRows || deletedRows.length === 0) {
    const { data: membership, error: membershipError } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) throw new Error(membershipError.message)
    if (membership) {
      throw new Error('클럽 탈퇴가 DB에 반영되지 않았습니다. club_members 본인 삭제 RLS 정책을 적용해 주세요.')
    }

    // 이미 탈퇴된 상태라면 성공으로 처리한다.
    return
  }

  const { data: remaining, error: verifyError } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (verifyError) throw new Error(verifyError.message)
  if (remaining) {
    throw new Error('클럽 탈퇴가 DB에 반영되지 않았습니다. 잠시 후 다시 시도해 주세요.')
  }
}

export async function updateMemberRole(clubId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  const { error } = await supabase
    .from('club_members')
    .update({ role })
    .eq('club_id', clubId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function updateClubSettings(clubId: string, name: string, subtitle: string, coverImage?: string): Promise<void> {
  const payload: { name: string; subtitle: string; cover_image?: string } = { name, subtitle }
  if (coverImage !== undefined) payload.cover_image = coverImage
  const { error } = await supabase.from('clubs').update(payload).eq('id', clubId)
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
  const { error } = await supabase.from('clubs').update({ settlement: config }).eq('id', clubId).select('id').single()
  if (error) throw error
}

export async function getClubAwardConfig(clubId: string): Promise<ClubAwardConfig | null> {
  const { data, error } = await supabase
    .from('clubs')
    .select('award_config')
    .eq('id', clubId)
    .maybeSingle()
  if (error) throw error
  return (data?.award_config as ClubAwardConfig | null) ?? null
}

export async function saveClubAwardConfig(clubId: string, config: ClubAwardConfig): Promise<void> {
  const { error } = await supabase.from('clubs').update({ award_config: config }).eq('id', clubId).select('id').single()
  if (error) throw error
}

export async function getClubLottoAwardConfig(clubId: string): Promise<LottoAwardConfig> {
  const { data, error } = await supabase
    .from('clubs')
    .select('lotto_award_config')
    .eq('id', clubId)
    .maybeSingle()
  if (error) throw error
  const config = data?.lotto_award_config as Partial<LottoAwardConfig> | null
  const prizes = (config?.prizes ?? {}) as Partial<Record<'3' | '4' | '5' | '6', number>>
  return {
    prizes: {
      '3': Number(prizes['3'] ?? DEFAULT_LOTTO_AWARD_CONFIG.prizes['3']),
      '4': Number(prizes['4'] ?? DEFAULT_LOTTO_AWARD_CONFIG.prizes['4']),
      '5': Number(prizes['5'] ?? DEFAULT_LOTTO_AWARD_CONFIG.prizes['5']),
      '6': Number(prizes['6'] ?? DEFAULT_LOTTO_AWARD_CONFIG.prizes['6']),
    },
    rollover: config?.rollover ?? DEFAULT_LOTTO_AWARD_CONFIG.rollover,
    rolloverIncrement: Number(config?.rolloverIncrement ?? DEFAULT_LOTTO_AWARD_CONFIG.rolloverIncrement),
    carryoverAmount: Number(config?.carryoverAmount ?? DEFAULT_LOTTO_AWARD_CONFIG.carryoverAmount),
  }
}

export async function saveClubLottoAwardConfig(clubId: string, config: LottoAwardConfig): Promise<void> {
  const { error } = await supabase.from('clubs').update({ lotto_award_config: config }).eq('id', clubId).select('id').single()
  if (error) throw error
}

export async function saveClubAwardSnapshots(
  clubId: string,
  roundId: string,
  awards: ClubAwardSnapshotInput[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('round_award_snapshots')
    .delete()
    .eq('round_id', roundId)
    .eq('award_type', 'club')
  if (deleteError) throw deleteError
  if (awards.length === 0) return

  const { error } = await supabase.from('round_award_snapshots').insert(
    awards.map((award, index) => ({
      club_id: clubId,
      round_id: roundId,
      award_type: 'club',
      award_key: award.awardKey,
      award_label: award.label,
      icon: award.icon,
      winner: award.winner,
      detail: award.detail,
      sort_order: index,
    })),
  )
  if (error) throw error
}

export async function getClubAwardSnapshots(roundId: string): Promise<ClubAwardSnapshot[]> {
  const { data, error } = await supabase
    .from('round_award_snapshots')
    .select('id, award_key, award_label, icon, winner, detail, sort_order')
    .eq('round_id', roundId)
    .eq('award_type', 'club')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    awardKey: row.award_key,
    icon: row.icon ?? '',
    label: row.award_label,
    winner: row.winner,
    detail: row.detail ?? '',
    sortOrder: row.sort_order ?? 0,
  }))
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
  proofText?: string
  receiptImages?: string[]
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
        .select('id, club_id, entry_type, title, amount, entry_date, memo, proof_text, receipt_images')
        .eq('club_id', clubId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false }),
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
      proofText: row.proof_text ?? '',
      receiptImages: row.receipt_images ?? [],
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
    .select('id, club_id, entry_type, title, amount, entry_date, memo, proof_text, receipt_images')
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
    proofText: row.proof_text ?? '',
    receiptImages: row.receipt_images ?? [],
  }))
}

export async function createTreasuryEntry(
  clubId: string,
  input: { type: TreasuryEntryType; title: string; amount: number; entryDate?: string; memo?: string; proofText?: string; receiptImages?: string[] }
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
      proof_text: input.proofText ?? '',
      receipt_images: input.receiptImages ?? [],
      created_by: user?.id ?? null,
    })
  if (error) throw error
}

export async function updateTreasuryEntry(
  entryId: string,
  input: { type: TreasuryEntryType; title: string; amount: number; entryDate?: string; memo?: string; proofText?: string; receiptImages?: string[] }
): Promise<void> {
  const { error } = await supabase
    .from('club_treasury_entries')
    .update({
      entry_type: input.type,
      title: input.title,
      amount: input.amount,
      entry_date: input.entryDate ?? new Date().toISOString().slice(0, 10),
      memo: input.memo ?? '',
      proof_text: input.proofText ?? '',
      receipt_images: input.receiptImages ?? [],
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

function isMissingClubNoticesTable(error: unknown) {
  const item = error as { code?: string; message?: string }
  return item?.code === '42P01' || item?.message?.includes('club_notices')
}

function isMissingNotificationSubscriptionsTable(error: unknown) {
  const item = error as { code?: string; message?: string }
  return item?.code === '42P01' || item?.message?.includes('notification_subscriptions')
}

function normalizeNotice(row: any): ClubNotice {
  return {
    id: row.id,
    clubId: row.club_id,
    title: row.title ?? '',
    body: row.body ?? '',
    isPublished: row.is_published ?? true,
    isImportant: row.is_important ?? false,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export async function getClubNotices(clubId: string): Promise<ClubNotice[]> {
  const { data, error } = await supabase
    .from('club_notices')
    .select('id, club_id, title, body, is_published, is_important, created_at, updated_at')
    .eq('club_id', clubId)
    .order('is_important', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    if (isMissingClubNoticesTable(error)) return []
    throw error
  }
  return (data ?? []).map(normalizeNotice)
}

export async function createClubNotice(
  clubId: string,
  input: { title: string; body: string; isPublished?: boolean; isImportant?: boolean }
): Promise<ClubNotice> {
  const user = await getUser()
  const { data, error } = await supabase
    .from('club_notices')
    .insert({
      club_id: clubId,
      title: input.title.trim(),
      body: input.body.trim(),
      is_published: input.isPublished ?? true,
      is_important: input.isImportant ?? false,
      created_by: user?.id ?? null,
    })
    .select('id, club_id, title, body, is_published, is_important, created_at, updated_at')
    .single()
  if (error) throw error
  return normalizeNotice(data)
}

export async function saveNotificationSubscription(input: NotificationSubscriptionInput): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('notification_subscriptions')
    .upsert({
      user_id: input.userId,
      club_id: input.clubId,
      channel: input.channel,
      endpoint: input.endpoint,
      p256dh: input.p256dh ?? null,
      auth: input.auth ?? null,
      platform: input.platform ?? null,
      user_agent: input.userAgent ?? null,
      enabled: true,
      updated_at: now,
      last_seen_at: now,
    }, {
      onConflict: 'user_id,club_id,channel,endpoint',
    })
  if (error) {
    if (isMissingNotificationSubscriptionsTable(error)) {
      throw new Error('알림 구독 테이블이 아직 적용되지 않았습니다. Supabase 마이그레이션이 필요합니다.')
    }
    throw error
  }
}

export async function getNotificationSubscriptionEnabled(
  clubId: string,
  userId: string,
  endpoint: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('notification_subscriptions')
    .select('enabled')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .eq('channel', 'web')
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (error) {
    if (isMissingNotificationSubscriptionsTable(error)) return false
    throw error
  }
  return data?.enabled === true
}

export async function setNotificationSubscriptionEnabled(
  clubId: string,
  userId: string,
  endpoint: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('notification_subscriptions')
    .update({
      enabled,
      updated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .eq('channel', 'web')
    .eq('endpoint', endpoint)
  if (error) {
    if (isMissingNotificationSubscriptionsTable(error)) {
      throw new Error('알림 구독 테이블이 아직 적용되지 않았습니다. Supabase 마이그레이션이 필요합니다.')
    }
    throw error
  }
}

export async function sendClubNotification(
  clubId: string,
  input: { type: string; title: string; body: string; data?: Record<string, unknown>; userIds?: string[] }
): Promise<NotificationSendResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const anonKey = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '')
  const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken ?? anonKey}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clubId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      userIds: input.userIds,
    }),
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = errorMessageFromPayload(payload?.error ?? payload?.message ?? text) || `HTTP ${response.status}`
    throw new Error(message)
  }
  return payload ?? { sent: 0, failed: 0, total: 0 }
}

export async function updateClubNotice(
  noticeId: string,
  input: { title: string; body: string; isPublished: boolean; isImportant: boolean }
): Promise<void> {
  const { error } = await supabase
    .from('club_notices')
    .update({
      title: input.title.trim(),
      body: input.body.trim(),
      is_published: input.isPublished,
      is_important: input.isImportant,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noticeId)
  if (error) throw error
}

export async function deleteClubNotice(noticeId: string): Promise<void> {
  const { data, error } = await supabase
    .from('club_notices')
    .delete()
    .eq('id', noticeId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('삭제 권한이 없거나 공지를 찾을 수 없습니다.')
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

export async function deleteRoundsBySchedule(scheduleId: string): Promise<void> {
  const { data: rounds, error: findError } = await supabase
    .from('rounds')
    .select('id')
    .eq('schedule_id', scheduleId)
  if (findError) throw findError
  const roundIds = (rounds ?? []).map((round) => round.id)
  if (roundIds.length === 0) return

  const { error: snapshotError } = await supabase
    .from('round_award_snapshots')
    .delete()
    .in('round_id', roundIds)
  if (snapshotError) throw snapshotError

  const { error } = await supabase
    .from('rounds')
    .delete()
    .in('id', roundIds)
  if (error) throw error
}

export async function getPersonalRoundStats(scheduleIds: string[], userId: string): Promise<PersonalRoundStat[]> {
  const uniqueScheduleIds = [...new Set(scheduleIds.filter(Boolean))]
  if (!userId || uniqueScheduleIds.length === 0) return []

  const { data, error } = await supabase
    .from('personal_round_stats')
    .select('club_id, schedule_id, user_id, hole_stats, updated_at')
    .eq('user_id', userId)
    .in('schedule_id', uniqueScheduleIds)
  if (error) throw error

  return (data ?? []).map((row) => ({
    clubId: row.club_id,
    scheduleId: row.schedule_id,
    userId: row.user_id,
    holeStats: row.hole_stats ?? [],
    updatedAt: row.updated_at ?? undefined,
  }))
}

export async function getPersonalRoundStat(scheduleId: string, userId: string): Promise<PersonalRoundStat | null> {
  const { data, error } = await supabase
    .from('personal_round_stats')
    .select('club_id, schedule_id, user_id, hole_stats, updated_at')
    .eq('schedule_id', scheduleId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    clubId: data.club_id,
    scheduleId: data.schedule_id,
    userId: data.user_id,
    holeStats: data.hole_stats ?? [],
    updatedAt: data.updated_at ?? undefined,
  }
}

export async function getCourseHoleGuides(layoutIds: string[]): Promise<CourseHoleGuide[]> {
  const uniqueLayoutIds = [...new Set(layoutIds.filter(Boolean))]
  if (uniqueLayoutIds.length === 0) return []
  const { data, error } = await supabase
    .from('course_hole_guides')
    .select('golf_course_id, layout_id, hole_no, par, blue_tee_m, white_tee_m, red_tee_m, title, summary, strategy, caution, base_difficulty, difficulty_factors')
    .in('layout_id', uniqueLayoutIds)
  if (error) throw error
  return (data ?? []).map((row) => ({
    golfCourseId: row.golf_course_id,
    layoutId: row.layout_id,
    holeNo: row.hole_no,
    par: row.par ?? undefined,
    blueTeeM: row.blue_tee_m ?? undefined,
    whiteTeeM: row.white_tee_m ?? undefined,
    redTeeM: row.red_tee_m ?? undefined,
    title: row.title ?? undefined,
    summary: row.summary,
    strategy: row.strategy ?? undefined,
    caution: row.caution ?? undefined,
    baseDifficulty: row.base_difficulty ?? undefined,
    difficultyFactors: row.difficulty_factors ?? undefined,
  }))
}

export async function savePersonalRoundStat(input: PersonalRoundStat): Promise<void> {
  const holeStats = input.holeStats.map(({ layoutId, layoutName, hole, par, fir, putts, penalties }) => ({
    layoutId,
    layoutName,
    hole,
    par,
    fir,
    putts,
    penalties,
  }))
  const { error } = await supabase
    .from('personal_round_stats')
    .upsert({
      club_id: input.clubId,
      schedule_id: input.scheduleId,
      user_id: input.userId,
      hole_stats: holeStats,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'schedule_id,user_id' })
  if (error) throw error
}

export async function getRoundLottoEntry(scheduleId: string, userId: string): Promise<RoundLottoEntry | null> {
  const { data, error } = await supabase
    .from('round_lotto_entries')
    .select('club_id, schedule_id, user_id, selected_holes, updated_at')
    .eq('schedule_id', scheduleId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    clubId: data.club_id,
    scheduleId: data.schedule_id,
    userId: data.user_id,
    selectedHoles: data.selected_holes ?? { par3: [], par4: [], par5: [] },
    updatedAt: data.updated_at ?? undefined,
  }
}

export async function getRoundLottoEntries(scheduleId: string): Promise<RoundLottoEntry[]> {
  const { data, error } = await supabase
    .from('round_lotto_entries')
    .select('club_id, schedule_id, user_id, selected_holes, updated_at')
    .eq('schedule_id', scheduleId)
  if (error) throw error
  return (data ?? []).map((row) => ({
    clubId: row.club_id,
    scheduleId: row.schedule_id,
    userId: row.user_id,
    selectedHoles: row.selected_holes ?? { par3: [], par4: [], par5: [] },
    updatedAt: row.updated_at ?? undefined,
  }))
}

export async function getRoundLottoEntriesByScheduleIds(scheduleIds: string[]): Promise<RoundLottoEntry[]> {
  if (scheduleIds.length === 0) return []
  const { data, error } = await supabase
    .from('round_lotto_entries')
    .select('club_id, schedule_id, user_id, selected_holes, updated_at')
    .in('schedule_id', scheduleIds)
  if (error) throw error
  return (data ?? []).map((row) => ({
    clubId: row.club_id,
    scheduleId: row.schedule_id,
    userId: row.user_id,
    selectedHoles: row.selected_holes ?? { par3: [], par4: [], par5: [] },
    updatedAt: row.updated_at ?? undefined,
  }))
}

export async function saveRoundLottoEntry(input: RoundLottoEntry): Promise<void> {
  const { error } = await supabase
    .from('round_lotto_entries')
    .upsert({
      club_id: input.clubId,
      schedule_id: input.scheduleId,
      user_id: input.userId,
      selected_holes: input.selectedHoles,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'schedule_id,user_id' })
  if (error) throw error
}

export async function getRoundLottoDraw(scheduleId: string): Promise<RoundLottoDraw | null> {
  const { data, error } = await supabase
    .from('round_lotto_draws')
    .select('club_id, schedule_id, drafter_user_id, draw_status, drawn_scores, drawn_at, updated_at')
    .eq('schedule_id', scheduleId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    clubId: data.club_id,
    scheduleId: data.schedule_id,
    drafterUserId: data.drafter_user_id ?? null,
    drawStatus: data.draw_status ?? 'PENDING',
    drawnScores: data.drawn_scores ?? null,
    drawnAt: data.drawn_at ?? null,
    updatedAt: data.updated_at ?? undefined,
  }
}

export async function getRoundLottoDrawsByScheduleIds(scheduleIds: string[]): Promise<RoundLottoDraw[]> {
  if (scheduleIds.length === 0) return []
  const { data, error } = await supabase
    .from('round_lotto_draws')
    .select('club_id, schedule_id, drafter_user_id, draw_status, drawn_scores, drawn_at, updated_at')
    .in('schedule_id', scheduleIds)
  if (error) throw error
  return (data ?? []).map((row) => ({
    clubId: row.club_id,
    scheduleId: row.schedule_id,
    drafterUserId: row.drafter_user_id ?? null,
    drawStatus: row.draw_status ?? 'PENDING',
    drawnScores: row.drawn_scores ?? null,
    drawnAt: row.drawn_at ?? null,
    updatedAt: row.updated_at ?? undefined,
  }))
}

export async function saveRoundLottoDrawResult(
  clubId: string,
  scheduleId: string,
  drawnScores: Record<string, RoundLottoDrawScore>,
): Promise<void> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('round_lotto_draws')
    .update({
      drawn_scores: drawnScores,
      draw_status: 'COMPLETED',
      drawn_at: now,
      updated_at: now,
    })
    .eq('club_id', clubId)
    .eq('schedule_id', scheduleId)
    .select('schedule_id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('로또 추첨자가 먼저 지정되어야 합니다.')
}

export async function saveRoundLottoDrafter(clubId: string, scheduleId: string, drafterUserId: string | null): Promise<void> {
  const { error } = await supabase
    .from('round_lotto_draws')
    .upsert({
      club_id: clubId,
      schedule_id: scheduleId,
      drafter_user_id: drafterUserId,
      draw_status: 'PENDING',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'schedule_id' })
  if (error) throw error
}

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
