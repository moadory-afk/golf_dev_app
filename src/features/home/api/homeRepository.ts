import { supabase } from '../../../lib/supabase'
import { getRounds, type SavedRound } from '../../../lib/store'
import type { HomeRoundStatus } from '../types/home'

export type HomeScheduleRow = {
  id: string
  round_date: string
  course_id?: string | null
  course_name?: string | null
  layout_id?: string | null
  layout_name?: string | null
  tee_time?: string | null
  note?: string | null
  status?: HomeRoundStatus | null
  created_at?: string | null
  updated_at?: string | null
}

export type HomeScheduleGroupRow = {
  id: string
  schedule_id: string
  group_no: number
  group_name?: string | null
  tee_time?: string | null
}

export type HomeScheduleGroupMemberRow = {
  group_id: string
  schedule_id: string
  member_user_id: string
  member_name: string
}

export type HomeCourseRow = {
  id: string
  name: string
  region: string
}

export type HomeLayoutRow = {
  id: string
  golf_course_id: string
  name: string
}

export type HomeDashboardRawData = {
  schedules: HomeScheduleRow[]
  groups: HomeScheduleGroupRow[]
  members: HomeScheduleGroupMemberRow[]
  courses: HomeCourseRow[]
  layouts: HomeLayoutRow[]
  rounds: SavedRound[]
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => !!value)))
}

export async function getHomeDashboardRawData(clubId: string): Promise<HomeDashboardRawData> {
  const today = new Date().toISOString().slice(0, 10)

  const { data: schedules, error: scheduleError } = await supabase
    .from('club_round_schedules')
    .select('id, round_date, course_id, course_name, layout_id, layout_name, tee_time, note, status, created_at, updated_at')
    .eq('club_id', clubId)
    .gte('round_date', today)
    .in('status', ['planned', 'recruiting'])
    .order('round_date', { ascending: true })
    .order('tee_time', { ascending: true })
    .limit(5)

  if (scheduleError) throw scheduleError

  const scheduleRows = (schedules ?? []) as HomeScheduleRow[]
  const scheduleIds = scheduleRows.map((schedule) => schedule.id)
  const courseIds = uniqueValues(scheduleRows.map((schedule) => schedule.course_id))
  const layoutIds = uniqueValues(scheduleRows.map((schedule) => schedule.layout_id))

  const [groupResult, memberResult, courseResult, layoutResult, rounds] = await Promise.all([
    scheduleIds.length
      ? supabase
          .from('club_round_groups')
          .select('id, schedule_id, group_no, group_name, tee_time')
          .in('schedule_id', scheduleIds)
          .order('group_no', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    scheduleIds.length
      ? supabase
          .from('club_round_group_members')
          .select('group_id, schedule_id, member_user_id, member_name')
          .in('schedule_id', scheduleIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    courseIds.length
      ? supabase
          .from('golf_courses')
          .select('id, name, region')
          .in('id', courseIds)
      : Promise.resolve({ data: [], error: null }),
    layoutIds.length
      ? supabase
          .from('course_layouts')
          .select('id, golf_course_id, name')
          .in('id', layoutIds)
      : Promise.resolve({ data: [], error: null }),
    getRounds(clubId),
  ])

  if (groupResult.error) throw groupResult.error
  if (memberResult.error) throw memberResult.error
  if (courseResult.error) throw courseResult.error
  if (layoutResult.error) throw layoutResult.error

  return {
    schedules: scheduleRows,
    groups: (groupResult.data ?? []) as HomeScheduleGroupRow[],
    members: (memberResult.data ?? []) as HomeScheduleGroupMemberRow[],
    courses: (courseResult.data ?? []) as HomeCourseRow[],
    layouts: (layoutResult.data ?? []) as HomeLayoutRow[],
    rounds,
  }
}
