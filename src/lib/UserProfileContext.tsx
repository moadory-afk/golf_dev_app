import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface UserProfileState {
  userId: string | null
  name: string | null
  nickname: string | null
  avatarUrl: string
  icon: string
  initial: string
  homeAddress: string
  homeLatitude: number | null
  homeLongitude: number | null
  departureBufferMinutes: number
  loading: boolean
}

interface UserProfileContextValue extends UserProfileState {
  refreshProfile: () => Promise<void>
}

const emptyProfile: UserProfileState = {
  userId: null,
  name: null,
  nickname: null,
  avatarUrl: '',
  icon: '',
  initial: '?',
  homeAddress: '',
  homeLatitude: null,
  homeLongitude: null,
  departureBufferMinutes: 40,
  loading: true,
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null)

function fallbackName(user: User): string {
  return (
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.user_metadata?.display_name ??
    user.email?.split('@')[0] ??
    'GogoPar 회원'
  )
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfileState>(emptyProfile)

  const loadProfile = useCallback(async (authUser?: User | null) => {
    try {
      const user = authUser ?? (await supabase.auth.getSession()).data.session?.user ?? null
      if (!user) {
        setProfile({ ...emptyProfile, loading: false })
        return
      }

      const fallback = fallbackName(user)

      // OAuth 사용자는 auth.users에는 생성되지만 public.profiles에는 자동으로
      // 생성되지 않을 수 있다. 부가 컬럼 조회보다 먼저 최소 필드(id, name)만으로
      // 프로필 존재 여부를 확인하고 없으면 생성한다.
      const { data: baseProfile, error: baseReadError } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', user.id)
        .maybeSingle()

      if (baseReadError) throw baseReadError

      let profileName = baseProfile?.name ?? fallback

      if (!baseProfile) {
        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            name: fallback,
          })
          .select('id, name')
          .single()

        if (createError) throw createError
        profileName = createdProfile?.name ?? fallback
      }

      // 부가 컬럼은 앱 버전 또는 DB 마이그레이션 상태에 따라 없을 수 있으므로
      // 별도 조회하고 실패하더라도 기본 프로필 생성 결과는 유지한다.
      let profileNickname: string | null = null
      let homeAddress = ''
      let homeLatitude: number | null = null
      let homeLongitude: number | null = null
      let departureBufferMinutes = 40

      const { data: detailProfile } = await supabase
        .from('profiles')
        .select('nickname, home_address, home_latitude, home_longitude, departure_buffer_minutes')
        .eq('id', user.id)
        .maybeSingle()

      if (detailProfile) {
        profileNickname = detailProfile.nickname ?? null
        homeAddress = detailProfile.home_address ?? ''
        homeLatitude = typeof detailProfile.home_latitude === 'number' ? detailProfile.home_latitude : null
        homeLongitude = typeof detailProfile.home_longitude === 'number' ? detailProfile.home_longitude : null
        const savedBufferMinutes = Number(detailProfile.departure_buffer_minutes)
        departureBufferMinutes = Number.isFinite(savedBufferMinutes) && savedBufferMinutes >= 0
          ? Math.round(savedBufferMinutes)
          : 40
      }

      const name = profileName || fallback
      setProfile({
        userId: user.id,
        name,
        nickname: profileNickname || name,
        avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.avatarUrl ?? '',
        icon: user.user_metadata?.icon ?? '',
        initial: (profileNickname || name || '?').slice(0, 1),
        homeAddress,
        homeLatitude,
        homeLongitude,
        departureBufferMinutes,
        loading: false,
      })
    } catch (error) {
      console.error('[UserProfileContext] profile sync failed:', error)
      setProfile((prev) => ({ ...prev, loading: false }))
    }
  }, [])

  const refreshProfile = useCallback(() => loadProfile(), [loadProfile])

  useEffect(() => {
    loadProfile()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user)
      } else {
        setProfile({ ...emptyProfile, loading: false })
      }
    })
    return () => subscription.unsubscribe()
  }, [loadProfile])

  return (
    <UserProfileContext.Provider value={{ ...profile, refreshProfile }}>
      {children}
    </UserProfileContext.Provider>
  )
}

export function useUserProfile(): UserProfileContextValue {
  const ctx = useContext(UserProfileContext)
  if (!ctx) throw new Error('useUserProfile must be used within UserProfileProvider')
  return ctx
}
