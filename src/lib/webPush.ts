import { Platform } from 'react-native'
import { isRunningStandalone } from './pwaInstall'
import {
  getNotificationSubscriptionEnabled,
  saveNotificationSubscription,
  setNotificationSubscriptionEnabled,
} from './store'

export type WebPushRegistrationResult =
  | { status: 'subscribed' }
  | { status: 'unsupported'; message: string }
  | { status: 'requires_install'; message: string }
  | { status: 'permission_denied'; message: string }
  | { status: 'config_missing'; message: string }
  | { status: 'error'; message: string }

function getVapidPublicKey() {
  return String(process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s/g, '')
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  if (raw.length !== 65 || raw.charCodeAt(0) !== 4) {
    throw new Error('웹 푸시 공개키 형식이 올바르지 않습니다. VAPID Public Key를 다시 확인해주세요.')
  }
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

function isIosWeb() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isLocalOrHttps() {
  if (typeof window === 'undefined') return false
  return window.location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

export function canUseWebPush() {
  return Platform.OS === 'web'
    && typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export async function registerWebPushSubscription(
  clubId: string,
  userId: string,
): Promise<WebPushRegistrationResult> {
  try {
    if (!isLocalOrHttps()) {
      return { status: 'unsupported', message: '웹 푸시는 HTTPS 주소에서만 사용할 수 있습니다.' }
    }
    if (isIosWeb() && !isRunningStandalone()) {
      return { status: 'requires_install', message: '아이폰은 홈 화면에 설치한 GogoPar에서 알림을 켤 수 있습니다.' }
    }
    if (!canUseWebPush()) {
      return { status: 'unsupported', message: '이 브라우저는 웹 푸시 알림을 지원하지 않습니다. Safari, Chrome 또는 홈 화면에 설치한 GogoPar에서 다시 시도해주세요.' }
    }

    const vapidPublicKey = getVapidPublicKey()
    if (!vapidPublicKey) {
      return { status: 'config_missing', message: '웹 푸시 공개키가 아직 설정되지 않았습니다.' }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { status: 'permission_denied', message: '브라우저 알림 권한이 허용되지 않았습니다.' }
    }

    const registration = await navigator.serviceWorker.register('/sw.js')
    const readyRegistration = await navigator.serviceWorker.ready
    const existing = await readyRegistration.pushManager.getSubscription()
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
    const serialized = subscription.toJSON()

    await saveNotificationSubscription({
      userId,
      clubId,
      channel: 'web',
      endpoint: subscription.endpoint,
      p256dh: serialized.keys?.p256dh ?? null,
      auth: serialized.keys?.auth ?? null,
      platform: isIosWeb() ? 'ios-web' : 'web',
      userAgent: navigator.userAgent,
    })

    return { status: 'subscribed' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

async function getCurrentSubscriptionEndpoint() {
  if (!canUseWebPush()) return null
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription?.endpoint ?? null
}

export async function getWebPushSubscriptionEnabled(clubId: string, userId: string) {
  try {
    if (!isLocalOrHttps()) {
      return { enabled: false, message: '웹 푸시는 HTTPS 주소에서만 사용할 수 있습니다.' }
    }
    if (isIosWeb() && !isRunningStandalone()) {
      return { enabled: false, message: '아이폰은 홈 화면에 설치한 GogoPar에서 알림을 켤 수 있습니다.' }
    }
    if (!canUseWebPush()) {
      return { enabled: false, message: '이 브라우저는 웹 푸시 알림을 지원하지 않습니다.' }
    }
    if (Notification.permission === 'denied') {
      return { enabled: false, message: '브라우저 알림 권한이 차단되어 있습니다.' }
    }
    if (Notification.permission !== 'granted') {
      return { enabled: false, message: '알림 권한이 아직 허용되지 않았습니다.' }
    }
    const endpoint = await getCurrentSubscriptionEndpoint()
    if (!endpoint) return { enabled: false, message: '이 기기의 알림 구독이 아직 등록되지 않았습니다.' }
    const enabled = await getNotificationSubscriptionEnabled(clubId, userId, endpoint)
    return { enabled, message: enabled ? '이 클럽의 알림을 받고 있습니다.' : '이 클럽의 알림이 꺼져 있습니다.' }
  } catch (error) {
    return { enabled: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export async function disableWebPushSubscriptionForClub(clubId: string, userId: string) {
  try {
    const endpoint = await getCurrentSubscriptionEndpoint()
    if (!endpoint) return { status: 'subscribed' as const, message: '이 기기의 알림 구독이 없습니다.' }
    await setNotificationSubscriptionEnabled(clubId, userId, endpoint, false)
    return { status: 'subscribed' as const, message: '이 클럽의 알림을 껐습니다.' }
  } catch (error) {
    return { status: 'error' as const, message: error instanceof Error ? error.message : String(error) }
  }
}
