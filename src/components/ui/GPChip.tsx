import type { ReactNode } from 'react'
import { Pressable, Text } from 'react-native'
import { useSkin } from '../../skins'
import { getToneColor } from './shared'
import type { GPStyle, GPTone } from './types'

type GPChipProps = {
  label: string
  selected?: boolean
  tone?: GPTone
  disabled?: boolean
  left?: ReactNode
  onPress?: () => void
  style?: GPStyle
}

export function GPChip({ label, selected, tone = 'default', disabled, left, onPress, style }: GPChipProps) {
  const { palette } = useSkin()
  const toneColor = getToneColor(palette, tone)

  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [{
        alignSelf: 'flex-start',
        minHeight: 34,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? toneColor : palette.border,
        backgroundColor: selected ? toneColor : palette.card,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      }, style]}
    >
      {left}
      <Text style={{ color: selected ? palette.accentText : palette.text, fontSize: 13, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  )
}
