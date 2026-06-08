import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput,
  ActivityIndicator, Platform, Share, Modal, Switch,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { updateClubSettings, getClubSettlement, saveClubSettlement } from '../lib/store'
import { useClub } from '../lib/ClubContext'
import { C } from '../theme'
import type { User } from '@supabase/supabase-js'
import type { RootStackParamList } from '../navigation/types'

const APP_URL = 'https://golf-seven-psi.vercel.app'
const HANDICAP_BASIS_KEY = '@gogopar_handicap_basis'
type Nav = NativeStackNavigationProp<RootStackParamList>

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const { activeClub, refreshClubs } = useClub()
  const [user, setUser] = useState<User | null>(null)

  // 클럽 관리
  const [editingClub, setEditingClub] = useState(false)
  const [editName, setEditName] = useState(activeClub?.name ?? '')
  const [editSub, setEditSub] = useState(activeClub?.subtitle ?? '')
  const [saving, setSaving] = useState(false)

  // 기타 설정
  const [handicapBasis, setHandicapBasis] = useState<3 | 5 | 10>(5)
  const [showHandicapDrop, setShowHandicapDrop] = useState(false)
  const [strokeFee, setStrokeFee] = useState('3000')
  const [birdieBonus, setBirdieBonus] = useState<5000 | 10000>(5000)
  const [baepanOn, setBaepanOn] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // 공유 모달
  const [shareModal, setShareModal] = useState<{ message: string; link: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    AsyncStorage.getItem(HANDICAP_BASIS_KEY).then(v => {
      if (v === '3' || v === '5' || v === '10') setHandicapBasis(Number(v) as 3 | 5 | 10)
    })
  }, [])

  useEffect(() => {
    if (!activeClub) return
    setEditName(activeClub.name)
    setEditSub(activeClub.subtitle)
    getClubSettlement(activeClub.id).then(config => {
      if (!config) return
      setStrokeFee(String(config.strokeFee))
      setBirdieBonus(config.birdieBonus)
      if (config.baepanConditions) setBaepanOn(config.baepanConditions.strokeOverpar)
    })
  }, [activeClub?.id])

  async function handleSaveClubName() {
    if (!activeClub || !editName.trim()) return
    setSaving(true)
    try {
      await updateClubSettings(activeClub.id, editName.trim(), editSub.trim())
      await refreshClubs()
      setEditingClub(false)
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : String(e))
    } finally { setSaving(false) }
  }

  async function handleSaveSettings() {
    if (!activeClub) return
    setSettingsSaving(true)
    try {
      await AsyncStorage.setItem(HANDICAP_BASIS_KEY, String(handicapBasis))
      const fee = parseInt(strokeFee) || 3000
      await saveClubSettlement(activeClub.id, {
        participants: [],
        strokeFee: fee,
        birdieBonus,
        baepanConditions: { strokeOverpar: baepanOn, tie: baepanOn, birdie: false },
      })
      Alert.alert('저장 완료', '설정이 저장되었습니다.')
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : String(e))
    } finally { setSettingsSaving(false) }
  }

  function handleShareLink() {
    if (!activeClub) return
    const link = `${APP_URL}/?join=${activeClub.inviteCode}`
    const senderName = user?.user_metadata?.name ?? '관리자'
    const message = `[${senderName}]님이 [${activeClub.name}] 골프 클럽에 초대합니다! 🏌️\n\n아래 링크를 클릭하여 참여하세요 👇\n${link}`
    if (Platform.OS !== 'web') {
      Share.share({ title: `${activeClub.name} 골프 클럽 초대`, message: `${message}\n${link}` })
    } else {
      setShareModal({ message, link })
    }
  }

  async function handleLogout() {
    const doLogout = async () => {
      const { error } = await supabase.auth.signOut()
      if (error) Alert.alert('오류', '로그아웃에 실패했습니다.')
    }
    if (Platform.OS === 'web') {
      if (confirm('로그아웃 하시겠습니까?')) await doLogout()
    } else {
      Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: doLogout },
      ])
    }
  }

  const isAdmin = activeClub?.role === 'admin'

  return (
    <View style={s.container}>

      {/* 공유 모달 */}
      {shareModal && (
        <Modal transparent animationType="fade" onRequestClose={() => setShareModal(null)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShareModal(null)}>
            <TouchableOpacity style={s.shareModalCard} activeOpacity={1} onPress={() => {}}>
              <Text style={s.shareModalTitle}>📨 초대 메시지</Text>
              <Text style={s.shareModalDesc}>아래 메시지를 복사해서 카카오톡, 문자 등으로 보내세요</Text>
              <View style={s.shareMessageBox}>
                <Text style={s.shareMessageText} selectable>{shareModal.message}</Text>
              </View>
              <TouchableOpacity style={s.copyMsgBtn} onPress={async () => {
                await Clipboard.setStringAsync(shareModal.message)
                Alert.alert('복사 완료! 카카오톡이나 문자에 붙여넣기 하세요.')
              }}>
                <Text style={s.copyMsgBtnText}>📋 메시지 전체 복사</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.copyLinkOnlyBtn} onPress={async () => {
                await Clipboard.setStringAsync(shareModal.link)
                Alert.alert('링크 복사 완료!')
              }}>
                <Text style={s.copyLinkOnlyBtnText}>🔗 링크만 복사</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.shareModalClose} onPress={() => setShareModal(null)}>
                <Text style={s.shareModalCloseText}>닫기</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* ── 클럽 관리 ── */}
        <Text style={s.sectionLabel}>클럽 관리</Text>
        <View style={s.menuCard}>
          {isAdmin && (
            <>
              <TouchableOpacity style={s.menuRow} onPress={() => setEditingClub(v => !v)}>
                <Text style={s.menuRowIcon}>✏️</Text>
                <Text style={s.menuRowText}>클럽명 변경</Text>
                <Text style={s.menuRowArrow}>{editingClub ? '∧' : '›'}</Text>
              </TouchableOpacity>
              {editingClub && (
                <View style={s.inlineForm}>
                  <TextInput style={s.editInput} value={editName} onChangeText={setEditName} placeholder="클럽명" maxLength={20} />
                  <TextInput style={s.editInput} value={editSub} onChangeText={setEditSub} placeholder="부제 (선택)" maxLength={30} />
                  <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSaveClubName} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>저장</Text>}
                  </TouchableOpacity>
                </View>
              )}
              <View style={s.menuDivider} />
            </>
          )}
          <TouchableOpacity
            style={s.menuRow}
            onPress={() => activeClub && nav.navigate('Members', { clubId: activeClub.id })}
          >
            <Text style={s.menuRowIcon}>👥</Text>
            <Text style={s.menuRowText}>멤버 목록</Text>
            <Text style={s.menuRowArrow}>›</Text>
          </TouchableOpacity>
          <View style={s.menuDivider} />
          <TouchableOpacity style={s.menuRow} onPress={handleShareLink}>
            <Text style={s.menuRowIcon}>🔗</Text>
            <Text style={s.menuRowText}>멤버 초대</Text>
            <Text style={s.menuRowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── 기타 ── */}
        <Text style={s.sectionLabel}>기타</Text>
        <View style={[s.menuCard, { zIndex: 10 }]}>

          {/* 핸디 기준 경기 */}
          <View style={[s.menuRow, { zIndex: 10 }]}>
            <Text style={s.menuRowIcon}>📊</Text>
            <Text style={s.menuRowText}>핸디 기준 경기</Text>
            <View>
              <TouchableOpacity style={s.dropdownTrigger} onPress={() => setShowHandicapDrop(v => !v)}>
                <Text style={s.dropdownTriggerText}>{handicapBasis}경기 ▾</Text>
              </TouchableOpacity>
              {showHandicapDrop && (
                <View style={s.dropdownMenu}>
                  {([3, 5, 10] as const).map(n => (
                    <TouchableOpacity
                      key={n}
                      style={s.dropdownItem}
                      onPress={() => { setHandicapBasis(n); setShowHandicapDrop(false) }}
                    >
                      <Text style={[s.dropdownItemText, handicapBasis === n && s.dropdownItemActive]}>
                        {n}경기{handicapBasis === n ? ' ✓' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
          <View style={s.menuDivider} />

          {/* 타당 금액 */}
          <View style={s.menuRow}>
            <Text style={s.menuRowIcon}>💰</Text>
            <Text style={s.menuRowText}>타당 금액</Text>
            <View style={s.inputRow}>
              <TextInput
                style={s.settingInput}
                value={strokeFee}
                onChangeText={setStrokeFee}
                keyboardType="numeric"
                maxLength={6}
              />
              <Text style={s.inputUnit}>원</Text>
            </View>
          </View>
          <View style={s.menuDivider} />

          {/* 버디 보너스 */}
          <View style={s.menuRow}>
            <Text style={s.menuRowIcon}>🐦</Text>
            <Text style={s.menuRowText}>버디 보너스</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {([5000, 10000] as const).map(v => (
                <TouchableOpacity
                  key={v}
                  style={[s.optionBtn, birdieBonus === v && s.optionBtnActive]}
                  onPress={() => setBirdieBonus(v)}
                >
                  <Text style={[s.optionBtnText, birdieBonus === v && s.optionBtnTextActive]}>
                    {v.toLocaleString()}원
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.menuDivider} />

          {/* 배판 조건 */}
          <View style={s.menuRow}>
            <Text style={s.menuRowIcon}>⚡</Text>
            <Text style={s.menuRowText}>배판 조건</Text>
            <Switch
              value={baepanOn}
              onValueChange={setBaepanOn}
              trackColor={{ false: C.border, true: C.green }}
              thumbColor="#fff"
            />
          </View>

          {/* 저장 버튼 */}
          <TouchableOpacity
            style={[s.saveBtn, { margin: 12, marginTop: 8 }, settingsSaving && { opacity: 0.6 }]}
            onPress={handleSaveSettings}
            disabled={settingsSaving}
          >
            {settingsSaving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.saveBtnText}>설정 저장</Text>}
          </TouchableOpacity>
        </View>

        {/* ── 앱 정보 ── */}
        <Text style={s.sectionLabel}>앱 정보</Text>
        <View style={s.menuCard}>
          <View style={s.menuRow}>
            <Text style={s.menuRowIcon}>📱</Text>
            <Text style={s.menuRowText}>버전</Text>
            <Text style={{ fontSize: 13, color: C.muted }}>v1.0</Text>
          </View>
          <View style={s.menuDivider} />
          <TouchableOpacity style={s.menuRow} onPress={handleLogout}>
            <Text style={s.menuRowIcon}>🚪</Text>
            <Text style={[s.menuRowText, { color: C.danger }]}>로그아웃</Text>
            <Text style={s.menuRowArrow}>›</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f6' },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.muted, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, letterSpacing: 0.5 },

  menuCard: { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 14, marginBottom: 6, overflow: 'visible', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 12 },
  menuRowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  menuRowText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  menuRowArrow: { fontSize: 16, color: C.muted },
  menuDivider: { height: 1, backgroundColor: C.border, marginLeft: 54 },

  inlineForm: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: C.border },
  editInput: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text, marginBottom: 8, backgroundColor: '#fff', marginTop: 8 },
  saveBtn: { backgroundColor: C.green, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // 드롭다운
  dropdownTrigger: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.green, backgroundColor: C.green },
  dropdownTriggerText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  dropdownMenu: { position: 'absolute', top: 34, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 10, zIndex: 100, minWidth: 90 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 16 },
  dropdownItemText: { fontSize: 13, color: C.text },
  dropdownItemActive: { color: C.green, fontWeight: '700' },

  // 기타 설정 입력
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingInput: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: C.text, textAlign: 'right', minWidth: 80, backgroundColor: '#fff' },
  inputUnit: { fontSize: 13, color: C.muted, fontWeight: '500' },
  optionBtn: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: C.border },
  optionBtnActive: { backgroundColor: C.green, borderColor: C.green },
  optionBtnText: { fontSize: 12, color: C.muted, fontWeight: '500' },
  optionBtnTextActive: { color: '#fff', fontWeight: '700' },

  // 공유 모달
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  shareModalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 380 },
  shareModalTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 6 },
  shareModalDesc: { fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 18 },
  shareMessageBox: { backgroundColor: '#f2f4f6', borderRadius: 12, padding: 14, marginBottom: 14 },
  shareMessageText: { fontSize: 14, color: C.text, lineHeight: 22 },
  copyMsgBtn: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 13, alignItems: 'center', marginBottom: 8 },
  copyMsgBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  copyLinkOnlyBtn: { backgroundColor: C.greenLight, borderRadius: 50, paddingVertical: 11, alignItems: 'center', marginBottom: 8 },
  copyLinkOnlyBtnText: { color: C.green, fontWeight: '600', fontSize: 14 },
  shareModalClose: { paddingVertical: 8, alignItems: 'center' },
  shareModalCloseText: { color: C.muted, fontSize: 14 },
})
