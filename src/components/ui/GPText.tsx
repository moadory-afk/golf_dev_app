import { Text, type TextProps } from 'react-native'
import { useSkin } from '../../skins'
import type { GPTextStyle } from './types'

type GPTextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'label'
type GPTextTone = 'default' | 'muted' | 'primary' | 'danger' | 'warning' | 'info' | 'premium' | 'inverse'

type GPTextProps = TextProps & {
  variant?: GPTextVariant
  tone?: GPTextTone
  weight?: 'regular' | 'medium' | 'bold' | 'black'
  align?: 'left' | 'center' | 'right'
  style?: GPTextStyle
}

function getVariantStyle(variant: GPTextVariant) {
  switch (variant) {
    case 'display':
      return { fontSize: 28, lineHeight: 34, letterSpacing: -0.8 }
    case 'title':
      return { fontSize: 20, lineHeight: 26, letterSpacing: -0.5 }
    case 'subtitle':
      return { fontSize: 16, lineHeight: 22, letterSpacing: -0.2 }
    case 'caption':
      return { fontSize: 12, lineHeight: 17, letterSpacing: -0.1 }
    case 'label':
      return { fontSize: 13, lineHeight: 18, letterSpacing: -0.1 }
    case 'body':
    default:
      return { fontSize: 14, lineHeight: 21, letterSpacing: -0.1 }
  }
}

function getWeight(weight: NonNullable<GPTextProps['weight']>) {
  switch (weight) {
    case 'black':
      return '900'
    case 'bold':
      return '800'
    case 'medium':
      return '700'
    case 'regular':
    default:
      return '500'
  }
}

export function GPText({
  variant = 'body',
  tone = 'default',
  weight = variant === 'body' ? 'regular' : 'bold',
  align = 'left',
  style,
  children,
  ...props
}: GPTextProps) {
  const { palette } = useSkin()
  const color =
    tone === 'muted' ? palette.muted :
    tone === 'primary' ? palette.green :
    tone === 'danger' ? palette.danger :
    tone === 'warning' ? palette.warn :
    tone === 'info' ? palette.info :
    tone === 'premium' ? palette.gold :
    tone === 'inverse' ? palette.accentText :
    palette.text

  return (
    <Text
      {...props}
      style={[
        getVariantStyle(variant),
        { color, fontWeight: getWeight(weight), textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  )
}
