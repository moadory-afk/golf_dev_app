import AsyncStorage from '@react-native-async-storage/async-storage'

export const TUTORIAL_VERSION = 1
const listeners = new Set<() => void>()

export function tutorialStorageKey(userId?: string | null) {
  return `@gogopar_tutorial_v${TUTORIAL_VERSION}:${userId || 'guest'}`
}

export async function hasCompletedTutorial(userId?: string | null) {
  return (await AsyncStorage.getItem(tutorialStorageKey(userId))) === 'completed'
}

export async function markTutorialCompleted(userId?: string | null) {
  await AsyncStorage.setItem(tutorialStorageKey(userId), 'completed')
}

export function requestTutorialOpen() {
  listeners.forEach((listener) => listener())
}

export function subscribeTutorialOpen(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
