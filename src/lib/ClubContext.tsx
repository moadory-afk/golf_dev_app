import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getMyClubs, type ClubInfo } from './store'
import { supabase } from './supabase'

interface ClubContextValue {
  activeClub: ClubInfo | null
  myClubs: ClubInfo[]
  clubsLoaded: boolean
  setActiveClub: (club: ClubInfo) => void
  refreshClubs: () => Promise<void>
}

interface ClubState {
  myClubs: ClubInfo[]
  activeClub: ClubInfo | null
  loaded: boolean
}

const ClubContext = createContext<ClubContextValue | null>(null)

export function ClubProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClubState>({
    myClubs: [],
    activeClub: null,
    loaded: false,
  })

  const refreshClubs = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setState({ myClubs: [], activeClub: null, loaded: false })
        return
      }

      const clubs = await getMyClubs()
      // 단일 setState로 원자적 업데이트 → 중간 상태 없음
      setState((prev) => ({
        myClubs: clubs,
        activeClub: prev.activeClub
          ? (clubs.find((c) => c.id === prev.activeClub!.id) ?? clubs[0] ?? null)
          : (clubs[0] ?? null),
        loaded: true,
      }))
    } catch {
      setState({ myClubs: [], activeClub: null, loaded: true })
    }
  }, [])

  useEffect(() => {
    refreshClubs()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        refreshClubs()
      } else {
        setState({ myClubs: [], activeClub: null, loaded: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [refreshClubs])

  const setActiveClub = useCallback((club: ClubInfo) => {
    setState((prev) => ({ ...prev, activeClub: club }))
  }, [])

  return (
    <ClubContext.Provider value={{
      activeClub: state.activeClub,
      myClubs: state.myClubs,
      clubsLoaded: state.loaded,
      setActiveClub,
      refreshClubs,
    }}>
      {children}
    </ClubContext.Provider>
  )
}

export function useClub(): ClubContextValue {
  const ctx = useContext(ClubContext)
  if (!ctx) throw new Error('useClub must be used within ClubProvider')
  return ctx
}
