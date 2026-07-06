import { useCallback, useEffect, useMemo, useState } from 'react'
import { getHomeAICaddiePreview } from '../services/caddieService'
import type { HomeAICaddiePreview, HomeAICaddiePreviewParams } from '../types/caddieData'

type AICaddieDataState = {
  preview: HomeAICaddiePreview | null
  loading: boolean
  error: string | null
  refresh: () => void
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'AI 캐디 데이터를 불러오지 못했습니다.'
}

export function useAICaddieData(params: HomeAICaddiePreviewParams): AICaddieDataState {
  const [preview, setPreview] = useState<HomeAICaddiePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    getHomeAICaddiePreview(params)
      .then((nextPreview) => {
        if (mounted) setPreview(nextPreview)
      })
      .catch((nextError) => {
        if (!mounted) return
        setError(errorMessage(nextError))
        setPreview(null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [params.userId, params.courseId, params.layoutId, params.holeNo, params.courseName, params.teeTime, params.dday, params.fallbackAverageScore, refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1)
  }, [])

  return useMemo(() => ({ preview, loading, error, refresh }), [preview, loading, error, refresh])
}
