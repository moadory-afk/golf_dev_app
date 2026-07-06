import { useCallback, useEffect, useMemo, useState } from 'react'
import { getHomeDashboard } from '../services/homeService'
import { createEmptyHomeDashboard } from '../mappers/homeMapper'
import type { HomeDashboard, HomeDashboardState } from '../types/home'

type UseHomeDashboardParams = {
  clubId?: string | null
  userName?: string | null
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '홈 데이터를 불러오지 못했습니다.'
}

export function useHomeDashboard({ clubId, userName }: UseHomeDashboardParams): HomeDashboardState {
  const [dashboard, setDashboard] = useState<HomeDashboard>(() => createEmptyHomeDashboard())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    getHomeDashboard(clubId, userName)
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
  }, [clubId, userName, refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1)
  }, [])

  return useMemo(
    () => ({ dashboard, loading, error, refresh }),
    [dashboard, loading, error, refresh],
  )
}
