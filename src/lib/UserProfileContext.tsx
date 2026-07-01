import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface UserProfileState {
  userId: string | null
  name: string | null
  avatarUrl: string
  icon: string
  initial: string
  loading: boolean
}

interface UserProfileContextValue extends UserProfileState {
  refreshProfile: () => Promise<void>
}

const emptyProfile: UserProfileState = {
  userId: null,
  name: null,
  avatarUrl: '',
  icon: '',
  initial: '?',
  loading: true,
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null)

function fallbackName(user: User): string {
  return user.user_metadata?.name ?? user.email ?? ''
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
      let profileName: string | null = null
      try {
        const { data } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle()
        profileName = data?.name ?? null
      } catch {
        profileName = null
      }

      setProfile((prev) => {
        const name = profileName ?? (prev.userId === user.id ? prev.name ?? fallback : fallback)
        return {
          userId: user.id,
          name: name || null,
          avatarUrl: user.user_metadata?.avatarUrl ?? '',
          icon: user.user_metadata?.icon ?? '',
          initial: (name || '?').slice(0, 1),
          loading: false,
        }
      })
    } catch {
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
