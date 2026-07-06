import { Pressable, View, type PressableProps } from 'react-native'
import { useSkin } from '../../skins'
import { gpShadow } from './shared'
import type { GPChildren, GPStyle } from './types'

type GPCardProps = GPChildren & {
  style?: GPStyle
  contentStyle?: GPStyle
  elevated?: boolean
  selected?: boolean
  disabled?: boolean
  onPress?: PressableProps['onPress']
}

export function GPCard({ children, style, contentStyle, elevated = true, selected, disabled, onPress }: GPCardProps) {
  const { palette } = useSkin()
  const baseStyle = [
    {
      backgroundColor: palette.card,
      borderColor: selected ? palette.green : palette.border,
      borderRadius: palette.cardRadius,
      borderWidth: selected ? 1.5 : 1,
      opacity: disabled ? 0.55 : 1,
      overflow: 'hidden' as const,
    },
    elevated && gpShadow(palette, selected ? 2 : 1),
    style,
  ]

  const inner = <View style={[{ padding: 16 }, contentStyle]}>{children}</View>

  if (onPress) {
    return (
      <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [baseStyle, pressed && { transform: [{ scale: 0.99 }] }]}>
        {inner}
      </Pressable>
    )
  }

  return <View style={baseStyle}>{inner}</View>
}
