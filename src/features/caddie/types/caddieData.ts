import type { AICaddieAdvice, HoleGuideRiskSource, UserDistanceProfile } from './caddie'

export type UserPreferenceTee = 'blue' | 'white' | 'red'

export type UserPreferences = {
  userId: string
  defaultTee: UserPreferenceTee
  distanceUnit: 'm' | 'yd'
  showAiCaddie: boolean
}

export type CaddieDistanceProfileRow = {
  user_id: string
  driver_m?: number | null
  wood3_m?: number | null
  wood5_m?: number | null
  hybrid4_m?: number | null
  hybrid5_m?: number | null
  iron5_m?: number | null
  iron6_m?: number | null
  iron7_m?: number | null
  iron8_m?: number | null
  iron9_m?: number | null
  pw_m?: number | null
  aw_m?: number | null
  sw_m?: number | null
  putter_note?: string | null
}

export type CaddieUserPreferencesRow = {
  user_id: string
  default_tee?: UserPreferenceTee | null
  distance_unit?: 'm' | 'yd' | null
  show_ai_caddie?: boolean | null
}

export type CaddieHoleGuideRow = HoleGuideRiskSource & {
  id: string
  golf_course_id: string
  layout_id: string
  hole_no: number
  par?: number | null
  title?: string | null
  blue_tee_m?: number | null
  white_tee_m?: number | null
  red_tee_m?: number | null
}

export type CaddieBindingRawData = {
  distanceProfile: CaddieDistanceProfileRow | null
  preferences: CaddieUserPreferencesRow | null
  holeGuide: CaddieHoleGuideRow | null
}

export type HomeAICaddiePreviewParams = {
  userId?: string | null
  courseId?: string | null
  layoutId?: string | null
  holeNo?: number
  courseName?: string | null
  teeTime?: string | null
  dday?: string | null
  fallbackAverageScore: string
}

export type HomeAICaddiePreview = {
  title: string
  message: string
  primaryChip: string
  secondaryChip: string
  hasLiveAdvice: boolean
  recommendedClub?: string
  riskLabel?: string
  advice?: AICaddieAdvice
}

export type CaddieBindingInput = {
  raw: CaddieBindingRawData
  courseName?: string | null
  teeTime?: string | null
  dday?: string | null
  fallbackAverageScore: string
}

export type MappedCaddieProfile = {
  distanceProfile: UserDistanceProfile
  preferences: UserPreferences
}
