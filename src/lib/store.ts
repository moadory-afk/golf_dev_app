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
    .select('id, date, course_name, pars, shinperio_holes, players, is_complete')
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
      (r.players ?? []).some((p) => incomingNames.has(p.name))
    )
    if (existingRow) {
      const existing = fromRow(existingRow)
      const payload: Record<string, unknown> = {
        players: mergePlayers(existing.players, input.players),
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
  const payload: Record<string, unknown> = {
    user_id: user.id,
    date,
    course_name: input.courseName || '이름 없는 코스',
    pars: input.pars,
    shinperio_holes: selectShinperioHoles(12),
    players: input.players,
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
  const payload: Record<string, unknown> = {
    course_name: input.courseName || '이름 없는 코스',
    pars: input.pars,
    players: input.players,
  }
  if (input.date) payload.date = input.date
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
    icon: club.icon ?? '⛳',
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
      icon: club.icon ?? '⛳',
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
    icon: club.icon ?? icon ?? '⛳',
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
    icon: club.icon ?? '⛳',
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
