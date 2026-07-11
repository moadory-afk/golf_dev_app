import { useCallback, useEffect, useMemo, useState } from 'react'
import { getHomeDashboard } from '../services/homeService'
import { createEmptyHomeDashboard } from '../mappers/homeMapper'
import type { HomeDashboard, HomeDashboardState } from '../types/home'
import { supabase } from '../../../lib/supabase'
import { subscribeHomeDashboardChanged } from '../../../lib/homeDashboardEvents'

type UseHomeDashboardParams = {
  clubId?: string | null
  userName?: string | null
  userId?: string | null
  homeLatitude?: number | null
  homeLongitude?: number | null
  departureBufferMinutes?: number
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '홈 데이터를 불러오지 못했습니다.'
}

export function useHomeDashboard({ clubId, userName, userId, homeLatitude, homeLongitude, departureBufferMinutes }: UseHomeDashboardParams): HomeDashboardState {
  const [dashboard, setDashboard] = useState<HomeDashboard>(() => createEmptyHomeDashboard())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    getHomeDashboard(clubId, userName, userId, { latitude: homeLatitude, longitude: homeLongitude }, departureBufferMinutes)
      .then((nextDashboard) => {
        if (mounted) setDashboard(nextDashboard)
      })
      .catch((nextError) => {
        if (!mounted) return
        setError(errorMessage(nextError))
        setDashboard(createEmptyHomeDashboard())
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [clubId, userName, userId, homeLatitude, homeLongitude, departureBufferMinutes, refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!clubId) return

    const channel = supabase
      .channel(`home-dashboard:${clubId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'club_round_schedules',
        filter: `club_id=eq.${clubId}`,
      }, refresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'club_round_groups',
      }, refresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'club_round_group_members',
      }, refresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'golf_courses',
      }, refresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'golf_course_season_images',
      }, refresh)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clubId, refresh])

  useEffect(() => {
    return subscribeHomeDashboardChanged((changedClubId) => {
      if (!changedClubId || changedClubId === clubId) refresh()
    })
  }, [clubId, refresh])

  return useMemo(
    () => ({ dashboard, loading, error, refresh }),
    [dashboard, loading, error, refresh],
  )
}
