import type { TextStyle, ViewStyle } from 'react-native'
import type { SkinPalette } from '../skins'

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 30,
  pill: 999,
} as const

export const typography = {
  eyebrow: { fontSize: 12, fontWeight: '900' as const, letterSpacing: -0.1 },
  caption: { fontSize: 11, fontWeight: '700' as const },
  bodySm: { fontSize: 12, fontWeight: '700' as const, lineHeight: 17 },
  body: { fontSize: 13, fontWeight: '700' as const, lineHeight: 19 },
  bodyLg: { fontSize: 15, fontWeight: '800' as const, lineHeight: 21 },
  sectionTitle: { fontSize: 18, fontWeight: '900' as const, letterSpacing: -0.3 },
  cardTitle: { fontSize: 17, fontWeight: '900' as const, letterSpacing: -0.4 },
  title: { fontSize: 21, fontWeight: '900' as const, letterSpacing: -0.6 },
  display: { fontSize: 38, fontWeight: '900' as const, letterSpacing: -1.3 },
} satisfies Record<string, TextStyle>

export const motion = {
  fast: 120,
  base: 180,
  slow: 260,
} as const

export const colorLayers = {
  heroScrim: 'rgba(0,0,0,0.46)',
  heroScrimSoft: 'rgba(0,0,0,0.18)',
  heroGlass: 'rgba(255,255,255,0.18)',
  heroGlassStrong: 'rgba(255,255,255,0.28)',
  heroTextMuted: 'rgba(255,255,255,0.82)',
  heroTextSoft: 'rgba(255,255,255,0.68)',
  cardHairline: 'rgba(16,20,18,0.08)',
} as const

export function createShadow(palette: SkinPalette, level: 0 | 1 | 2 | 3 = 1): ViewStyle {
  if (level === 0) return { elevation: 0, shadowOpacity: 0 }
  const opacity = palette.shadowOpacity * level
  return {
    shadowColor: palette.greenDark,
    shadowOpacity: opacity,
    shadowRadius: 8 + level * 4,
    shadowOffset: { width: 0, height: 3 + level * 2 },
    elevation: level + 1,
  }
}

export function createTheme(palette: SkinPalette) {
  return {
    colors: {
      primary: palette.green,
      primaryDark: palette.greenDark,
      primaryMid: palette.greenMid,
      primarySoft: palette.greenLight,
      background: palette.bg,
      surface: palette.card,
      text: palette.text,
      muted: palette.muted,
      border: palette.border,
      danger: palette.danger,
      warning: palette.warn,
      info: palette.info,
      accent: palette.accent,
      accentText: palette.accentText,
      headerText: palette.headerText,
      headerBg: palette.headerBg,
      tabBg: palette.tabBg,
      tabActiveBg: palette.tabActiveBg,
      gold: palette.gold,
      silver: palette.silver,
      bronze: palette.bronze,
      eagle: palette.eagle,
    },
    spacing,
    radius: {
      ...radius,
      card: palette.cardRadius,
    },
    typography,
    motion,
    colorLayers,
    shadow: (level: 0 | 1 | 2 | 3 = 1) => createShadow(palette, level),
  }
}

export type GPTheme = ReturnType<typeof createTheme>
