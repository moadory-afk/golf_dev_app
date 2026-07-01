import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native'
import { C } from '../theme'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { useUserProfile } from '../lib/UserProfileContext'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface AvatarData {
  avatarUrl: string
  icon: string
  initial: string
}

export function useUserAvatar(): AvatarData {
  const profile = useUserProfile()
  return {
    avatarUrl: profile.avatarUrl,
    icon: profile.icon,
    initial: profile.initial,
  }
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
