import { useEffect, useLayoutEffect, useState } from 'react'
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import { Icon } from '../components/Icon'
import { PwaInstallGuide } from '../components/PwaInstallGuide'
import { useClub } from '../lib/ClubContext'
import { useUserProfile } from '../lib/UserProfileContext'
import { createClubNotice, deleteClubNotice, getClubNotices, sendClubNotification, updateClubNotice, type ClubNotice } from '../lib/store'
import { C } from '../theme'

function shortDate(input: string) {
  if (!input) return '-'
  return input.slice(5, 10).replace('-', '.')
}

function readKey(clubId?: string, userId?: string | null) {
  return `@gogopar_notice_reads:${clubId ?? 'none'}:${userId ?? 'guest'}`
}

export default function NoticePrototypeScreen() {
  const nav = useNavigation()
  const { activeClub } = useClub()
  const { userId } = useUserProfile()
  const isAdmin = activeClub?.role === 'admin'
  const [notices, setNotices] = useState<ClubNotice[]>([])
  const [readIds, setReadIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<ClubNotice | 'new' | null>(null)
  const [selectedNotice, setSelectedNotice] = useState<ClubNotice | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [isImportant, setIsImportant] = useState(false)
  const [sendPush, setSendPush] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null)
  const [installGuideOpen, setInstallGuideOpen] = useState(false)
  const [noticeSaveMessage, setNoticeSaveMessage] = useState('')

  useLayoutEffect(() => {
    nav.setOptions({ title: `${activeClub?.name ?? '클럽'} 공지사항` })
  }, [nav, activeClub?.name])

  async function load() {
    if (!activeClub?.id) return
    setLoading(true)
    try {
      const [items, rawReads] = await Promise.all([
        getClubNotices(activeClub.id),
        AsyncStorage.getItem(readKey(activeClub.id, userId)),
      ])
      setNotices(isAdmin ? items : items.filter((item) => item.isPublished))
      setReadIds(rawReads ? JSON.parse(rawReads) : [])
    } catch (error) {
      Alert.alert('공지사항 오류', error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeClub?.id, userId, isAdmin])

  function openEditor(notice?: ClubNotice) {
    if (!isAdmin) return
    setEditing(notice ?? 'new')
    setTitle(notice?.title ?? '')
    setBody(notice?.body ?? '')
    setIsPublished(notice?.isPublished ?? true)
    setIsImportant(notice?.isImportant ?? false)
    setSendPush(false)
  }

  async function markRead(notice: ClubNotice) {
    if (!activeClub?.id || readIds.includes(notice.id)) return
    const next = [...readIds, notice.id]
    setReadIds(next)
    await AsyncStorage.setItem(readKey(activeClub.id, userId), JSON.stringify(next))
  }

  async function openNoticeDetail(notice: ClubNotice) {
    setSelectedNotice(notice)
    await markRead(notice)
  }

  async function saveNotice() {
    if (!activeClub?.id || !title.trim() || saving) return
    let pushPayload: { noticeId: string; title: string } | null = null
    setSaving(true)
    setNoticeSaveMessage('')
    try {
      if (editing === 'new') {
        const notice = await createClubNotice(activeClub.id, { title, body, isPublished, isImportant })
        if (sendPush && isPublished) {
          pushPayload = { noticeId: notice.id, title: title.trim() }
        }
      } else if (editing) {
        await updateClubNotice(editing.id, { title, body, isPublished, isImportant })
      }
      setEditing(null)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setNoticeSaveMessage(`저장 실패: ${message}`)
      Alert.alert('저장 실패', message)
      return
    } finally {
      setSaving(false)
    }

    if (pushPayload && activeClub?.id) {
      try {
        const result = await sendClubNotification(activeClub.id, {
          type: 'notice',
          title: '새 공지사항',
          body: pushPayload.title,
          data: { type: 'notice', clubId: activeClub.id, noticeId: pushPayload.noticeId },
        })
        if (result.total === 0) {
          setNoticeSaveMessage('공지사항은 저장됐지만, 아직 알림을 받을 기기가 없습니다.')
          Alert.alert('공지 저장 완료', '공지사항은 저장됐지만, 아직 알림을 받을 기기가 없습니다.')
        } else if (result.sent === 0) {
          setNoticeSaveMessage(`공지사항은 저장됐지만, 휴대폰 알림 발송에 실패했습니다. 실패 ${result.failed}건`)
          Alert.alert('공지 저장 완료', `공지사항은 저장됐지만, 휴대폰 알림 발송에 실패했습니다. 실패 ${result.failed}건`)
        } else {
          setNoticeSaveMessage(`공지사항을 저장하고 휴대폰 알림 ${result.sent}건을 보냈습니다.`)
          Alert.alert('알림 발송 완료', `공지사항을 저장하고 휴대폰 알림 ${result.sent}건을 보냈습니다.`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setNoticeSaveMessage(`공지는 저장됐지만 휴대폰 알림 발송은 실패했습니다. ${message}`)
        Alert.alert(
          '공지 저장 완료',
          `공지는 저장됐지만 휴대폰 알림 발송은 실패했습니다.\n\n${message}`,
        )
      }
    } else {
      setNoticeSaveMessage(
        sendPush && !isPublished
          ? '비게시 공지는 휴대폰 알림을 보내지 않고 저장했습니다.'
          : editing === 'new'
            ? '공지사항을 저장했습니다. 휴대폰 알림은 선택되지 않았습니다.'
            : '공지사항을 수정했습니다.',
      )
    }
  }

  async function removeNotice(notice: ClubNotice) {
    if (deletingNoticeId) return
    setDeletingNoticeId(notice.id)
    try {
      await deleteClubNotice(notice.id)
      setSelectedNotice((current) => current?.id === notice.id ? null : current)
      setReadIds((current) => current.filter((id) => id !== notice.id))
      setNotices((current) => current.filter((item) => item.id !== notice.id))
      await load()
    } catch (error) {
      Alert.alert('삭제 실패', error instanceof Error ? error.message : String(error))
    } finally {
      setDeletingNoticeId(null)
    }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>공지 목록</Text>
          {isAdmin && (
            <TouchableOpacity onPress={() => openEditor()} activeOpacity={0.82}>
              <Text style={s.sectionAction}>등록</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={s.installNotice} onPress={() => setInstallGuideOpen(true)} activeOpacity={0.84}>
          <View style={s.installNoticeIcon}><Text style={s.installNoticeEmoji}>📱</Text></View>
          <View style={{ flex: 1 }}>
            <View style={s.noticeTitleRow}>
              <Text style={s.pinnedBadge}>상단 고정</Text>
              <Text style={s.installNoticeTitle}>GogoPar 홈 화면에 설치하기</Text>
            </View>
            <Text style={s.noticeBody} numberOfLines={2}>아이폰·안드로이드·PC 기종별 설치 방법을 확인하세요.</Text>
            <Text style={s.installNoticeMeta}>항상 확인 가능</Text>
          </View>
          <Text style={s.installArrow}>›</Text>
        </TouchableOpacity>
        {noticeSaveMessage ? (
          <View style={s.noticeSaveBanner}>
            <Text style={s.noticeSaveBannerText}>{noticeSaveMessage}</Text>
          </View>
        ) : null}
        {loading ? (
          <Text style={s.body}>불러오는 중...</Text>
        ) : notices.length === 0 ? (
          <Text style={s.body}>등록된 공지사항이 없습니다.</Text>
        ) : notices.map((notice) => {
          const unread = notice.isPublished && !readIds.includes(notice.id)
          return (
            <View key={notice.id} style={[s.noticeRow, unread && s.noticeUnread]}>
              <TouchableOpacity style={s.noticeMain} onPress={() => openNoticeDetail(notice)} activeOpacity={0.82}>
                <View style={s.noticeIcon}>
                  <Icon name="mail" size={16} color={unread ? C.green : C.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.noticeTitleRow}>
                    {notice.isImportant && <Text style={s.importantBadge}>중요</Text>}
                    {!notice.isPublished && <Text style={s.draftBadgeText}>비게시</Text>}
                    <Text style={[s.noticeTitle, unread && s.noticeTitleUnread]} numberOfLines={1}>{notice.title}</Text>
                  </View>
                  <Text style={s.noticeBody} numberOfLines={2}>{notice.body || '내용 없음'}</Text>
                  <Text style={s.noticeMeta}>{shortDate(notice.createdAt)}</Text>
                </View>
              </TouchableOpacity>
              {isAdmin && (
                <View style={s.noticeActions}>
                  <TouchableOpacity hitSlop={8} onPress={() => openEditor(notice)}><Text style={s.actionText}>수정</Text></TouchableOpacity>
                  <TouchableOpacity
                    hitSlop={8}
                    disabled={deletingNoticeId === notice.id}
                    onPress={() => removeNotice(notice)}
                  >
                    <Text style={[s.actionText, { color: C.danger }, deletingNoticeId === notice.id && { opacity: 0.45 }]}>
                      {deletingNoticeId === notice.id ? '삭제중' : '삭제'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )
        })}
      </View>

      <PwaInstallGuide visible={installGuideOpen} onClose={() => setInstallGuideOpen(false)} />

      <Modal transparent visible={!!selectedNotice} animationType="fade" onRequestClose={() => setSelectedNotice(null)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={s.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>{selectedNotice?.title}</Text>
                <Text style={s.detailDate}>{selectedNotice ? shortDate(selectedNotice.createdAt) : ''}</Text>
              </View>
              <TouchableOpacity style={s.detailCloseBtn} onPress={() => setSelectedNotice(null)}>
                <Text style={s.detailCloseText}>닫기</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={s.detailBody}>{selectedNotice?.body || '내용 없음'}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={!!editing} animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{editing === 'new' ? '공지 등록' : '공지 수정'}</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="제목" />
            <TextInput style={[s.input, s.bodyInput]} value={body} onChangeText={setBody} placeholder="내용" multiline />
            <View style={s.toggleRow}>
              <TouchableOpacity style={[s.toggleBtn, isPublished && s.toggleOn]} onPress={() => setIsPublished((value) => !value)}>
                <Text style={[s.toggleText, isPublished && s.toggleTextOn]}>{isPublished ? '게시 중' : '비게시'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.toggleBtn, isImportant && s.toggleOn]} onPress={() => setIsImportant((value) => !value)}>
                <Text style={[s.toggleText, isImportant && s.toggleTextOn]}>중요</Text>
              </TouchableOpacity>
              {editing === 'new' && (
                <TouchableOpacity style={[s.toggleBtn, sendPush && s.toggleOn]} onPress={() => setSendPush((value) => !value)}>
                  <Text style={[s.toggleText, sendPush && s.toggleTextOn]}>휴대폰 알림</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.modalButtons}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(null)}>
                <Text style={s.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, (!title.trim() || saving) && { opacity: 0.45 }]} onPress={saveNotice} disabled={!title.trim() || saving}>
                <Text style={s.saveText}>{saving ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  installNotice: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#B9DDC8', backgroundColor: '#F0F8F3', borderRadius: 16, padding: 13, marginBottom: 10 },
  installNoticeIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#DCEFE4', alignItems: 'center', justifyContent: 'center' },
  installNoticeEmoji: { fontSize: 20 },
  installNoticeTitle: { flex: 1, color: C.text, fontSize: 14, fontWeight: '900' },
  installNoticeMeta: { color: C.greenDark, fontSize: 11, fontWeight: '800', marginTop: 5 },
  installArrow: { color: C.greenDark, fontSize: 24, fontWeight: '500' },
  noticeSaveBanner: { borderRadius: 12, backgroundColor: '#EAF5EF', padding: 11, marginBottom: 10 },
  noticeSaveBannerText: { color: C.greenDark, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  pinnedBadge: { color: '#fff', backgroundColor: C.greenDark, borderRadius: 7, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '900' },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  sectionAction: { fontSize: 12, fontWeight: '900', color: C.green },
  body: { fontSize: 13, color: C.muted, lineHeight: 20, marginTop: 8 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  noticeMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeUnread: { backgroundColor: '#f8fff8', marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 12 },
  noticeIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noticeTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: C.text },
  noticeTitleUnread: { color: C.green },
  noticeBody: { fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 17 },
  noticeMeta: { fontSize: 11, color: C.muted, marginTop: 4 },
  importantBadge: { fontSize: 10, fontWeight: '900', color: '#fff', backgroundColor: C.danger, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  draftBadgeText: { fontSize: 10, fontWeight: '900', color: C.warn, backgroundColor: `${C.warn}18`, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  noticeActions: { alignItems: 'flex-end', gap: 8 },
  actionText: { fontSize: 11, fontWeight: '900', color: C.green },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 14 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  detailDate: { fontSize: 12, fontWeight: '700', color: C.muted },
  detailBody: { fontSize: 14, lineHeight: 22, color: C.text },
  detailCloseBtn: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.greenLight },
  detailCloseText: { fontSize: 12, fontWeight: '900', color: C.green },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.text, marginBottom: 10 },
  bodyInput: { minHeight: 120, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggleBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  toggleOn: { borderColor: C.green, backgroundColor: C.greenLight },
  toggleText: { fontSize: 12, fontWeight: '900', color: C.muted },
  toggleTextOn: { color: C.green },
  modalButtons: { flexDirection: 'row', gap: 8 },
  cancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f2f4f6' },
  cancelText: { fontSize: 13, fontWeight: '900', color: C.muted },
  saveBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: C.green },
  saveText: { fontSize: 13, fontWeight: '900', color: '#fff' },
})
