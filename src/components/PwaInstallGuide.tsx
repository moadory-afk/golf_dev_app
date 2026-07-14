import { useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { C } from '../theme'
import {
  canPromptPwaInstall,
  getInstallPlatform,
  initializePwaInstallPrompt,
  isRunningStandalone,
  promptPwaInstall,
  subscribePwaInstallPrompt,
} from '../lib/pwaInstall'

const DISMISSED_KEY = '@gogopar_pwa_install_guide_dismissed'

export type PwaInstallGuideProps = {
  visible: boolean
  onClose: () => void
  allowLater?: boolean
}

export function PwaInstallGuide({ visible, onClose, allowLater = false }: PwaInstallGuideProps) {
  const [, forceUpdate] = useState(0)
  const platform = useMemo(() => getInstallPlatform(), [visible])
  const promptAvailable = canPromptPwaInstall()

  useEffect(() => {
    initializePwaInstallPrompt()
    return subscribePwaInstallPrompt(() => forceUpdate((value) => value + 1))
  }, [])

  async function handlePrimaryAction() {
    if (promptAvailable) {
      const result = await promptPwaInstall()
      if (result === 'accepted') onClose()
      return
    }
    if (Platform.OS !== 'web') onClose()
  }

  async function handleLater() {
    await AsyncStorage.setItem(DISMISSED_KEY, new Date().toISOString())
    onClose()
  }

  const title = isRunningStandalone() ? 'GogoPar가 설치되어 있습니다' : 'GogoPar 홈 화면에 설치하기'

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.appIcon}><Text style={styles.appIconText}>⛳</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>앱스토어 없이 일반 앱처럼 빠르게 실행할 수 있습니다.</Text>
            </View>
          </View>

          <ScrollView style={styles.stepsScroll} contentContainerStyle={styles.stepsContent}>
            {isRunningStandalone() ? (
              <View style={styles.doneBox}>
                <Text style={styles.doneTitle}>설치 완료</Text>
                <Text style={styles.doneText}>현재 홈 화면에 설치된 GogoPar로 실행 중입니다.</Text>
              </View>
            ) : platform === 'ios' ? (
              <>
                <Text style={styles.platformTitle}>🍎 아이폰 · 아이패드 (Safari)</Text>
                <Step no="1" text="현재 페이지를 Safari에서 엽니다." />
                <Step no="2" text="화면 아래의 공유 버튼(□↑)을 누릅니다." />
                <Step no="3" text="메뉴에서 ‘홈 화면에 추가’를 선택합니다." />
                <Step no="4" text="오른쪽 위 ‘추가’를 누르면 설치가 완료됩니다." />
                <Text style={styles.tip}>카카오톡·네이버 앱 안에서 열었다면 먼저 Safari로 열어주세요.</Text>
              </>
            ) : platform === 'android' ? (
              <>
                <Text style={styles.platformTitle}>🤖 안드로이드 (Chrome)</Text>
                {promptAvailable ? (
                  <Text style={styles.readyText}>아래 ‘지금 설치’ 버튼을 누르면 설치 창이 바로 열립니다.</Text>
                ) : (
                  <>
                    <Step no="1" text="Chrome 오른쪽 위 점 3개(⋮)를 누릅니다." />
                    <Step no="2" text="‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택합니다." />
                    <Step no="3" text="설치를 누르면 홈 화면에 아이콘이 생성됩니다." />
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={styles.platformTitle}>💻 PC (Chrome · Edge)</Text>
                {promptAvailable ? (
                  <Text style={styles.readyText}>아래 ‘지금 설치’ 버튼을 누르면 앱 설치 창이 열립니다.</Text>
                ) : (
                  <>
                    <Step no="1" text="주소창 오른쪽의 설치 아이콘을 누릅니다." />
                    <Step no="2" text="아이콘이 없다면 브라우저 메뉴에서 ‘앱 설치’를 선택합니다." />
                  </>
                )}
              </>
            )}
          </ScrollView>

          {!isRunningStandalone() && promptAvailable && (
            <TouchableOpacity style={styles.primaryButton} onPress={handlePrimaryAction} activeOpacity={0.84}>
              <Text style={styles.primaryText}>지금 설치</Text>
            </TouchableOpacity>
          )}
          <View style={styles.footerRow}>
            {allowLater && !isRunningStandalone() ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={handleLater}>
                <Text style={styles.secondaryText}>나중에</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryText}>{isRunningStandalone() ? '확인' : '닫기'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function Step({ no, text }: { no: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{no}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  )
}

export function FirstVisitInstallGuide() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    initializePwaInstallPrompt()
    if (Platform.OS !== 'web' || isRunningStandalone()) return
    let active = true
    AsyncStorage.getItem(DISMISSED_KEY).then((value) => {
      if (active && !value) setVisible(true)
    })
    return () => { active = false }
  }, [])

  async function closeAndRemember() {
    await AsyncStorage.setItem(DISMISSED_KEY, new Date().toISOString())
    setVisible(false)
  }

  return <PwaInstallGuide visible={visible} onClose={closeAndRemember} allowLater />
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,24,18,0.58)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  card: { width: '100%', maxWidth: 440, maxHeight: '86%', backgroundColor: '#fff', borderRadius: 24, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  appIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.greenDark, alignItems: 'center', justifyContent: 'center' },
  appIconText: { fontSize: 27 },
  title: { fontSize: 19, fontWeight: '900', color: C.text },
  subtitle: { fontSize: 12, lineHeight: 18, color: C.muted, marginTop: 4 },
  stepsScroll: { marginTop: 16 },
  stepsContent: { paddingBottom: 4 },
  platformTitle: { fontSize: 15, fontWeight: '900', color: C.text, marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 11 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EAF5EF', alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: C.greenDark, fontSize: 12, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 20, color: C.text },
  tip: { marginTop: 4, backgroundColor: '#FFF7E4', borderRadius: 12, padding: 12, color: '#795A16', fontSize: 12, lineHeight: 18 },
  readyText: { backgroundColor: '#EAF5EF', borderRadius: 14, padding: 14, color: C.greenDark, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  doneBox: { backgroundColor: '#EAF5EF', borderRadius: 16, padding: 16 },
  doneTitle: { color: C.greenDark, fontSize: 16, fontWeight: '900' },
  doneText: { color: C.text, fontSize: 13, lineHeight: 20, marginTop: 6 },
  primaryButton: { marginTop: 14, backgroundColor: C.greenDark, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  secondaryButton: { paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { color: C.muted, fontSize: 13, fontWeight: '800' },
})
