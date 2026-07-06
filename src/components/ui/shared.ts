import type { ViewStyle } from 'react-native'
import type { SkinPalette } from '../../skins'
import type { GPSize, GPTone } from './types'

export const gpSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
}

export const gpRadius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
}

export function getToneColor(palette: SkinPalette, tone: GPTone = 'default') {
  switch (tone) {
    case 'success':
      return palette.green
    case 'danger':
      return palette.danger
    case 'warning':
      return palette.warn
    case 'info':
      return palette.info
    case 'premium':
      return palette.gold
    case 'default':
    default:
      return palette.green
  }
}

export function getSizeValue(size: GPSize, values: Record<GPSize, number>) {
  return values[size]
}

export function gpShadow(palette: SkinPalette, level: 0 | 1 | 2 | 3 = 1): ViewStyle {
  if (level === 0) return {}

  return {
    shadowColor: palette.greenDark,
    shadowOpacity: palette.shadowOpacity * level,
    shadowRadius: 8 + level * 4,
    shadowOffset: { width: 0, height: 3 + level * 2 },
    elevation: level + 1,
  }
}
