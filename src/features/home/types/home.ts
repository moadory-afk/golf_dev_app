import type { PremiumRecentStatItem } from '../components'
import type { HomeFeedEvent } from '../engine'

export type HomeRoundStatus = 'planned' | 'recruiting' | 'closed' | 'finished'
export type HomeAttendanceStatus = '참석' | '불참' | '미정'

export type HomeUpcomingRound = {
  id: string
  courseName: string
  layoutName?: string
  courseLine?: string
  date: string
  dateLabel: string
  teeTime: string
  dday: string
  status: HomeRoundStatus
  statusLabel: string
  memberCount: number
  groupCount: number
  memberNames?: string[]
  attendanceStatus?: HomeAttendanceStatus
  note?: string
  weatherText: string
  temperature: string
  windText?: string
  fiveHourWeatherSummary?: string
  fiveHourWeatherDetail?: string
  courseId?: string
  layoutId?: string
  heroImageUrl?: string | null
  routeTimeText?: string
  departureTimeText?: string
  awardPlanReady?: boolean
  lottoPurchased?: boolean
  lottoDrawStatus?: 'PENDING' | 'COMPLETED' | null
  lottoDrafterUserId?: string | null
  isLottoDrafter?: boolean
  resultSaved?: boolean
  resultComplete?: boolean
}

export type HomeHeroRound = HomeUpcomingRound & {
  locationLabel: string
  routeTimeText: string
  departureTimeText: string
  urgencyTone: 'calm' | 'soon' | 'today' | 'urgent'
}

export type HomeHero = {
  courseName: string
  address: string
  weatherText: string
  temperature: string
  dday: string
  roundDate: string
  teeTime: string
  totalCount: number
  rounds: HomeHeroRound[]
}

export type HomeAiCaddie = {
  courseName?: string
  teeTime?: string
  dday?: string
  averageScore: string
  hasUpcomingRound: boolean
  title?: string
  message?: string
  primaryChip?: string
  secondaryChip?: string
  hasLiveAdvice?: boolean
  recommendedClub?: string
  riskLabel?: string
}

export type HomeRecentRound = {
  id: string
  courseName: string
  dateLabel: string
  date?: string
  total: number | null
  diff: string
}

export type HomeStats = {
  averageScore: string
  items: PremiumRecentStatItem[]
  recentRounds: HomeRecentRound[]
}

export type HomeDashboard = {
  hero: HomeHero
  upcomingRound: HomeUpcomingRound | null
  aiCaddie: HomeAiCaddie
  feed: HomeFeedEvent
  feedEvents: HomeFeedEvent[]
  feedEventsByRoundId: Record<string, HomeFeedEvent[]>
  stats: HomeStats
}

export type HomeDashboardState = {
  dashboard: HomeDashboard
  loading: boolean
  error: string | null
  refresh: () => void
}
