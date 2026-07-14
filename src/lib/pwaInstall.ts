import { Platform } from 'react-native'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let initialized = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function initializePwaInstallPrompt() {
  if (Platform.OS !== 'web' || initialized || typeof window === 'undefined') return
  initialized = true

  window.addEventListener('beforeinstallprompt', ((event: Event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    emit()
  }) as EventListener)

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    emit()
  })
}

export function subscribePwaInstallPrompt(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function canPromptPwaInstall() {
  return !!deferredPrompt
}

export async function promptPwaInstall() {
  if (!deferredPrompt) return 'unavailable' as const
  const prompt = deferredPrompt
  await prompt.prompt()
  const choice = await prompt.userChoice
  if (choice.outcome === 'accepted') deferredPrompt = null
  emit()
  return choice.outcome
}

export function isRunningStandalone() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches === true || navigatorWithStandalone.standalone === true
}

export function getInstallPlatform() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'native' as const
  const agent = navigator.userAgent.toLowerCase()
  const isIos = /iphone|ipad|ipod/.test(agent)
  const isAndroid = /android/.test(agent)
  if (isIos) return 'ios' as const
  if (isAndroid) return 'android' as const
  return 'desktop' as const
}
