import { Text, View } from 'react-native'
import { useSkin } from '../../skins'
import { getToneColor } from './shared'
import type { GPSize, GPStyle, GPTone } from './types'

type GPBadgeProps = {
  label: string
  tone?: GPTone
  size?: GPSize
  variant?: 'solid' | 'soft'
  style?: GPStyle
}

export function GPBadge({ label, tone = 'default', size = 'sm', variant = 'soft', style }: GPBadgeProps) {
  const { palette } = useSkin()
  const toneColor = getToneColor(palette, tone)
  const solid = variant === 'solid'
  const paddingV = size === 'lg' ? 7 : size === 'md' ? 6 : 4
  const paddingH = size === 'lg' ? 12 : size === 'md' ? 10 : 8

  return (
    <View style={[{
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingVertical: paddingV,
      paddingHorizontal: paddingH,
      backgroundColor: solid ? toneColor : palette.greenLight,
      borderWidth: solid ? 0 : 1,
      borderColor: palette.border,
    }, style]}>
      <Text style={{ color: solid ? palette.accentText : toneColor, fontSize: size === 'lg' ? 13 : 11, fontWeight: '900' }}>{label}</Text>
    </View>
  )
}
