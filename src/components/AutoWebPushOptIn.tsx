import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { C } from '../theme'
import { useClub } from '../lib/ClubContext'
import { isRunningStandalone } from '../lib/pwaInstall'
import { canUseWebPush, getWebPushSubscriptionEnabled, registerWebPushSubscription } from '../lib/webPush'

const DISMISSED_KEY_PREFIX = '@gogopar_web_push_opt_in_dismissed'

function storageKey(clubId: string, userId: string) {
  return `${DISMISSED_KEY_PREFIX}:${clubId}:${userId}`
}

function currentNotificationPermission() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function AutoWebPushOptIn({ session }: { session: Session | null }) {
  const { activeClub, clubsLoaded } = useClub()
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  const userId = session?.user.id
  const clubId = activeClub?.id

  useEffect(() => {
    let active = true

    async function prepare() {
      setVisible(false)
      setMessage('')
      if (!session || !userId || !clubId || !clubsLoaded) return
      if (Platform.OS !== 'web' || !isRunningStandalone() || !canUseWebPush()) return

      const permission = currentNotificationPermission()
      if (permission === 'denied' || permission === 'unsupported') return

      const dismissedAt = await AsyncStorage.getItem(storageKey(clubId, userId))
      if (dismissedAt) return

      if (permission === 'granted') {
        const status = await getWebPushSubscriptionEnabled(clubId, userId)
        if (active && !status.enabled) {
          setMessage(status.message)
          setVisible(true)
        }
        return
      }

      if (active) setVisible(true)
    }

    prepare().catch(() => undefined)
    return () => { active = false }
  }, [clubId, clubsLoaded, session, userId])

  async function closeAndRemember() {
    if (clubId && userId) {
      await AsyncStorage.setItem(storageKey(clubId, userId), new Date().toISOString())
    }
    setVisible(false)
  }

  async function handleSubscribe() {
    if (!clubId || !userId || subscribing) return
    setSubscribing(true)
    setMessage('알림을 켜는 중입니다...')
    const result = await registerWebPushSubscription(clubId, userId)
    if (result.status === 'subscribed') {
      setMessage('이 기기에서 새 공지와 캐디 알림을 받을 수 있습니다.')
      await AsyncStorage.removeItem(storageKey(clubId, userId))
      setTimeout(() => setVisible(false), 900)
    } else {
      setMessage(result.message)
      if (result.status === 'permission_denied' || result.status === 'unsupported' || result.status === 'requires_install') {
        await AsyncStorage.setItem(storageKey(clubId, userId), new Date().toISOString())
      }
    }
    setSubscribing(false)
  }

  return (
    <>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={closeAndRemember}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>{activeClub?.name ?? 'GogoPar'}</Text>
            <Text style={styles.title}>푸시 알림을 켜둘까요?</Text>
            <Text style={styles.body}>
              홈 화면에 설치된 GogoPar에서 새 공지, 조편성, 캐디북, 로또 추첨, 경기 결과 알림을 받을 수 있습니다.
            </Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, subscribing && { opacity: 0.58 }]}
              onPress={handleSubscribe}
              disabled={subscribing}
              activeOpacity={0.84}
            >
              <Text style={styles.primaryText}>{subscribing ? '설정 중' : '알림 켜기'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={closeAndRemember}>
              <Text style={styles.secondaryText}>나중에</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,24,18,0.58)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: 20 },
  eyebrow: { fontSize: 12, lineHeight: 18, color: C.greenDark, fontWeight: '900', marginBottom: 6 },
  title: { fontSize: 22, lineHeight: 29, color: C.text, fontWeight: '900' },
  body: { fontSize: 14, lineHeight: 22, color: C.muted, fontWeight: '700', marginTop: 10 },
  message: { marginTop: 14, borderRadius: 14, backgroundColor: '#EAF5EF', padding: 12, color: C.greenDark, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  primaryButton: { marginTop: 18, minHeight: 50, borderRadius: 16, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13, marginTop: 4 },
  secondaryText: { color: C.muted, fontSize: 13, fontWeight: '800' },
})
