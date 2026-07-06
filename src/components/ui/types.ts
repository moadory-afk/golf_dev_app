import type { ReactNode } from 'react'
import type { ImageSourcePropType, StyleProp, TextStyle, ViewStyle } from 'react-native'

export type GPSize = 'sm' | 'md' | 'lg'
export type GPVariant = 'primary' | 'soft' | 'ghost' | 'outline'
export type GPTone = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'premium'

export type GPStyle = StyleProp<ViewStyle>
export type GPTextStyle = StyleProp<TextStyle>

export type GPChildren = {
  children?: ReactNode
}

export type GPImageSource = ImageSourcePropType | { uri: string }
