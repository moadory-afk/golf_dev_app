import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, Text } from 'react-native'
import { useSkin } from '../../skins'
import { getSizeValue } from './shared'
import type { GPChildren, GPSize, GPStyle, GPVariant } from './types'

type GPButtonProps = GPChildren & {
  label?: string
  variant?: GPVariant
  size?: GPSize
  fullWidth?: boolean
  disabled?: boolean
  loading?: boolean
  left?: ReactNode
  right?: ReactNode
  onPress?: () => void
  style?: GPStyle
}

export function GPButton({
  label,
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  disabled,
  loading,
  left,
  right,
  onPress,
  style,
}: GPButtonProps) {
  const { palette } = useSkin()
  const height = getSizeValue(size, { sm: 34, md: 42, lg: 50 })
  const fontSize = getSizeValue(size, { sm: 12, md: 14, lg: 15 })
  const isDisabled = disabled || loading

  const backgroundColor =
    variant === 'primary' ? palette.green :
    variant === 'soft' ? palette.greenLight :
    'transparent'
  const borderColor =
    variant === 'outline' ? palette.border :
    variant === 'ghost' ? 'transparent' :
    backgroundColor
  const color = variant === 'primary' ? palette.accentText : palette.green

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          minHeight: height,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          borderRadius: 999,
          borderWidth: 1,
          borderColor,
          backgroundColor,
          paddingHorizontal: size === 'lg' ? 20 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: isDisabled ? 0.48 : pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : left}
      {label ? <Text style={{ color, fontSize, fontWeight: '900' }}>{label}</Text> : children}
      {!loading ? right : null}
    </Pressable>
  )
}
