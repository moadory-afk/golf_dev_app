import type { ReactNode } from 'react'

export type HomeLayoutSlot = 'hero' | 'error' | 'concierge' | 'stats'

export type HomeLayoutSection = {
  key: string
  slot: HomeLayoutSlot
  visible?: boolean
  variant?: 'heroWave' | 'card' | 'compact'
  marginTop?: number
  marginBottom?: number
}

export type HomeLayoutDefinition = {
  id: string
  name: string
  description: string
  sections: HomeLayoutSection[]
  statUnitVisible: boolean
  statRoundMode: 'ceil' | 'round'
  supportsSlotReorder: boolean
}

export type HomeLayoutSlots = Partial<Record<HomeLayoutSlot, ReactNode>>
