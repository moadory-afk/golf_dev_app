import type { PremiumRecentStatItem } from '../components'

export type HomeRoundStatus = 'planned' | 'recruiting' | 'closed' | 'finished'

export type HomeUpcomingRound = {
  id: string
  courseName: string
  layoutName?: string
  date: string
  dateLabel: string
  teeTime: string
  dday: string
  status: HomeRoundStatus
  statusLabel: string
  memberCount: number
  groupCount: number
  note?: string
  weatherText: string
  temperature: string
  courseId?: string
  layoutId?: string
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
}

export type HomeAiCaddie = {
  courseName?: string
  teeTime?: string
  dday?: string
  averageScore: string
  hasUpcomingRound: boolean
}

export type HomeRecentRound = {
  id: string
  courseName: string
  dateLabel: string
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
  stats: HomeStats
}

export type HomeDashboardState = {
  dashboard: HomeDashboard
  loading: boolean
  error: string | null
  refresh: () => void
}
