import { getHomeDashboardRawData } from '../api/homeRepository'
import { createEmptyHomeDashboard, mapHomeDashboard } from '../mappers/homeMapper'
import type { HomeDashboard } from '../types/home'

export async function getHomeDashboard(clubId?: string | null, userName?: string | null): Promise<HomeDashboard> {
  if (!clubId) return createEmptyHomeDashboard()
  const raw = await getHomeDashboardRawData(clubId)
  return mapHomeDashboard(raw, userName)
}
