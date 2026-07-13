import { supabase } from '../../../lib/supabase'
import type { PlayerScore, SavedRound } from '../../../lib/store'
import { getOpenWeatherForRound, type RoundWeather } from '../../../lib/weather'
import type { HomeRoundStatus } from '../types/home'

type HomeRoundSummaryRow = {
  id: string
  date: string
  course_name: string
  pars?: number[] | null
  players?: PlayerScore[] | null
  is_complete?: boolean | null
}

function mapHomeRoundSummary(row: HomeRoundSummaryRow): SavedRound {
  return {
    id: row.id,
    date: row.date,
    courseName: row.course_name,
    pars: row.pars ?? [],
    shinperioHoles: [],
    players: row.players ?? [],
    photoData: [],
    isComplete: row.is_complete ?? false,
  }
}

/**
 * Home 통계에 필요한 최소 필드만 조회한다.
 * photo_data, settlement, handicaps, hole_labels 등 상세 화면 전용 대용량 필드는 제외한다.
 * 라운드 범위는 기존과 동일하게 유지해 평균/베스트/핸디캡 결과가 달라지지 않도록 한다.
 */
async function getHomeRoundSummaries(clubId: string): Promise<SavedRound[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, date, course_name, pars, players, is_complete')
    .eq('club_id', clubId)
    .order('date', { ascending: false })

  if (error) throw error
  return ((data ?? []) as HomeRoundSummaryRow[]).map(mapHomeRoundSummary)
}

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
  front_layout_name?: string | null
  back_layout_name?: string | null
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
  latitude?: number | null
  longitude?: number | null
  hero_image_url?: string | null
  hero_image_source?: string | null
}

export type HomeLayoutRow = {
  id: string
  golf_course_id: string
  name: string
}

export type HomeCourseSeasonImageRow = {
  golf_course_id: string
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  image_url: string
  image_source?: string | null
  is_active?: boolean | null
}

export type HomeWeatherSnapshot = {
  temperature: string
  weatherText: string
  windText: string
  fetchedAt?: string
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => !!value)))
}

export type HomeDashboardRawData = {
  schedules: HomeScheduleRow[]
  groups: HomeScheduleGroupRow[]
  members: HomeScheduleGroupMemberRow[]
  courses: HomeCourseRow[]
  courseSeasonImages: HomeCourseSeasonImageRow[]
  layouts: HomeLayoutRow[]
  rounds: SavedRound[]
  weatherByCourseId: Record<string, HomeWeatherSnapshot>
  weatherByScheduleId: Record<string, HomeWeatherSnapshot>
}

function weatherSnapshotFromRoundWeather(weather: RoundWeather | null): HomeWeatherSnapshot | null {
  if (!weather) return null

  return {
    temperature: `${Math.round(weather.tempC)}°`,
    weatherText: weather.condition || '날씨 준비중',
    windText: typeof weather.windMs === 'number' ? `${Math.round(weather.windMs)}m/s` : '풍속 준비중',
    fetchedAt: weather.fetchedAt,
  }
}

async function fetchWeatherForSchedule(schedule: HomeScheduleRow, course: HomeCourseRow): Promise<HomeWeatherSnapshot | null> {
  try {
    const weather = await getOpenWeatherForRound({
      roundId: schedule.id,
      courseName: course.name,
      region: course.region,
      latitude: course.latitude,
      longitude: course.longitude,
      date: schedule.round_date,
      time: schedule.tee_time ?? undefined,
    })

    return weatherSnapshotFromRoundWeather(weather)
  } catch {
    return null
  }
}

export async function fetchWeatherByScheduleId(schedules: HomeScheduleRow[], courses: HomeCourseRow[]) {
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const entries = await Promise.all(
    schedules.map(async (schedule) => {
      const course = schedule.course_id ? courseById.get(schedule.course_id) : undefined
      if (!course) return [schedule.id, null] as const
      return [schedule.id, await fetchWeatherForSchedule(schedule, course)] as const
    }),
  )

  return entries.reduce<Record<string, HomeWeatherSnapshot>>((acc, [scheduleId, weather]) => {
    if (weather) acc[scheduleId] = weather
    return acc
  }, {})
}

export function buildWeatherByCourseId(schedules: HomeScheduleRow[], weatherByScheduleId: Record<string, HomeWeatherSnapshot>) {
  return schedules.reduce<Record<string, HomeWeatherSnapshot>>((acc, schedule) => {
    const courseId = schedule.course_id
    const weather = weatherByScheduleId[schedule.id]
    if (courseId && weather && !acc[courseId]) acc[courseId] = weather
    return acc
  }, {})
}

async function fetchHomeCourses(courseIds: string[]) {
  if (!courseIds.length) return { data: [] as HomeCourseRow[], error: null }

  const extendedResult = await supabase
    .from('golf_courses')
    .select('id, name, region, latitude, longitude, hero_image_url, hero_image_source')
    .in('id', courseIds)

  if (!extendedResult.error) return extendedResult

  // 좌표 컬럼 마이그레이션 전 환경에서도 Home 전체가 깨지지 않도록 기존 컬럼만 fallback 조회한다.
  return supabase
    .from('golf_courses')
    .select('id, name, region')
    .in('id', courseIds)
}

async function fetchCourseSeasonImages(courseIds: string[]) {
  if (!courseIds.length) return { data: [] as HomeCourseSeasonImageRow[], error: null }

  return supabase
    .from('golf_course_season_images')
    .select('golf_course_id, season, image_url, image_source, is_active')
    .in('golf_course_id', courseIds)
    .eq('is_active', true)
}

export async function getHomeDashboardRawData(clubId: string): Promise<HomeDashboardRawData> {
  const today = new Date().toISOString().slice(0, 10)

  const { data: schedules, error: scheduleError } = await supabase
    .from('club_round_schedules')
    .select('id, round_date, course_id, course_name, layout_id, layout_name, tee_time, note, status, created_at, updated_at')
    .eq('club_id', clubId)
    .gte('round_date', today)
    .in('status', ['planned', 'recruiting', 'closed', 'finished'])
    .order('round_date', { ascending: true })
    .order('tee_time', { ascending: true })
    .limit(5)

  if (scheduleError) throw scheduleError

  const scheduleRows = (schedules ?? []) as HomeScheduleRow[]
  const scheduleIds = scheduleRows.map((schedule) => schedule.id)
  const courseIds = uniqueValues(scheduleRows.map((schedule) => schedule.course_id))
  const layoutIds = uniqueValues(scheduleRows.map((schedule) => schedule.layout_id))

  const [groupResult, memberResult, courseResult, seasonImageResult, layoutResult, rounds] = await Promise.all([
    scheduleIds.length
      ? supabase
          .from('club_round_groups')
          .select('id, schedule_id, group_no, group_name, tee_time, front_layout_name, back_layout_name')
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
    fetchHomeCourses(courseIds),
    fetchCourseSeasonImages(courseIds),
    layoutIds.length
      ? supabase
          .from('course_layouts')
          .select('id, golf_course_id, name')
          .in('id', layoutIds)
      : Promise.resolve({ data: [], error: null }),
    getHomeRoundSummaries(clubId),
  ])

  if (groupResult.error) throw groupResult.error
  if (memberResult.error) throw memberResult.error
  if (courseResult.error) throw courseResult.error
  if (seasonImageResult.error) throw seasonImageResult.error
  if (layoutResult.error) throw layoutResult.error

  const courseRows = (courseResult.data ?? []) as HomeCourseRow[]

  return {
    schedules: scheduleRows,
    groups: (groupResult.data ?? []) as HomeScheduleGroupRow[],
    members: (memberResult.data ?? []) as HomeScheduleGroupMemberRow[],
    courses: courseRows,
    courseSeasonImages: (seasonImageResult.data ?? []) as HomeCourseSeasonImageRow[],
    layouts: (layoutResult.data ?? []) as HomeLayoutRow[],
    rounds,
    // 날씨는 홈 기본 화면을 먼저 표시한 뒤 useHomeDashboard에서 비동기로 보강한다.
    weatherByCourseId: {},
    weatherByScheduleId: {},
  }
}
