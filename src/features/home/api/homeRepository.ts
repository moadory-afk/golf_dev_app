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

export type HomeWeatherSnapshot = {
  temperature: string
  weatherText: string
  windText: string
  fetchedAt?: string
}

export type HomeDashboardRawData = {
  schedules: HomeScheduleRow[]
  groups: HomeScheduleGroupRow[]
  members: HomeScheduleGroupMemberRow[]
  courses: HomeCourseRow[]
  layouts: HomeLayoutRow[]
  rounds: SavedRound[]
  weatherByCourseId: Record<string, HomeWeatherSnapshot>
  weatherByScheduleId: Record<string, HomeWeatherSnapshot>
}

type OpenWeatherForecastItem = {
  dt?: number
  main?: { temp?: number }
  weather?: Array<{ description?: string; main?: string }>
  wind?: { speed?: number }
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => !!value)))
}

function openWeatherApiKey() {
  return process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY?.trim()
}

function normalizeWeatherText(value?: string) {
  if (!value) return '날씨 준비중'
  return value.replace(/^[a-z]/, (char) => char.toUpperCase())
}

function normalizeTeeTime(value?: string | null) {
  if (!value) return '09:00'
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return '09:00'
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function targetTimestamp(date?: string | null, teeTime?: string | null) {
  const roundDate = date?.slice(0, 10)
  if (!roundDate) return null
  const target = new Date(`${roundDate}T${normalizeTeeTime(teeTime)}:00+09:00`).getTime()
  return Number.isNaN(target) ? null : Math.round(target / 1000)
}

function pickNearestForecast(items: OpenWeatherForecastItem[], date?: string | null, teeTime?: string | null) {
  const target = targetTimestamp(date, teeTime)
  if (!target || items.length === 0) return null
  return [...items]
    .filter((item) => typeof item.dt === 'number')
    .sort((a, b) => Math.abs((a.dt ?? 0) - target) - Math.abs((b.dt ?? 0) - target))[0] ?? null
}

function weatherSnapshotFromForecast(item: OpenWeatherForecastItem | null): HomeWeatherSnapshot | null {
  if (!item) return null
  const description = item.weather?.[0]?.description || item.weather?.[0]?.main

  return {
    temperature: typeof item.main?.temp === 'number' ? `${Math.round(item.main.temp)}°` : '--°',
    weatherText: normalizeWeatherText(description),
    windText: typeof item.wind?.speed === 'number' ? `${Math.round(item.wind.speed)}m/s` : '풍속 준비중',
    fetchedAt: new Date().toISOString(),
  }
}

async function geocodeCourse(course: HomeCourseRow, apiKey: string) {
  const query = encodeURIComponent(`${course.name} ${course.region} Korea`)
  const geoResponse = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=1&appid=${apiKey}`)
  if (!geoResponse.ok) return null

  const locations = await geoResponse.json() as Array<{ lat?: number; lon?: number }>
  return locations.find((item) => typeof item.lat === 'number' && typeof item.lon === 'number') ?? null
}

async function fetchWeatherForSchedule(schedule: HomeScheduleRow, course: HomeCourseRow): Promise<HomeWeatherSnapshot | null> {
  const apiKey = openWeatherApiKey()
  if (!apiKey) return null

  try {
    const location = await geocodeCourse(course, apiKey)
    if (!location?.lat || !location?.lon) return null

    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${location.lat}&lon=${location.lon}&units=metric&lang=kr&appid=${apiKey}`,
    )
    if (!forecastResponse.ok) return null

    const forecast = await forecastResponse.json() as { list?: OpenWeatherForecastItem[] }
    const picked = pickNearestForecast(forecast.list ?? [], schedule.round_date, schedule.tee_time)
    return weatherSnapshotFromForecast(picked)
  } catch {
    return null
  }
}

async function fetchWeatherByScheduleId(schedules: HomeScheduleRow[], courses: HomeCourseRow[]) {
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

function buildWeatherByCourseId(schedules: HomeScheduleRow[], weatherByScheduleId: Record<string, HomeWeatherSnapshot>) {
  return schedules.reduce<Record<string, HomeWeatherSnapshot>>((acc, schedule) => {
    const courseId = schedule.course_id
    const weather = weatherByScheduleId[schedule.id]
    if (courseId && weather && !acc[courseId]) acc[courseId] = weather
    return acc
  }, {})
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

  const courseRows = (courseResult.data ?? []) as HomeCourseRow[]
  const weatherByScheduleId = await fetchWeatherByScheduleId(scheduleRows, courseRows)

  return {
    schedules: scheduleRows,
    groups: (groupResult.data ?? []) as HomeScheduleGroupRow[],
    members: (memberResult.data ?? []) as HomeScheduleGroupMemberRow[],
    courses: courseRows,
    layouts: (layoutResult.data ?? []) as HomeLayoutRow[],
    rounds,
    weatherByCourseId: buildWeatherByCourseId(scheduleRows, weatherByScheduleId),
    weatherByScheduleId,
  }
}
