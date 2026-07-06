import { useCallback, useEffect, useState } from 'react'
import { getCaddieBook } from '../services/caddieBookService'
import type { CaddieBookData, CaddieBookRouteParams } from '../types/caddieBook'

function emptyCaddieBook(params: CaddieBookRouteParams): CaddieBookData {
  return {
    courseName: params.courseName || '캐디북',
    layoutName: params.layoutName,
    holes: [],
    hasLiveGuide: false,
  }
}

export function useCaddieBook(params: CaddieBookRouteParams & { userId?: string | null }) {
  const [data, setData] = useState<CaddieBookData>(() => emptyCaddieBook(params))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!params.courseId || !params.layoutId) {
      setData(emptyCaddieBook(params))
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const next = await getCaddieBook(params)
      setData(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : '캐디북 데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [params.courseId, params.courseName, params.layoutId, params.layoutName, params.userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
