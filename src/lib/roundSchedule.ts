import { supabase } from './supabase'
import type { SettlementConfig } from './store'

export type RoundScheduleStatus = 'planned' | 'recruiting' | 'closed' | 'finished'
export type RoundAttendanceMode = 'member' | 'manager'
export type RoundAttendanceStatus = 'attending' | 'pending' | 'absent'
export type RoundAttendanceLabel = '참석' | '미정' | '불참'
export type ScheduleAwardConfig = { count: number; items: string[] }
export type ScheduleMoneyConfig = Omit<SettlementConfig, 'participants'>

export type ScheduledRoundGroupMember = {
  userId: string
  name: string
}

export type ScheduledRoundGroup = {
  id: string
  name: string
  time: string
  frontLayoutId?: string
  frontLayoutName?: string
  backLayoutId?: string
  backLayoutName?: string
  members: ScheduledRoundGroupMember[]
}

export type ScheduledRound = {
  id: string
  date: string
  time: string
  course: string
  note: string
  createdAt: string
  updatedAt: string
  courseId?: string
  courseName?: string
  layoutId?: string
  layoutName?: string
  status: RoundScheduleStatus
  attendanceMode: RoundAttendanceMode
  moneyGroupIds?: string[]
  moneyConfig?: ScheduleMoneyConfig | null
  awardConfig?: ScheduleAwardConfig | null
  groups: ScheduledRoundGroup[]
}

type ScheduleRow = {
  id: string
  round_date: string
  course_id?: string | null
  course_name?: string | null
  layout_id?: string | null
  layout_name?: string | null
  tee_time?: string | null
  note?: string | null
  status?: RoundScheduleStatus | null
  attendance_mode?: RoundAttendanceMode | null
  money_group_ids?: string[] | null
  money_config?: ScheduleMoneyConfig | null
  award_config?: ScheduleAwardConfig | null
  created_at?: string | null
  updated_at?: string | null
}

type GroupRow = {
  id: string
  schedule_id: string
  group_no: number
  group_name?: string | null
  tee_time?: string | null
  front_layout_id?: string | null
  front_layout_name?: string | null
  back_layout_id?: string | null
  back_layout_name?: string | null
}

type GroupMemberRow = {
  group_id: string
  member_user_id: string
  member_name: string
}

function courseLabel(courseName?: string | null, layoutName?: string | null) {
  if (courseName && layoutName) return `${courseName} · ${layoutName}`
  if (courseName) return courseName
  return '미정'
}

function leadTime(groups: ScheduledRoundGroup[], fallback?: string | null) {
  const firstGroupTime = groups.map((group) => group.time).find((value) => value.trim())
  return firstGroupTime ?? fallback?.trim() ?? ''
}

function attendanceToDb(status: RoundAttendanceLabel): RoundAttendanceStatus {
  if (status === '참석') return 'attending'
  if (status === '불참') return 'absent'
  return 'pending'
}

function attendanceFromDb(status?: string | null): RoundAttendanceLabel {
  if (status === 'attending') return '참석'
  if (status === 'absent') return '불참'
  return '미정'
}

function normalizeSchedule(row: ScheduleRow, groups: ScheduledRoundGroup[]): ScheduledRound {
  return {
    id: row.id,
    date: row.round_date,
    time: leadTime(groups, row.tee_time),
    course: courseLabel(row.course_name, row.layout_name),
    note: row.note ?? '',
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    courseId: row.course_id ?? undefined,
    courseName: row.course_name ?? undefined,
    layoutId: row.layout_id ?? undefined,
    layoutName: row.layout_name ?? undefined,
    status: row.status ?? 'planned',
    attendanceMode: row.attendance_mode ?? 'member',
    moneyGroupIds: row.money_group_ids ?? [],
    moneyConfig: row.money_config ?? null,
    awardConfig: row.award_config ?? null,
    groups,
  }
}

export async function getRoundSchedules(clubId: string): Promise<ScheduledRound[]> {
  const { data: schedules, error } = await supabase
    .from('club_round_schedules')
    .select('id, round_date, course_id, course_name, layout_id, layout_name, tee_time, note, status, attendance_mode, money_group_ids, money_config, award_config, created_at, updated_at')
    .eq('club_id', clubId)
    .order('round_date', { ascending: true })
  if (error) throw error
  if (!schedules?.length) return []

  const scheduleIds = schedules.map((item) => item.id)
  const [{ data: groups, error: groupError }, { data: members, error: memberError }] = await Promise.all([
    supabase
      .from('club_round_groups')
      .select('id, schedule_id, group_no, group_name, tee_time, front_layout_id, front_layout_name, back_layout_id, back_layout_name')
      .in('schedule_id', scheduleIds)
      .order('group_no', { ascending: true }),
    supabase
      .from('club_round_group_members')
      .select('group_id, member_user_id, member_name')
      .in('schedule_id', scheduleIds)
      .order('sort_order', { ascending: true }),
  ])
  if (groupError) throw groupError
  if (memberError) throw memberError

  const membersByGroup = new Map<string, ScheduledRoundGroupMember[]>()
  for (const member of (members ?? []) as GroupMemberRow[]) {
    const list = membersByGroup.get(member.group_id) ?? []
    list.push({ userId: member.member_user_id, name: member.member_name })
    membersByGroup.set(member.group_id, list)
  }

  const groupsBySchedule = new Map<string, ScheduledRoundGroup[]>()
  for (const group of (groups ?? []) as GroupRow[]) {
    const list = groupsBySchedule.get(group.schedule_id) ?? []
    list.push({
      id: group.id,
      name: group.group_name?.trim() || `${group.group_no}조`,
      time: group.tee_time?.trim() || '',
      frontLayoutId: group.front_layout_id ?? undefined,
      frontLayoutName: group.front_layout_name ?? undefined,
      backLayoutId: group.back_layout_id ?? undefined,
      backLayoutName: group.back_layout_name ?? undefined,
      members: membersByGroup.get(group.id) ?? [],
    })
    groupsBySchedule.set(group.schedule_id, list)
  }

  return (schedules as ScheduleRow[])
    .map((row) => normalizeSchedule(row, groupsBySchedule.get(row.id) ?? []))
    .sort((a, b) => `${a.date} ${a.time || '99:99'}`.localeCompare(`${b.date} ${b.time || '99:99'}`))
}

export async function saveRoundSchedules(clubId: string, items: ScheduledRound[]): Promise<void> {
  for (const item of items) {
    await upsertRoundSchedule(clubId, item)
  }
}

export async function upsertRoundSchedule(
  clubId: string,
  input: Omit<ScheduledRound, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'course'> & { id?: string | null }
): Promise<ScheduledRound[]> {
  const schedulePayload = {
    club_id: clubId,
    round_date: input.date,
    course_id: input.courseId ?? null,
    course_name: input.courseName ?? null,
    layout_id: input.layoutId ?? null,
    layout_name: input.layoutName ?? null,
    tee_time: leadTime(input.groups),
    note: input.note ?? '',
    status: input.status,
    attendance_mode: input.attendanceMode,
    money_group_ids: input.moneyGroupIds ?? [],
    money_config: input.moneyConfig ?? null,
    award_config: input.awardConfig ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data: schedule, error } = input.id
    ? await supabase
        .from('club_round_schedules')
        .update(schedulePayload)
        .eq('id', input.id)
        .select('id')
        .single()
    : await supabase
        .from('club_round_schedules')
        .insert(schedulePayload)
        .select('id')
        .single()
  if (error) throw error

  const scheduleId = schedule.id
  await supabase.from('club_round_groups').delete().eq('schedule_id', scheduleId)

  const groups = input.groups.length > 0
    ? input.groups
    : [{ id: '', name: '1조', time: '', members: [] }]

  const groupPayloads = groups.map((group, index) => ({
    club_id: clubId,
    schedule_id: scheduleId,
    group_no: index + 1,
    group_name: group.name?.trim() || `${index + 1}조`,
    tee_time: group.time?.trim() || null,
    front_layout_id: group.frontLayoutId ?? null,
    front_layout_name: group.frontLayoutName ?? null,
    back_layout_id: group.backLayoutId ?? null,
    back_layout_name: group.backLayoutName ?? null,
  }))

  if (groupPayloads.length > 0) {
    const { data: insertedGroups, error: groupError } = await supabase
      .from('club_round_groups')
      .insert(groupPayloads)
      .select('id, group_no')
    if (groupError) throw groupError

    const memberPayloads = (insertedGroups ?? []).flatMap((group: { id: string; group_no: number }) => {
      const source = groups[group.group_no - 1]
      return (source?.members ?? []).map((member, memberIndex) => ({
        club_id: clubId,
        schedule_id: scheduleId,
        group_id: group.id,
        member_user_id: member.userId,
        member_name: member.name,
        sort_order: memberIndex,
      }))
    })

    if (memberPayloads.length > 0) {
      const { error: memberError } = await supabase
        .from('club_round_group_members')
        .insert(memberPayloads)
      if (memberError) throw memberError
    }
  }

  return getRoundSchedules(clubId)
}

export async function deleteRoundSchedule(clubId: string, id: string): Promise<ScheduledRound[]> {
  const { error } = await supabase
    .from('club_round_schedules')
    .delete()
    .eq('club_id', clubId)
    .eq('id', id)
  if (error) throw error
  return getRoundSchedules(clubId)
}

export async function getRoundAttendanceMap(
  clubId: string,
  scheduleId: string
): Promise<Record<string, RoundAttendanceLabel>> {
  const { data, error } = await supabase
    .from('club_round_attendances')
    .select('member_user_id, status')
    .eq('club_id', clubId)
    .eq('schedule_id', scheduleId)
  if (error) throw error

  return Object.fromEntries(
    (data ?? []).map((row: { member_user_id: string; status: string }) => [
      row.member_user_id,
      attendanceFromDb(row.status),
    ])
  )
}

export async function updateRoundAttendance(
  clubId: string,
  scheduleId: string,
  memberUserId: string,
  status: RoundAttendanceLabel
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('club_round_attendances')
    .upsert({
      club_id: clubId,
      schedule_id: scheduleId,
      member_user_id: memberUserId,
      status: attendanceToDb(status),
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    }, { onConflict: 'schedule_id,member_user_id' })
  if (error) throw error
}

export function getUpcomingRound(items: ScheduledRound[]): ScheduledRound | null {
  if (items.length === 0) return null
  const todayKey = new Date().toISOString().slice(0, 10)
  return items.find((item) => item.date >= todayKey) ?? items[0]
}
