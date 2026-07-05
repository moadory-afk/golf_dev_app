import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type SkinId = 'classic' | 'turf' | 'cuteGolf' | 'premium' | 'minimal'

export type SkinPalette = {
  green: string
  greenDark: string
  greenMid: string
  greenLight: string
  bg: string
  card: string
  text: string
  muted: string
  border: string
  danger: string
  warn: string
  info: string
  gold: string
  silver: string
  bronze: string
  eagle: string
  accent: string
  accentText: string
  headerText: string
  headerBg: string
  tabBg: string
  tabActiveBg: string
  cardRadius: number
  shadowOpacity: number
}

export type SkinDefinition = {
  id: SkinId
  name: string
  description: string
  palette: SkinPalette
}

const classic: SkinDefinition = {
  id: 'classic',
  name: 'Classic',
  description: '기존 딥그린 골프장 스타일',
  palette: {
    green: '#1a6b44', greenDark: '#0f4029', greenMid: '#2d8a5a', greenLight: '#eaf5ef',
    bg: '#f0f5f2', card: '#ffffff', text: '#111b14', muted: '#6b7c74', border: '#dde8e2',
    danger: '#c0392b', warn: '#e67e22', info: '#2980b9', gold: '#c9900a', silver: '#8a9ba8', bronze: '#a07048', eagle: '#7c3aed',
    accent: '#1a6b44', accentText: '#ffffff', headerText: '#ffffff', headerBg: '#0f4029', tabBg: '#ffffff', tabActiveBg: '#eaf5ef', cardRadius: 16, shadowOpacity: 0.06,
  },
}

const turf: SkinDefinition = {
  id: 'turf',
  name: 'Turf',
  description: '민트 페이퍼 + 라임 포인트',
  palette: {
    green: '#1f9d57', greenDark: '#15201a', greenMid: '#2f6b46', greenLight: '#e4f3ea',
    bg: '#e9f1ea', card: '#ffffff', text: '#15201a', muted: '#7e8f82', border: '#dce8de',
    danger: '#d2533a', warn: '#db8a2c', info: '#3a78c2', gold: '#c9900a', silver: '#8a9ba8', bronze: '#a07048', eagle: '#7c3aed',
    accent: '#c6ff3a', accentText: '#15201a', headerText: '#ffffff', headerBg: '#15201a', tabBg: '#ffffff', tabActiveBg: '#c6ff3a', cardRadius: 20, shadowOpacity: 0.08,
  },
}

const cuteGolf: SkinDefinition = {
  id: 'cuteGolf',
  name: 'Cute Golf',
  description: '귀여운 골프공 캐릭터 느낌',
  palette: {
    green: '#21a66b', greenDark: '#163c2b', greenMid: '#4aa77a', greenLight: '#e9fff3',
    bg: '#eef8ef', card: '#ffffff', text: '#142019', muted: '#7b8e82', border: '#d8eadc',
    danger: '#e05045', warn: '#f0a02e', info: '#39a7d7', gold: '#f3b742', silver: '#9aaab2', bronze: '#b77d4b', eagle: '#8f5cf6',
    accent: '#a8ff31', accentText: '#142019', headerText: '#ffffff', headerBg: '#183726', tabBg: '#ffffff', tabActiveBg: '#a8ff31', cardRadius: 24, shadowOpacity: 0.1,
  },
}

const premium: SkinDefinition = {
  id: 'premium',
  name: 'Premium',
  description: '블랙 + 골드 프라이빗 클럽 스타일',
  palette: {
    green: '#a67c2d', greenDark: '#101412', greenMid: '#7b6a38', greenLight: '#f6efd9',
    bg: '#f3f0e8', card: '#fffdf8', text: '#171817', muted: '#81786a', border: '#e3dac7',
    danger: '#b5473f', warn: '#c17d22', info: '#345f85', gold: '#bf8d2d', silver: '#8b9291', bronze: '#8b633f', eagle: '#5b4fc7',
    accent: '#d4af37', accentText: '#101412', headerText: '#f9f2d8', headerBg: '#101412', tabBg: '#fffdf8', tabActiveBg: '#f3df9b', cardRadius: 18, shadowOpacity: 0.12,
  },
}

const minimal: SkinDefinition = {
  id: 'minimal',
  name: 'Minimal',
  description: '밝고 단정한 업무용 스타일',
  palette: {
    green: '#23845a', greenDark: '#ffffff', greenMid: '#47665a', greenLight: '#f0f5f2',
    bg: '#f7f8fa', card: '#ffffff', text: '#101418', muted: '#7b838a', border: '#e5e7eb',
    danger: '#d64545', warn: '#d9822b', info: '#2563eb', gold: '#b7791f', silver: '#8a9ba8', bronze: '#a07048', eagle: '#6d5bd0',
    accent: '#101418', accentText: '#ffffff', headerText: '#101418', headerBg: '#ffffff', tabBg: '#ffffff', tabActiveBg: '#101418', cardRadius: 14, shadowOpacity: 0.04,
  },
}

export const SKINS: SkinDefinition[] = [classic, turf, cuteGolf, premium, minimal]
export const DEFAULT_SKIN_ID: SkinId = 'cuteGolf'
const STORAGE_KEY = '@gogopar_skin_id'

type SkinContextValue = {
  skin: SkinDefinition
  skinId: SkinId
  palette: SkinPalette
  skins: SkinDefinition[]
  setSkinId: (id: SkinId) => Promise<void>
  isModern: boolean
}

const SkinContext = createContext<SkinContextValue | null>(null)

function resolveSkin(id?: string | null) {
  return SKINS.find((item) => item.id === id) ?? SKINS.find((item) => item.id === DEFAULT_SKIN_ID)!
}

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skinId, setSkinIdState] = useState<SkinId>(DEFAULT_SKIN_ID)

  useEffect(() => {
    let alive = true
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!alive || !saved) return
      setSkinIdState(resolveSkin(saved).id)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  const value = useMemo<SkinContextValue>(() => {
    const skin = resolveSkin(skinId)
    return {
      skin,
      skinId: skin.id,
      palette: skin.palette,
      skins: SKINS,
      isModern: skin.id !== 'classic',
      setSkinId: async (id: SkinId) => {
        const next = resolveSkin(id).id
        setSkinIdState(next)
        await AsyncStorage.setItem(STORAGE_KEY, next)
      },
    }
  }, [skinId])

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>
}

export function useSkin() {
  const ctx = useContext(SkinContext)
  if (!ctx) throw new Error('useSkin must be used inside SkinProvider')
  return ctx
}
