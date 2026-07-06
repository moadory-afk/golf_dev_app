import type { ReactNode } from 'react'
import { View } from 'react-native'
import { GPText } from './GPText'
import type { GPChildren, GPStyle } from './types'

type GPSectionProps = GPChildren & {
  title?: string
  subtitle?: string
  right?: ReactNode
  style?: GPStyle
  headerStyle?: GPStyle
}

export function GPSection({ title, subtitle, right, children, style, headerStyle }: GPSectionProps) {
  return (
    <View style={[{ marginBottom: 18 }, style]}>
      {(title || subtitle || right) ? (
        <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10, gap: 12 }, headerStyle]}>
          <View style={{ flex: 1 }}>
            {title ? <GPText variant="title" weight="black">{title}</GPText> : null}
            {subtitle ? <GPText variant="caption" tone="muted" weight="medium" style={{ marginTop: 2 }}>{subtitle}</GPText> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  )
}
