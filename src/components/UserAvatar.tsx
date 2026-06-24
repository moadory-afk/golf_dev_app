import { useEffect, useState } from 'react'
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface AvatarData {
  avatarUrl: string
  icon: string
  initial: string
}

export function useUserAvatar(): AvatarData {
  const [data, setData] = useState<AvatarData>({ avatarUrl: '', icon: '', initial: '?' })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
      const name = profile?.name ?? user.user_metadata?.name ?? user.email ?? '?'
      setData({
        avatarUrl: user.user_metadata?.avatarUrl ?? '',
        icon: user.user_metadata?.icon ?? '',
        initial: name.slice(0, 1),
      })
    })

    // 프로필 변경 감지 (auth state 변경 시 갱신)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const user = session?.user
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
        const name = profile?.name ?? user.user_metadata?.name ?? user.email ?? '?'
        setData({
          avatarUrl: user.user_metadata?.avatarUrl ?? '',
          icon: user.user_metadata?.icon ?? '',
          initial: name.slice(0, 1),
        })
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return data
}

interface UserAvatarBtnProps {
  size?: number
  borderColor?: string
}

export function UserAvatarBtn({ size = 38, borderColor = 'rgba(255,255,255,0.4)' }: UserAvatarBtnProps) {
  const nav = useNavigation<Nav>()
  const avatar = useUserAvatar()

  const circleStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor,
    overflow: 'hidden' as const,
    backgroundColor: C.gold,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }

  return (
    <TouchableOpacity onPress={() => nav.navigate('Profile')} style={circleStyle}>
      {avatar.avatarUrl ? (
        <Image source={{ uri: avatar.avatarUrl }} style={{ width: size, height: size }} />
      ) : avatar.icon ? (
        <Text style={{ fontSize: size * 0.5 }}>{avatar.icon}</Text>
      ) : (
        <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '900' }}>
          {avatar.initial}
        </Text>
      )}
    </TouchableOpacity>
  )
}

// 프로필 화면용 큰 아바타 (인터랙션 없음)
interface UserAvatarDisplayProps {
  avatarUrl: string
  icon: string
  initial: string
  size?: number
}

export function UserAvatarDisplay({ avatarUrl, icon, initial, size = 64 }: UserAvatarDisplayProps) {
  const circleStyle: any = {
    width: size, height: size, borderRadius: size / 2,
    backgroundColor: C.gold, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
  }

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={circleStyle} />
  }
  if (icon) {
    return (
      <View style={circleStyle}>
        <Text style={{ fontSize: size * 0.48 }}>{icon}</Text>
      </View>
    )
  }
  return (
    <View style={circleStyle}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '900', color: '#fff' }}>{initial}</Text>
    </View>
  )
}
