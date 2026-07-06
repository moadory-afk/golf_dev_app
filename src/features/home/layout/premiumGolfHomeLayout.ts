import type { HomeLayoutDefinition } from './homeLayoutTypes'

export const premiumGolfHomeLayout: HomeLayoutDefinition = {
  id: 'premium-golf-wave-v1',
  name: 'Premium Golf Wave',
  description: 'Hero와 Concierge를 곡선으로 연결하고 핵심 기록을 한 화면에 배치하는 Home 레이아웃',
  statUnitVisible: false,
  statRoundMode: 'ceil',
  supportsSlotReorder: true,
  sections: [
    { key: 'hero', slot: 'hero', variant: 'heroWave', marginBottom: -18 },
    { key: 'error', slot: 'error', variant: 'card', marginTop: 0, marginBottom: 10 },
    { key: 'concierge', slot: 'concierge', variant: 'card', marginTop: 0, marginBottom: 14 },
    { key: 'stats', slot: 'stats', variant: 'compact', marginTop: 0, marginBottom: 0 },
  ],
}
