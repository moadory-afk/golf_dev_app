import { useState, useEffect, useRef } from 'react'

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[]
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fnRef.current()
      .then((result) => { if (!cancelled) { setData(result); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err?.message ?? String(err)); setLoading(false) } })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}
