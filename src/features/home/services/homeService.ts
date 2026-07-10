import { createEmptyHomeDashboard, mapHomeDashboard } from '../mappers/homeMapper'
import type { HomeDashboard } from '../types/home'
import { getHomeAICaddiePreview } from '../../caddie/services/caddieService'
import { getHomeDashboardRawData } from '../api/homeRepository'
import { formatTravelMinutes, getDrivingTravelTimeMinutes } from '../../../lib/travelTime'

type HomeCoordinate = {
  latitude?: number | null
  longitude?: number | null
}

async function applyDrivingTravelTimes(dashboard: HomeDashboard, raw: Awaited<ReturnType<typeof getHomeDashboardRawData>>, home?: HomeCoordinate | null) {
  if (typeof home?.latitude !== 'number' || typeof home.longitude !== 'number') return dashboard

  const scheduleById = new Map(raw.schedules.map((schedule) => [schedule.id, schedule]))
  const courseById = new Map(raw.courses.map((course) => [course.id, course]))
  const rounds = await Promise.all(
    dashboard.hero.rounds.map(async (round) => {
      const schedule = scheduleById.get(round.id)
      const course = schedule?.course_id ? courseById.get(schedule.course_id) : undefined
      const minutes = await getDrivingTravelTimeMinutes(home, {
        latitude: course?.latitude,
        longitude: course?.longitude,
      }).catch(() => null)
      if (!minutes) return round
      return { ...round, routeTimeText: formatTravelMinutes(minutes) }
    }),
  )

  const firstRound = rounds[0]
  const upcomingRound = dashboard.upcomingRound && firstRound?.id === dashboard.upcomingRound.id
    ? (({ locationLabel: _locationLabel, routeTimeText: _routeTimeText, departureTimeText: _departureTimeText, urgencyTone: _urgencyTone, ...round }) => round)(firstRound)
    : dashboard.upcomingRound

  return {
    ...dashboard,
    hero: {
      ...dashboard.hero,
      rounds,
    },
    upcomingRound,
  }
}

export async function getHomeDashboard(
  clubId?: string | null,
  userName?: string | null,
  userId?: string | null,
  home?: HomeCoordinate | null,
): Promise<HomeDashboard> {
  if (!clubId) return createEmptyHomeDashboard()

  const raw = await getHomeDashboardRawData(clubId)
  const mappedDashboard = mapHomeDashboard(raw, userName, userId)
  const dashboard = await applyDrivingTravelTimes(mappedDashboard, raw, home)
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
