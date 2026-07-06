import { supabase } from '../../../lib/supabase'
import { getRounds } from '../../../lib/store'
import { createEmptyHomeDashboard, mapHomeDashboard } from '../mappers/homeMapper'
import type { HomeDashboard } from '../types/home'
import { getHomeAICaddiePreview } from '../../caddie/services/caddieService'
import type {
  HomeCourseRow,
  HomeDashboardRawData,
  HomeLayoutRow,
  HomeScheduleGroupMemberRow,
  HomeScheduleGroupRow,
  HomeScheduleRow,
  HomeWeatherSnapshot,
} from '../api/homeRepository'

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

async function fetchWeatherForCourse(course: HomeCourseRow): Promise<HomeWeatherSnapshot | null> {
  const apiKey = openWeatherApiKey()
  if (!apiKey) return null

  try {
    const query = encodeURIComponent(`${course.name} ${course.region} Korea`)
    const geoResponse = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=1&appid=${apiKey}`)
    if (!geoResponse.ok) return null

    const locations = await geoResponse.json() as Array<{ lat?: number; lon?: number }>
    const location = locations.find((item) => typeof item.lat === 'number' && typeof item.lon === 'number')
    if (!location?.lat || !location?.lon) return null

    const weatherResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&units=metric&lang=kr&appid=${apiKey}`)
    if (!weatherResponse.ok) return null

    const weather = await weatherResponse.json() as {
      main?: { temp?: number }
      weather?: Array<{ description?: string; main?: string }>
      wind?: { speed?: number }
    }

    return {
      temperature: typeof weather.main?.temp === 'number' ? `${Math.round(weather.main.temp)}°` : '--°',
      weatherText: normalizeWeatherText(weather.weather?.[0]?.description || weather.weather?.[0]?.main),
      windText: typeof weather.wind?.speed === 'number' ? `${Math.round(weather.wind.speed)}m/s` : '풍속 준비중',
    }
  } catch {
    return null
  }
}

async function fetchWeatherByCourseId(courses: HomeCourseRow[]) {
  const entries = await Promise.all(
    courses.map(async (course) => [course.id, await fetchWeatherForCourse(course)] as const),
  )

  return entries.reduce<Record<string, HomeWeatherSnapshot>>((acc, [courseId, weather]) => {
    if (weather) acc[courseId] = weather
    return acc
  }, {})
}

async function loadHomeDashboardRawData(clubId: string): Promise<HomeDashboardRawData> {
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

  return {
    schedules: scheduleRows,
    groups: (groupResult.data ?? []) as HomeScheduleGroupRow[],
    members: (memberResult.data ?? []) as HomeScheduleGroupMemberRow[],
    courses: courseRows,
    layouts: (layoutResult.data ?? []) as HomeLayoutRow[],
    rounds,
    weatherByCourseId: await fetchWeatherByCourseId(courseRows),
  }
}

export async function getHomeDashboard(
  clubId?: string | null,
  userName?: string | null,
  userId?: string | null,
): Promise<HomeDashboard> {
  if (!clubId) return createEmptyHomeDashboard()

  const raw = await loadHomeDashboardRawData(clubId)
  const dashboard = mapHomeDashboard(raw, userName)
  const upcomingRound = dashboard.upcomingRound

  const aiPreview = await getHomeAICaddiePreview({
    userId,
    courseId: upcomingRound?.courseId,
    layoutId: upcomingRound?.layoutId,
    holeNo: 1,
    courseName: upcomingRound?.courseName,
    teeTime: upcomingRound?.teeTime,
    dday: upcomingRound?.dday,
    fallbackAverageScore: dashboard.stats.averageScore,
  })

  if (!aiPreview) return dashboard

  return {
    ...dashboard,
    aiCaddie: {
      ...dashboard.aiCaddie,
      title: aiPreview.title,
      message: aiPreview.message,
      primaryChip: aiPreview.primaryChip,
      secondaryChip: aiPreview.secondaryChip,
      hasLiveAdvice: aiPreview.hasLiveAdvice,
      recommendedClub: aiPreview.recommendedClub,
      riskLabel: aiPreview.riskLabel,
    },
  }
}
