import { getHomeDashboardRawData } from '../api/homeRepository'
import { createEmptyHomeDashboard, mapHomeDashboard } from '../mappers/homeMapper'
import type { HomeDashboard } from '../types/home'
import { getHomeAICaddiePreview } from '../../caddie/services/caddieService'

export async function getHomeDashboard(
  clubId?: string | null,
  userName?: string | null,
  userId?: string | null,
): Promise<HomeDashboard> {
  if (!clubId) return createEmptyHomeDashboard()

  const raw = await getHomeDashboardRawData(clubId)
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
