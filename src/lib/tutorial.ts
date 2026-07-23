import AsyncStorage from '@react-native-async-storage/async-storage'

export const TUTORIAL_VERSION = 7
const introListeners = new Set<() => void>()
const replayRequestKey = '@gogopar_tutorial:replay-request'

function storageKey(userId?: string | null) {
  return `@gogopar_tutorial_v${TUTORIAL_VERSION}:intro:${userId || 'guest'}`
}

export async function hasCompletedTutorial(userId?: string | null) {
  return (await AsyncStorage.getItem(storageKey(userId))) === 'hidden'
}

export async function markTutorialCompleted(userId?: string | null) {
  await AsyncStorage.setItem(storageKey(userId), 'hidden')
}

export async function requestTutorialOpen() {
  // 화면 전환 타이밍과 관계없이 다시 보기 요청이 유실되지 않도록 저장한다.
  await AsyncStorage.setItem(replayRequestKey, 'requested')
  introListeners.forEach((listener) => listener())
}

export async function consumeTutorialOpenRequest() {
  const requested = (await AsyncStorage.getItem(replayRequestKey)) === 'requested'
  if (requested) await AsyncStorage.removeItem(replayRequestKey)
  return requested
}

export function subscribeTutorialOpen(listener: () => void) {
  introListeners.add(listener)
  return () => {
    introListeners.delete(listener)
  }
}
