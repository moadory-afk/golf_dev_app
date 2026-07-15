import AsyncStorage from '@react-native-async-storage/async-storage'

export const TUTORIAL_VERSION = 2
const introListeners = new Set<() => void>()
const homeListeners = new Set<() => void>()
const profileListeners = new Set<() => void>()

type TutorialPart = 'intro' | 'home' | 'profile'

function storageKey(part: TutorialPart, userId?: string | null) {
  return `@gogopar_tutorial_v${TUTORIAL_VERSION}:${part}:${userId || 'guest'}`
}

export async function hasCompletedTutorial(userId?: string | null) {
  return (await AsyncStorage.getItem(storageKey('intro', userId))) === 'completed'
}
export async function markTutorialCompleted(userId?: string | null) {
  await AsyncStorage.setItem(storageKey('intro', userId), 'completed')
}
export async function hasCompletedHomeTutorial(userId?: string | null) {
  return (await AsyncStorage.getItem(storageKey('home', userId))) === 'completed'
}
export async function markHomeTutorialCompleted(userId?: string | null) {
  await AsyncStorage.setItem(storageKey('home', userId), 'completed')
}
export async function hasCompletedProfileTutorial(userId?: string | null) {
  return (await AsyncStorage.getItem(storageKey('profile', userId))) === 'completed'
}
export async function markProfileTutorialCompleted(userId?: string | null) {
  await AsyncStorage.setItem(storageKey('profile', userId), 'completed')
}

export function requestTutorialOpen() { introListeners.forEach((listener) => listener()) }
export function subscribeTutorialOpen(listener: () => void) { introListeners.add(listener); return () => introListeners.delete(listener) }
export function requestHomeTutorialOpen() { homeListeners.forEach((listener) => listener()) }
export function subscribeHomeTutorialOpen(listener: () => void) { homeListeners.add(listener); return () => homeListeners.delete(listener) }
export function requestProfileTutorialOpen() { profileListeners.forEach((listener) => listener()) }
export function subscribeProfileTutorialOpen(listener: () => void) { profileListeners.add(listener); return () => profileListeners.delete(listener) }
