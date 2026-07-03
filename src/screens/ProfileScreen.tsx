import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import type { User } from '@supabase/supabase-js'
import { EmojiIcon } from '../components/EmojiIcon'
import { ImageCropModal, type ImageCropRect } from '../components/ImageCropModal'
import { ensureProfile } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useUserProfile } from '../lib/UserProfileContext'
import { C } from '../theme'

const PROFILE_EMOJIS = [
  '🏌️', '⛳', '🏆', '👑', '💎', '🔥', '⚡', '🌟', '😎', '🤩',
  '🦁', '🐯', '🦅', '🦊', '🐻', '🚀', '🎯', '💪', '🌈', '🌊',
  '🎸', '🎨', '🍀', '🌺', '🏖️', '⛰️', '🌙', '☀️', '❄️', '🔮',
]

function EmojiPicker({
  emojis,
  selected,
  onSelect,
  onClose,
}: {
  emojis: string[]
  selected: string
  onSelect: (e: string) => void
  onClose: () => void
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={ep.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={ep.card} activeOpacity={1} onPress={() => {}}>
          <View style={ep.header}>
            <Text style={ep.title}>아이콘 선택</Text>
            <TouchableOpacity onPress={onClose} style={ep.closeBtn}>
              <Text style={ep.closeBtnText}>완료</Text>
            </TouchableOpacity>
          </View>
          <View style={ep.grid}>
            {emojis.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[ep.emojiBtn, selected === emoji && ep.emojiBtnActive]}
                onPress={() => onSelect(emoji)}
              >
                <Text style={ep.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

export default function ProfileScreen() {
  const { refreshProfile } = useUserProfile()
  const [user, setUser] = useState<User | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [editNameVal, setEditNameVal] = useState('')
  const [profileName, setProfileName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [showAvatarOptions, setShowAvatarOptions] = useState(false)
  const [showProfileIconPicker, setShowProfileIconPicker] = useState(false)
  const [profileIcon, setProfileIcon] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [pendingPhotoCrop, setPendingPhotoCrop] = useState<{ uri: string; width: number; height: number } | null>(null)
  const [showPwModal, setShowPwModal] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.auth.getUser().then(async ({ data }) => {
      if (!alive) return
      const authUser = data.user
      setUser(authUser)
      setProfileIcon(authUser?.user_metadata?.icon ?? '')
      setAvatarUrl(authUser?.user_metadata?.avatarUrl ?? '')

      const metadataName = authUser?.user_metadata?.name ?? ''
      let fallbackName = ''
      if (authUser && !metadataName) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', authUser.id)
          .maybeSingle()
        fallbackName = profile?.name ?? ''
      }
      const displayName = metadataName || fallbackName
      if (!alive) return
      setProfileName(displayName)
      setEditNameVal(displayName)
    })
    return () => {
      alive = false
    }
  }, [])

  const userName = profileName || user?.user_metadata?.name || user?.email || ''
  const userInitial = userName.slice(0, 1) || '?'

  async function handlePickPhoto(source: 'camera' | 'gallery' = 'gallery') {
    setShowAvatarOptions(false)
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('권한 필요', source === 'camera' ? '카메라 접근 권한이 필요합니다.' : '사진 접근 권한이 필요합니다.')
      return
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setPendingPhotoCrop({
      uri: asset.uri,
      width: asset.width || 1000,
      height: asset.height || 1000,
    })
  }

  async function handleSaveCroppedPhoto(crop: ImageCropRect) {
    if (!pendingPhotoCrop) return
    setPendingPhotoCrop(null)
    setUploadingPhoto(true)
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        pendingPhotoCrop.uri,
        [{ crop }, { resize: { width: 100, height: 100 } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      )
      const dataUri = `data:image/jpeg;base64,${compressed.base64}`
      if (dataUri.length > 20000) {
        Alert.alert('사진이 너무 큽니다', '더 작은 사진을 선택해주세요.')
        return
      }
      const { error } = await supabase.auth.updateUser({
        data: { ...user?.user_metadata, avatarUrl: dataUri, icon: '' },
      })
      if (error) throw error
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
      setAvatarUrl(dataUri)
      setProfileIcon('')
      await refreshProfile()
    } catch {
      Alert.alert('오류', '사진 업로드에 실패했습니다.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSelectProfileIcon(emoji: string) {
    setProfileIcon(emoji)
    setShowProfileIconPicker(false)
    const { error } = await supabase.auth.updateUser({
      data: { ...user?.user_metadata, icon: emoji, avatarUrl: '' },
    })
    if (error) {
      Alert.alert('오류', '아이콘 저장에 실패했습니다.')
      return
    }
    setAvatarUrl('')
    await refreshProfile()
  }

  async function handleClearAvatar() {
    setShowAvatarOptions(false)
    const { error } = await supabase.auth.updateUser({
      data: { ...user?.user_metadata, avatarUrl: '', icon: '' },
    })
    if (error) {
      Alert.alert('오류', '프로필 이미지 초기화에 실패했습니다.')
      return
    }
    setAvatarUrl('')
    setProfileIcon('')
    await refreshProfile()
  }

  async function handleSaveName() {
    if (!editNameVal.trim() || !user) return
    setSavingName(true)
    try {
      const name = editNameVal.trim()
      const { error } = await supabase.auth.updateUser({ data: { ...user.user_metadata, name } })
      if (error) throw error
      await ensureProfile(user.id, name)
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
      setProfileName(name)
      setEditingName(false)
      await refreshProfile()
    } catch {
      Alert.alert('오류', '이름 변경에 실패했습니다.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleChangePassword() {
    if (newPw.length < 6) {
      Alert.alert('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (newPw !== confirmPw) {
      Alert.alert('비밀번호가 일치하지 않습니다.')
      return
    }
    setSavingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      setShowPwModal(false)
      setNewPw('')
      setConfirmPw('')
      Alert.alert('비밀번호가 변경되었습니다.')
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : String(e))
    } finally {
      setSavingPw(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut({ scope: 'local' })
    if (Platform.OS === 'web') window.location.href = '/'
  }

  return (
    <View style={p.screen}>
      {pendingPhotoCrop && (
        <ImageCropModal
          uri={pendingPhotoCrop.uri}
          width={pendingPhotoCrop.width}
          height={pendingPhotoCrop.height}
          aspect={[1, 1]}
          title="프로필 사진 자르기"
          onCancel={() => setPendingPhotoCrop(null)}
          onConfirm={handleSaveCroppedPhoto}
        />
      )}
      {showAvatarOptions && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowAvatarOptions(false)}>
          <TouchableOpacity style={p.overlay} activeOpacity={1} onPress={() => setShowAvatarOptions(false)}>
            <TouchableOpacity style={p.avatarOptionsCard} activeOpacity={1} onPress={() => {}}>
              <Text style={p.avatarOptionsTitle}>프로필 이미지 변경</Text>
              <TouchableOpacity style={p.avatarOption} onPress={() => handlePickPhoto('camera')}>
                <Text style={p.avatarOptionIcon}>📷</Text>
                <View>
                  <Text style={p.avatarOptionText}>카메라로 촬영</Text>
                  <Text style={p.avatarOptionSub}>1:1 비율로 자동 크롭됩니다</Text>
                </View>
              </TouchableOpacity>
              <View style={p.menuDivider} />
              <TouchableOpacity style={p.avatarOption} onPress={() => handlePickPhoto('gallery')}>
                <Text style={p.avatarOptionIcon}>🖼️</Text>
                <View>
                  <Text style={p.avatarOptionText}>갤러리에서 사진 선택</Text>
                  <Text style={p.avatarOptionSub}>1:1 비율로 자동 크롭됩니다</Text>
                </View>
              </TouchableOpacity>
              <View style={p.menuDivider} />
              <TouchableOpacity style={p.avatarOption} onPress={() => { setShowAvatarOptions(false); setShowProfileIconPicker(true) }}>
                <Text style={p.avatarOptionIcon}>😊</Text>
                <View>
                  <Text style={p.avatarOptionText}>이모지로 선택</Text>
                  <Text style={p.avatarOptionSub}>간단한 아이콘으로 표시합니다</Text>
                </View>
              </TouchableOpacity>
              {(avatarUrl || profileIcon) && (
                <>
                  <View style={p.menuDivider} />
                  <TouchableOpacity style={p.avatarOption} onPress={handleClearAvatar}>
                    <Text style={p.avatarOptionIcon}>🗑️</Text>
                    <Text style={[p.avatarOptionText, { color: C.danger }]}>기본 이미지로 초기화</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={p.cancelButton} onPress={() => setShowAvatarOptions(false)}>
                <Text style={p.cancelButtonText}>취소</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {showProfileIconPicker && (
        <EmojiPicker
          emojis={PROFILE_EMOJIS}
          selected={profileIcon}
          onSelect={handleSelectProfileIcon}
          onClose={() => setShowProfileIconPicker(false)}
        />
      )}

      {showPwModal && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowPwModal(false)}>
          <TouchableOpacity style={p.overlay} activeOpacity={1} onPress={() => setShowPwModal(false)}>
            <TouchableOpacity style={p.modalCard} activeOpacity={1} onPress={() => {}}>
              <View style={p.modalHeader}>
                <Text style={p.modalTitle}>비밀번호 변경</Text>
                <TouchableOpacity onPress={() => setShowPwModal(false)}>
                  <Text style={p.modalClose}>닫기</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={p.modalInput}
                value={newPw}
                onChangeText={setNewPw}
                placeholder="새 비밀번호 (6자 이상)"
                secureTextEntry
                placeholderTextColor={C.muted}
              />
              <TextInput
                style={p.modalInput}
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder="새 비밀번호 확인"
                secureTextEntry
                placeholderTextColor={C.muted}
              />
              <TouchableOpacity
                style={[p.modalBtn, savingPw && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={savingPw}
              >
                {savingPw ? <ActivityIndicator color="#fff" size="small" /> : <Text style={p.modalBtnText}>변경하기</Text>}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <ScrollView contentContainerStyle={p.content}>
        <View style={p.profileSection}>
          <TouchableOpacity onPress={() => setShowAvatarOptions(true)} style={p.avatarWrap}>
            <View style={p.avatar}>
              {uploadingPhoto ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={p.avatarImage} />
              ) : profileIcon ? (
                <Text style={p.avatarEmoji}>{profileIcon}</Text>
              ) : (
                <Text style={p.avatarInitial}>{userInitial}</Text>
              )}
            </View>
            <View style={p.avatarEditBadge}>
              <EmojiIcon char="✏️" size={11} color={C.text} />
            </View>
          </TouchableOpacity>

          <View style={p.nameArea}>
            {editingName ? (
              <>
                <TextInput
                  style={p.nameInput}
                  value={editNameVal}
                  onChangeText={setEditNameVal}
                  autoFocus
                  maxLength={20}
                  placeholder="닉네임"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                />
                <View style={p.nameActions}>
                  <TouchableOpacity
                    style={[p.nameSaveBtn, savingName && { opacity: 0.6 }]}
                    onPress={handleSaveName}
                    disabled={savingName}
                  >
                    {savingName ? <ActivityIndicator color="#fff" size="small" /> : <Text style={p.nameSaveBtnText}>저장</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingName(false)}>
                    <Text style={p.nameCancelText}>취소</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={p.profileName}>{userName || '닉네임 없음'}</Text>
                <TouchableOpacity onPress={() => { setEditNameVal(userName); setEditingName(true) }}>
                  <Text style={p.profileEditHint}>닉네임 수정</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <Text style={p.sectionLabel}>계정</Text>
        <View style={p.menuCard}>
          <TouchableOpacity style={p.menuRow} onPress={() => setShowPwModal(true)}>
            <Text style={p.menuIcon}>🔑</Text>
            <Text style={p.menuText}>비밀번호 변경</Text>
            <Text style={p.menuArrow}>›</Text>
          </TouchableOpacity>
          <View style={p.menuDivider} />
          <TouchableOpacity style={p.menuRow} onPress={handleLogout}>
            <View style={[p.menuIcon, p.centerIcon]}>
              <EmojiIcon char="🚪" size={17} color={C.danger} />
            </View>
            <Text style={[p.menuText, { color: C.danger }]}>로그아웃</Text>
            <Text style={p.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={p.version}>GogoPar v1.0</Text>
      </ScrollView>
    </View>
  )
}

const p = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f4f6' },
  content: { paddingBottom: 40 },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: C.greenDark,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatarEmoji: { fontSize: 30 },
  avatarInitial: { fontSize: 26, fontWeight: '900', color: '#fff' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.greenDark,
  },
  nameArea: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileEditHint: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  nameInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  nameActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  nameSaveBtn: {
    backgroundColor: C.gold,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  nameSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  nameCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
  },
  menuIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  centerIcon: { alignItems: 'center' },
  menuText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  menuArrow: { fontSize: 16, color: C.muted },
  menuDivider: { height: 1, backgroundColor: C.border, marginLeft: 54 },
  version: { textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 24, marginBottom: 8 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avatarOptionsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    width: '100%',
    maxWidth: 380,
  },
  avatarOptionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.muted,
    textAlign: 'center',
    paddingVertical: 14,
    letterSpacing: 0.3,
  },
  avatarOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatarOptionIcon: { fontSize: 26, width: 36, textAlign: 'center' },
  avatarOptionText: { fontSize: 15, fontWeight: '600', color: C.text },
  avatarOptionSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  cancelButton: { paddingVertical: 14, alignItems: 'center' },
  cancelButtonText: { color: C.muted, fontSize: 14 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 380 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  modalClose: { color: C.muted, fontSize: 13 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  modalBtn: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})

const ep = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: C.text },
  closeBtn: { backgroundColor: C.green, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emojiBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiBtnActive: { borderColor: C.green, backgroundColor: C.greenLight },
  emoji: { fontSize: 26 },
})
