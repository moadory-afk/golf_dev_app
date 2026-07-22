import AsyncStorage from '@react-native-async-storage/async-storage'

export const TUTORIAL_VERSION = 2
const introListeners = new Set<() => void>()

function storageKey(userId?: string | null) {
  return `@gogopar_tutorial_v${TUTORIAL_VERSION}:intro:${userId || 'guest'}`
}

export async function hasCompletedTutorial(userId?: string | null) {
  return (await AsyncStorage.getItem(storageKey(userId))) === 'completed'
}

export async function markTutorialCompleted(userId?: string | null) {
  await AsyncStorage.setItem(storageKey(userId), 'completed')
}

export function requestTutorialOpen() {
  introListeners.forEach((listener) => listener())
}

export function subscribeTutorialOpen(listener: () => void) {
  introListeners.add(listener)
  return () => {
    introListeners.delete(listener)
  }
}
