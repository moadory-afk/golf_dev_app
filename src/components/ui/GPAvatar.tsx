import { Image, Text, View } from 'react-native'
import { useSkin } from '../../skins'
import type { GPImageSource, GPSize, GPStyle } from './types'

type GPAvatarProps = {
  name?: string
  initials?: string
  source?: GPImageSource
  size?: GPSize | number
  style?: GPStyle
}

function getInitials(name?: string, initials?: string) {
  if (initials) return initials.slice(0, 2).toUpperCase()
  if (!name) return 'GP'
  const trimmed = name.trim()
  if (!trimmed) return 'GP'
  if (/^[A-Za-z\s]+$/.test(trimmed)) {
    return trimmed.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  }
  return trimmed.slice(0, 2)
}

export function GPAvatar({ name, initials, source, size = 'md', style }: GPAvatarProps) {
  const { palette } = useSkin()
  const box = typeof size === 'number' ? size : size === 'lg' ? 56 : size === 'sm' ? 32 : 42

  return (
    <View style={[{
      width: box,
      height: box,
      borderRadius: box / 2,
      backgroundColor: palette.greenLight,
      borderWidth: 1,
      borderColor: palette.border,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    }, style]}>
      {source ? (
        <Image source={source as any} style={{ width: box, height: box }} resizeMode="cover" />
      ) : (
        <Text style={{ color: palette.green, fontSize: Math.max(11, box * 0.34), fontWeight: '900' }}>{getInitials(name, initials)}</Text>
      )}
    </View>
  )
}
