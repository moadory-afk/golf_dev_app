import type { ReactNode } from 'react'
import { Pressable } from 'react-native'
import { useSkin } from '../../skins'
import type { GPSize, GPStyle, GPVariant } from './types'

type GPIconButtonProps = {
  children: ReactNode
  variant?: GPVariant
  size?: GPSize
  disabled?: boolean
  onPress?: () => void
  accessibilityLabel?: string
  style?: GPStyle
}

export function GPIconButton({ children, variant = 'soft', size = 'md', disabled, onPress, accessibilityLabel, style }: GPIconButtonProps) {
  const { palette } = useSkin()
  const box = size === 'lg' ? 48 : size === 'sm' ? 34 : 40
  const backgroundColor = variant === 'primary' ? palette.green : variant === 'soft' ? palette.greenLight : 'transparent'
  const borderColor = variant === 'outline' ? palette.border : variant === 'ghost' ? 'transparent' : backgroundColor

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{
        width: box,
        height: box,
        borderRadius: 999,
        borderWidth: 1,
        borderColor,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      }, style]}
    >
      {children}
    </Pressable>
  )
}
