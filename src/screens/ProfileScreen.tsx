import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput,
  ActivityIndicator, Platform, Share, Modal, Animated, Image,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from '../lib/supabase'
import { createClub, updateClubSettings, deleteClub, ensureProfile, type ClubInfo } from '../lib/store'
import { useClub } from '../lib/ClubContext'
import { C } from '../theme'
import { EmojiIcon } from '../components/EmojiIcon'
import type { User } from '@supabase/supabase-js'

// 공유 링크는 남에게 보내는 링크이므로, 앱이 로컬(localhost/Tailscale)에서 실행 중이어도
// 항상 배포된 프로덕션 주소를 써야 한다. window.location.origin을 쓰면 로컬 주소가 박혀 상대가 접속 불가.
const APP_URL = 'https://golf-seven-psi.vercel.app'

// ─── 아이콘 세트 ───────────────────────────────────────────────────────────────

const PROFILE_EMOJIS = [
  '🏌️', '⛳', '🏆', '👑', '💎', '🔥', '⚡', '🌟', '😎', '🤩',
  '🦁', '🐯', '🦅', '🦊', '🐻', '🚀', '🎯', '💪', '🌈', '🌊',
  '🎸', '🎨', '🍀', '🌺', '🏖️', '⛰️', '🌙', '☀️', '❄️', '🔮',
]

const CLUB_EMOJIS = [
  '⛳', '🏆', '🏅', '🥇', '🎯', '🔥', '⚡', '🌟', '💫', '👑',
  '💎', '🚀', '🦁', '🐯', '🦅', '🌿', '🍀', '🌺', '🌊', '⛰️',
  '🏖️', '🌄', '🌲', '🎪', '🎨', '🎸', '🏰', '🌙', '☀️', '🔮',
]

const RANDOM_ICONS = ['🏆', '🥇', '🎯', '🔥', '⚡', '🌟', '💎', '🚀', '🦁', '🐯', '🦅', '🌿', '🍀', '🌺', '🌊']

function randomIcon() {
  return RANDOM_ICONS[Math.floor(Math.random() * RANDOM_ICONS.length)]
}

// ─── 이모지 피커 모달 ─────────────────────────────────────────────────────────

function EmojiPicker({ emojis, selected, onSelect, onClose }: {
  emojis: string[]; selected: string; onSelect: (e: string) => void; onClose: () => void
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

// ─── 클럽 그리드 카드 ─────────────────────────────────────────────────────────

const CLUB_COLORS = ['#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#e74c3c', '#1abc9c']
function clubColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return CLUB_COLORS[h % CLUB_COLORS.length]
}

function ClubGridCard({
  club, isActive, color, customAvatar, onActivate, onShare, onSaved, onDelete, onAvatarChange,
}: {
  club: ClubInfo; isActive: boolean; color: string; customAvatar?: string
  onActivate: () => void; onShare: () => void
  onSaved: () => Promise<void>; onDelete: (c: ClubInfo) => void
  onAvatarChange: (clubId: string, dataUri: string) => void
}) {
  const isAdmin = club.role === 'admin'
  const [face, setFace] = useState<'front' | 'back'>('front')
  const [editName, setEditName] = useState(club.name)
  const [editSub, setEditSub] = useState(club.subtitle)
  const [editIcon, setEditIcon] = useState(club.icon)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showAvatarOptions, setShowAvatarOptions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    setEditName(club.name)
    setEditSub(club.subtitle)
    setEditIcon(club.icon)
  }, [club.name, club.subtitle, club.icon])

  function flipTo(to: 'front' | 'back') {
    Animated.timing(scale, { toValue: 0, duration: 130, useNativeDriver: false }).start(() => {
      setFace(to)
      Animated.timing(scale, { toValue: 1, duration: 130, useNativeDriver: false }).start()
    })
  }

  async function pickImage(source: 'gallery' | 'camera') {
    setShowAvatarOptions(false)
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('권한 필요', source === 'camera' ? '카메라 접근 권한이 필요합니다.' : '사진 접근 권한이 필요합니다.')
      return
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return

    setUploadingPhoto(true)
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 100, height: 100 } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      )
      const dataUri = `data:image/jpeg;base64,${compressed.base64}`
      if (dataUri.length > 20000) {
        Alert.alert('사진이 너무 큽니다', '더 작은 사진을 선택해주세요.')
        return
      }
      onAvatarChange(club.id, dataUri)
    } catch { Alert.alert('오류', '사진 처리에 실패했습니다.') }
    finally { setUploadingPhoto(false) }
  }

  async function handleSave() {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await updateClubSettings(club.id, editName.trim(), editSub.trim(), editIcon)
      await onSaved()
      flipTo('front')
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : String(e))
    } finally { setSaving(false) }
  }

  const displayIcon = customAvatar || null

  return (
    <>
      {/* 아바타 옵션 모달 */}
      {showAvatarOptions && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowAvatarOptions(false)}>
          <TouchableOpacity style={ep.overlay} activeOpacity={1} onPress={() => setShowAvatarOptions(false)}>
            <TouchableOpacity style={p.avatarOptionsCard} activeOpacity={1} onPress={() => {}}>
              <Text style={p.avatarOptionsTitle}>클럽 아이콘 변경</Text>
              <TouchableOpacity style={p.avatarOption} onPress={() => pickImage('camera')}>
                <Text style={p.avatarOptionIcon}>📷</Text>
                <View>
                  <Text style={p.avatarOptionText}>카메라로 촬영</Text>
                  <Text style={p.avatarOptionSub}>1:1 비율로 자동 크롭됩니다</Text>
                </View>
              </TouchableOpacity>
              <View style={p.menuDivider} />
              <TouchableOpacity style={p.avatarOption} onPress={() => pickImage('gallery')}>
                <Text style={p.avatarOptionIcon}>🖼️</Text>
                <View>
                  <Text style={p.avatarOptionText}>갤러리에서 사진 선택</Text>
                  <Text style={p.avatarOptionSub}>1:1 비율로 자동 크롭됩니다</Text>
                </View>
              </TouchableOpacity>
              <View style={p.menuDivider} />
              <TouchableOpacity style={p.avatarOption} onPress={() => { setShowAvatarOptions(false); setShowEmojiPicker(true) }}>
                <Text style={p.avatarOptionIcon}>😊</Text>
                <View>
                  <Text style={p.avatarOptionText}>이모지로 선택</Text>
                  <Text style={p.avatarOptionSub}>30가지 이모지 중 선택</Text>
                </View>
              </TouchableOpacity>
              {customAvatar && (
                <>
                  <View style={p.menuDivider} />
                  <TouchableOpacity style={p.avatarOption} onPress={() => { setShowAvatarOptions(false); onAvatarChange(club.id, '') }}>
                    <Text style={p.avatarOptionIcon}>🗑️</Text>
                    <Text style={[p.avatarOptionText, { color: C.danger }]}>기본 이모지로 초기화</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={{ paddingVertical: 14, alignItems: 'center' }} onPress={() => setShowAvatarOptions(false)}>
                <Text style={{ color: C.muted, fontSize: 14 }}>취소</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 이모지 피커 */}
      {showEmojiPicker && (
        <EmojiPicker
          emojis={CLUB_EMOJIS}
          selected={editIcon}
          onSelect={(e) => {
            setEditIcon(e)
            onAvatarChange(club.id, '')  // 사진 제거
            setShowEmojiPicker(false)
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      <Animated.View style={[g.card, isActive && { borderColor: color, borderWidth: 2.5 }, { transform: [{ scaleX: scale }] }]}>
        {face === 'front' ? (
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => isActive ? (isAdmin && flipTo('back')) : onActivate()}
            activeOpacity={0.8}
          >
            <View style={[g.colorBar, { backgroundColor: color }]}>
              {isActive && <View style={g.activeBadge}><Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>활성</Text></View>}
              {isAdmin && isActive && (
                <TouchableOpacity style={g.editIcon} onPress={() => flipTo('back')}>
                  <EmojiIcon char="✏️" size={13} color={C.muted} />
                </TouchableOpacity>
              )}
            </View>
            <View style={g.cardBody}>
              {displayIcon ? (
                <Image source={{ uri: displayIcon }} style={{ width: 52, height: 52, borderRadius: 26, marginBottom: 8 }} />
              ) : (
                <Text style={{ fontSize: 32, marginBottom: 6 }}>{editIcon || club.icon}</Text>
              )}
              <Text style={g.clubName} numberOfLines={2}>{club.name}</Text>
              {club.subtitle ? <Text style={g.clubSub} numberOfLines={1}>{club.subtitle}</Text> : null}
              <View style={[g.roleBadge, isAdmin && { backgroundColor: C.greenLight }]}>
                <Text style={[g.roleBadgeText, isAdmin && { color: C.green }]}>
                  {isAdmin ? '관리자' : '멤버'}
                </Text>
              </View>
            </View>
            {isActive && (
              <TouchableOpacity style={[g.shareBtn, { backgroundColor: color }]} onPress={onShare}>
                <Text style={g.shareBtnText}>초대</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, flex: 1 }}>클럽 편집</Text>
              <TouchableOpacity onPress={() => flipTo('front')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: C.muted, fontSize: 12 }}>닫기</Text>
              </TouchableOpacity>
            </View>

            {/* 아이콘 변경 버튼 */}
            <TouchableOpacity style={g.iconPickerBtn} onPress={() => setShowAvatarOptions(true)}>
              {uploadingPhoto ? (
                <ActivityIndicator color={C.green} size="small" />
              ) : displayIcon ? (
                <Image source={{ uri: displayIcon }} style={{ width: 30, height: 30, borderRadius: 15 }} />
              ) : (
                <Text style={{ fontSize: 24 }}>{editIcon}</Text>
              )}
              <Text style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>
                {uploadingPhoto ? '처리 중...' : '아이콘 변경 ›'}
              </Text>
            </TouchableOpacity>

            <TextInput style={g.editInput} value={editName} onChangeText={setEditName} placeholder="클럽명" maxLength={20} />
            <TextInput style={g.editInput} value={editSub} onChangeText={setEditSub} placeholder="부제" maxLength={30} />
            <TouchableOpacity style={[g.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={g.saveBtnText}>저장</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={g.deleteBtn} onPress={() => onDelete(club)}>
              <Text style={g.deleteBtnText}>클럽 삭제</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </>
  )
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null)
  const { activeClub, myClubs, setActiveClub, refreshClubs } = useClub()

  // 프로필 편집 상태
  const [editingName, setEditingName] = useState(false)
  const [editNameVal, setEditNameVal] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [showAvatarOptions, setShowAvatarOptions] = useState(false)
  const [showProfileIconPicker, setShowProfileIconPicker] = useState(false)
  const [profileIcon, setProfileIcon] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // 비밀번호 변경
  const [showPwModal, setShowPwModal] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  // 클럽 아바타 (user_metadata.clubAvatars 에 저장)
  const [clubAvatars, setClubAvatars] = useState<Record<string, string>>({})

  // 클럽 생성
  const [shareModal, setShareModal] = useState<{ message: string; link: string } | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newClubName, setNewClubName] = useState('')
  const [newClubSubtitle, setNewClubSubtitle] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setProfileIcon(data.user?.user_metadata?.icon ?? '')
      setAvatarUrl(data.user?.user_metadata?.avatarUrl ?? '')
      setEditNameVal(data.user?.user_metadata?.name ?? '')
      setClubAvatars(data.user?.user_metadata?.clubAvatars ?? {})
    })
  }, [])

  const userName = user?.user_metadata?.name ?? user?.email ?? ''
  const userInitial = userName.slice(0, 1)

  // 사진 업로드 (source: 'camera' | 'gallery')
  async function handlePickPhoto(source: 'camera' | 'gallery' = 'gallery') {
    setShowAvatarOptions(false)
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('권한 필요', source === 'camera' ? '카메라 접근 권한이 필요합니다.' : '사진 접근 권한이 필요합니다.')
      return
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        })
    if (result.canceled || !result.assets[0]) return

    setUploadingPhoto(true)
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 100, height: 100 } }],
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
      setAvatarUrl(dataUri)
      setProfileIcon('')
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    } catch (e: unknown) {
      Alert.alert('오류', '사진 업로드에 실패했습니다.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  // 이모지 아이콘 변경
  async function handleSelectProfileIcon(emoji: string) {
    setProfileIcon(emoji)
    setShowProfileIconPicker(false)
    const { error } = await supabase.auth.updateUser({
      data: { ...user?.user_metadata, icon: emoji, avatarUrl: '' },
    })
    if (error) Alert.alert('오류', '아이콘 저장에 실패했습니다.')
    else setAvatarUrl('')
  }

  // 이름 저장
  async function handleSaveName() {
    if (!editNameVal.trim()) return
    setSavingName(true)
    try {
      await supabase.auth.updateUser({ data: { ...user?.user_metadata, name: editNameVal.trim() } })
      await ensureProfile(user!.id, editNameVal.trim())
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
      setEditingName(false)
    } catch { Alert.alert('오류', '이름 변경에 실패했습니다.') }
    finally { setSavingName(false) }
  }

  // 비밀번호 변경
  async function handleChangePassword() {
    if (newPw.length < 6) { Alert.alert('비밀번호는 6자 이상이어야 합니다.'); return }
    if (newPw !== confirmPw) { Alert.alert('비밀번호가 일치하지 않습니다.'); return }
    setSavingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      setShowPwModal(false)
      setNewPw('')
      setConfirmPw('')
      Alert.alert('비밀번호가 변경되었습니다.')
    } catch (e: unknown) { Alert.alert('오류', e instanceof Error ? e.message : String(e)) }
    finally { setSavingPw(false) }
  }

  // 클럽 아바타 변경 (user_metadata에 저장)
  async function handleClubAvatarChange(clubId: string, dataUri: string) {
    const next = { ...clubAvatars, [clubId]: dataUri }
    if (!dataUri) delete next[clubId]
    setClubAvatars(next)
    await supabase.auth.updateUser({
      data: { ...user?.user_metadata, clubAvatars: next },
    })
  }

  // 클럽 관리
  async function handleDeleteClub(club: ClubInfo) {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`"${club.name}" 클럽을 삭제하시겠습니까?\n\n⚠️ 멤버 전체 탈퇴, 기록은 보존됩니다.`)
      : await new Promise<boolean>((resolve) =>
          Alert.alert('클럽 삭제', `"${club.name}"을 삭제하시겠습니까?\n기록은 보존됩니다.`, [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
          ])
        )
    if (!confirmed) return
    try {
      await deleteClub(club.id)
      await refreshClubs()
    } catch (e: unknown) { Alert.alert('오류', e instanceof Error ? e.message : String(e)) }
  }

  function handleShareLink(club: ClubInfo) {
    const link = `${APP_URL}/?join=${club.inviteCode}&openExternalBrowser=1`
    const senderName = user?.user_metadata?.name ?? '관리자'
    const message = `[${senderName}]님이 [${club.name}] 골프 클럽에 초대합니다! 🏌️\n\n아래 링크를 클릭하여 참여하세요 👇\n${link}`
    if (Platform.OS !== 'web') {
      Share.share({ title: `${club.name} 골프 클럽 초대`, message })
    } else {
      setShareModal({ message, link })
    }
  }

  function handleSharePromo() {
    const link = `${APP_URL}/?promo=1&openExternalBrowser=1`
    const senderName = user?.user_metadata?.name ?? '관리자'
    const message = `[${senderName}]님이 GogoPar 골프 스코어 앱을 추천합니다! ⛳\n\n아래 링크에서 무료로 시작하세요 👇\n${link}`
    if (Platform.OS !== 'web') {
      Share.share({ title: 'GogoPar 추천', message })
    } else {
      setShareModal({ message, link })
    }
  }

  async function handleCreate() {
    if (!newClubName.trim()) { Alert.alert('클럽명을 입력하세요.'); return }
    setCreateLoading(true)
    try {
      const icon = randomIcon()
      const c = await createClub(newClubName.trim(), newClubSubtitle.trim(), icon)
      await refreshClubs()
      setActiveClub(c)
      setShowCreateForm(false)
      setNewClubName('')
      setNewClubSubtitle('')
    } catch (e: unknown) { Alert.alert('오류', e instanceof Error ? e.message : String(e)) }
    finally { setCreateLoading(false) }
  }

  async function handleLogout() {
    await supabase.auth.signOut({ scope: 'local' })
    if (Platform.OS === 'web') {
      window.location.href = '/'
    }
  }

  const isAdmin = activeClub?.role === 'admin'

  return (
    <View style={{ flex: 1, backgroundColor: '#f2f4f6' }}>
      {/* 아바타 옵션 선택 모달 */}
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
                  <Text style={p.avatarOptionSub}>30가지 이모지 중 선택</Text>
                </View>
              </TouchableOpacity>
              {(avatarUrl || profileIcon) && (
                <>
                  <View style={p.menuDivider} />
                  <TouchableOpacity style={p.avatarOption} onPress={async () => {
                    setShowAvatarOptions(false)
                    await supabase.auth.updateUser({ data: { ...user?.user_metadata, avatarUrl: '', icon: '' } })
                    setAvatarUrl('')
                    setProfileIcon('')
                  }}>
                    <Text style={p.avatarOptionIcon}>🗑️</Text>
                    <Text style={[p.avatarOptionText, { color: C.danger }]}>기본 이미지로 초기화</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={{ paddingVertical: 14, alignItems: 'center' }} onPress={() => setShowAvatarOptions(false)}>
                <Text style={{ color: C.muted, fontSize: 14 }}>취소</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 이모지 피커 */}
      {showProfileIconPicker && (
        <EmojiPicker
          emojis={PROFILE_EMOJIS}
          selected={profileIcon}
          onSelect={handleSelectProfileIcon}
          onClose={() => setShowProfileIconPicker(false)}
        />
      )}

      {/* 비밀번호 변경 모달 */}
      {showPwModal && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowPwModal(false)}>
          <TouchableOpacity style={p.overlay} activeOpacity={1} onPress={() => setShowPwModal(false)}>
            <TouchableOpacity style={p.modalCard} activeOpacity={1} onPress={() => {}}>
              <View style={p.modalHeader}>
                <Text style={p.modalTitle}>🔑 비밀번호 변경</Text>
                <TouchableOpacity onPress={() => setShowPwModal(false)}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>닫기</Text>
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
                {savingPw
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={p.modalBtnText}>변경하기</Text>}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 초대 공유 모달 */}
      {shareModal && (
        <Modal transparent animationType="fade" onRequestClose={() => setShareModal(null)}>
          <TouchableOpacity style={p.overlay} activeOpacity={1} onPress={() => setShareModal(null)}>
            <TouchableOpacity style={p.shareCard} activeOpacity={1} onPress={() => {}}>
              <Text style={p.shareTitle}>초대 메시지</Text>
              <Text style={p.shareDesc}>아래 메시지를 복사해서 카카오톡, 문자로 보내세요</Text>
              <View style={p.shareBox}>
                <Text style={p.shareText} selectable>{shareModal.message}</Text>
              </View>
              <TouchableOpacity style={p.copyBtn} onPress={async () => {
                await Clipboard.setStringAsync(shareModal.message)
                Alert.alert('복사 완료!')
              }}>
                <Text style={p.copyBtnText}>메시지 전체 복사</Text>
              </TouchableOpacity>
<TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center' }} onPress={() => setShareModal(null)}>
                <Text style={{ color: C.muted, fontSize: 14 }}>닫기</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── 프로필 섹션 ── */}
        <View style={p.profileSection}>
          {/* 아바타 (탭하면 옵션 선택) */}
          <TouchableOpacity onPress={() => setShowAvatarOptions(true)} style={p.avatarWrap}>
            <View style={p.avatar}>
              {uploadingPhoto ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
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

          {/* 이름 편집 */}
          <View style={{ flex: 1 }}>
            {editingName ? (
              <>
                <TextInput
                  style={p.nameInput}
                  value={editNameVal}
                  onChangeText={setEditNameVal}
                  autoFocus
                  maxLength={20}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[p.nameSaveBtn, savingName && { opacity: 0.6 }]}
                    onPress={handleSaveName}
                    disabled={savingName}
                  >
                    {savingName
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={p.nameSaveBtnText}>저장</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingName(false)}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>취소</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={p.profileName}>{userName}</Text>
                <TouchableOpacity onPress={() => { setEditNameVal(userName); setEditingName(true) }}>
                  <Text style={p.profileEditHint}>이름 수정</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── 내 클럽 그리드 ── */}
        <Text style={p.sectionLabel}>내 클럽</Text>
        <View style={p.grid}>
          {myClubs.map((club) => {
            const isActive = activeClub?.id === club.id
            const color = clubColor(club.id)
            return (
              <View key={club.id} style={p.gridItem}>
                <ClubGridCard
                  club={club}
                  isActive={isActive}
                  color={color}
                  customAvatar={clubAvatars[club.id] ?? ''}
                  onActivate={() => setActiveClub(club)}
                  onShare={() => handleShareLink(club)}
                  onSaved={refreshClubs}
                  onDelete={handleDeleteClub}
                  onAvatarChange={handleClubAvatarChange}
                />
              </View>
            )
          })}
          <View style={p.gridItem}>
            <TouchableOpacity style={g.addCard} onPress={() => setShowCreateForm(true)}>
              <Text style={{ fontSize: 28, color: C.muted, marginBottom: 6 }}>➕</Text>
              <Text style={{ fontSize: 12, color: C.muted, fontWeight: '600' }}>새 클럽 만들기</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 새 클럽 폼 */}
        {showCreateForm && (
          <View style={p.createForm}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, flex: 1 }}>새 클럽 만들기</Text>
              <TouchableOpacity onPress={() => setShowCreateForm(false)}>
                <Text style={{ color: C.muted, fontSize: 13 }}>닫기</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={p.input} value={newClubName} onChangeText={setNewClubName} placeholder="클럽명" maxLength={20} />
            <TextInput style={p.input} value={newClubSubtitle} onChangeText={setNewClubSubtitle} placeholder="부제 (선택)" maxLength={30} />
            <Text style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>💡 아이콘은 자동으로 랜덤 배정됩니다</Text>
            <TouchableOpacity style={[p.createBtn, createLoading && { opacity: 0.6 }]} onPress={handleCreate} disabled={createLoading}>
              {createLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={p.createBtnText}>만들기</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── 클럽 관리 ── */}
        {isAdmin && (
          <>
            <Text style={p.sectionLabel}>클럽 관리</Text>
            <View style={p.menuCard}>
              <TouchableOpacity style={p.menuRow} onPress={handleSharePromo}>
                <Text style={p.menuIcon}>📢</Text>
                <Text style={p.menuText}>앱 사용 권유 링크 공유</Text>
                <Text style={p.menuArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── 계정 ── */}
        <Text style={p.sectionLabel}>계정</Text>
        <View style={p.menuCard}>
          <TouchableOpacity style={p.menuRow} onPress={() => setShowPwModal(true)}>
            <Text style={p.menuIcon}>🔑</Text>
            <Text style={p.menuText}>비밀번호 변경</Text>
            <Text style={p.menuArrow}>›</Text>
          </TouchableOpacity>
          <View style={p.menuDivider} />
          <TouchableOpacity style={p.menuRow} onPress={handleLogout}>
            <View style={[p.menuIcon, { alignItems: 'center' }]}><EmojiIcon char="🚪" size={17} color={C.danger} /></View>
            <Text style={[p.menuText, { color: C.danger }]}>로그아웃</Text>
            <Text style={p.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={p.version}>GogoPar v1.0</Text>
      </ScrollView>
    </View>
  )
}

// ─── 그리드 카드 스타일 ────────────────────────────────────────────────────────

const g = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    minHeight: 190, padding: 12,
  },
  colorBar: {
    height: 8, borderRadius: 4, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 2,
  },
  activeBadge: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, marginRight: 3 },
  editIcon: { padding: 2 },
  cardBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clubName: { fontSize: 13, fontWeight: '800', color: '#111', textAlign: 'center', marginBottom: 4 },
  clubSub: { fontSize: 10, color: '#888', textAlign: 'center', marginBottom: 8 },
  roleBadge: { backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { fontSize: 10, color: '#888', fontWeight: '700' },
  shareBtn: { borderRadius: 8, paddingVertical: 7, alignItems: 'center', marginTop: 8 },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  iconPickerBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8f8f8', borderRadius: 10,
    padding: 8, marginBottom: 8,
  },
  editInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 13, color: C.text, backgroundColor: '#fff', marginBottom: 6,
  },
  saveBtn: { backgroundColor: C.green, borderRadius: 8, paddingVertical: 9, alignItems: 'center', marginBottom: 6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deleteBtn: { borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: C.danger },
  deleteBtnText: { color: C.danger, fontWeight: '700', fontSize: 13 },
  addCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: C.border,
    borderStyle: 'dashed', minHeight: 190, alignItems: 'center', justifyContent: 'center',
  },
})

// ─── ProfileScreen 스타일 ─────────────────────────────────────────────────────

const p = StyleSheet.create({
  profileSection: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: C.greenDark, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarEmoji: { fontSize: 30 },
  avatarInitial: { fontSize: 26, fontWeight: '900', color: '#fff' },
  avatarEditBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.greenDark,
  },
  profileName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileEditHint: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  nameInput: {
    fontSize: 18, fontWeight: '700', color: '#fff',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.5)',
    paddingVertical: 4, paddingHorizontal: 0,
  },
  nameSaveBtn: {
    backgroundColor: C.gold, borderRadius: 16,
    paddingVertical: 6, paddingHorizontal: 16,
  },
  nameSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },
  gridItem: { width: '47%' },

  createForm: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginHorizontal: 16, marginTop: 4, marginBottom: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: C.text, marginBottom: 8, backgroundColor: '#fff',
  },
  createBtn: { backgroundColor: C.green, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  menuCard: {
    backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 4,
    overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 12 },
  menuIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  menuText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  menuArrow: { fontSize: 16, color: C.muted },
  menuDivider: { height: 1, backgroundColor: C.border, marginLeft: 54 },
  version: { textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 24, marginBottom: 8 },

  // 아바타 옵션 모달
  avatarOptionsCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 8,
    width: '100%', maxWidth: 380,
  },
  avatarOptionsTitle: {
    fontSize: 13, fontWeight: '700', color: C.muted,
    textAlign: 'center', paddingVertical: 14, letterSpacing: 0.3,
  },
  avatarOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  avatarOptionIcon: { fontSize: 26, width: 36, textAlign: 'center' },
  avatarOptionText: { fontSize: 15, fontWeight: '600', color: C.text },
  avatarOptionSub: { fontSize: 12, color: C.muted, marginTop: 2 },

  // 비번 모달
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 380 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  modalInput: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: C.text, marginBottom: 10, backgroundColor: '#fafafa',
  },
  modalBtn: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // 공유 모달
  shareCard: { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 380 },
  shareTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 6 },
  shareDesc: { fontSize: 13, color: C.muted, marginBottom: 14 },
  shareBox: { backgroundColor: '#f2f4f6', borderRadius: 12, padding: 14, marginBottom: 14 },
  shareText: { fontSize: 14, color: C.text, lineHeight: 22 },
  copyBtn: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 13, alignItems: 'center', marginBottom: 8 },
  copyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  copyLinkBtn: { backgroundColor: C.greenLight, borderRadius: 50, paddingVertical: 11, alignItems: 'center', marginBottom: 8 },
  copyLinkBtnText: { color: C.green, fontWeight: '600', fontSize: 14 },
})

// ─── 이모지 피커 스타일 ───────────────────────────────────────────────────────

const ep = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: C.text },
  closeBtn: { backgroundColor: C.green, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emojiBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  emojiBtnActive: { borderColor: C.green, backgroundColor: C.greenLight },
  emoji: { fontSize: 26 },
})
