import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Modal, RefreshControl, Platform,
} from 'react-native'
import { useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { getClubMembers, removeMember, updateMemberRole } from '../lib/store'
import { C } from '../theme'
import type { RootStackProps } from '../navigation/types'

type Member = { userId: string; name: string; role: string }

export default function MemberScreen() {
  const route = useRoute<RootStackProps<'Members'>['route']>()
  const { clubId } = route.params

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<string>('member')
  const [actionTarget, setActionTarget] = useState<Member | null>(null)
  const [acting, setActing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: { user } }, list] = await Promise.all([
        supabase.auth.getUser(),
        getClubMembers(clubId),
      ])
      setMyUserId(user?.id ?? null)
      setMembers(list)
      const me = list.find((m) => m.userId === user?.id)
      setMyRole(me?.role ?? 'member')
    } catch {
      setErrorMsg('멤버 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [clubId])

  useEffect(() => { load() }, [load])

  const isAdmin = myRole === 'admin'

  async function handlePromote(target: Member) {
    setActionTarget(null)
    setActing(true)
    setErrorMsg(null)
    try {
      await updateMemberRole(clubId, target.userId, 'admin')
      await load()
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : '역할 변경에 실패했습니다.')
    } finally { setActing(false) }
  }

  async function handleDemote(target: Member) {
    setActionTarget(null)
    setActing(true)
    setErrorMsg(null)
    try {
      await updateMemberRole(clubId, target.userId, 'member')
      await load()
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : '역할 변경에 실패했습니다.')
    } finally { setActing(false) }
  }

  async function handleRemove(target: Member) {
    setActionTarget(null)
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`"${target.name}"을 클럽에서 내보내겠습니까?`)
      : await new Promise<boolean>((resolve) =>
          Alert.alert('멤버 내보내기', `"${target.name}"을 클럽에서 내보내겠습니까?`, [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '내보내기', style: 'destructive', onPress: () => resolve(true) },
          ])
        )
    if (!confirmed) return
    setActing(true)
    setErrorMsg(null)
    try {
      await removeMember(clubId, target.userId)
      await load()
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : '내보내기에 실패했습니다.')
    } finally { setActing(false) }
  }

  const admins = members.filter((m) => m.role === 'admin')
  const regularMembers = members.filter((m) => m.role !== 'admin')

  return (
    <View style={{ flex: 1, backgroundColor: '#f2f4f6' }}>
      {/* 액션 모달 */}
      {actionTarget && (
        <Modal transparent animationType="fade" onRequestClose={() => setActionTarget(null)}>
          <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setActionTarget(null)}>
            <TouchableOpacity style={m.actionCard} activeOpacity={1} onPress={() => {}}>
              <Text style={m.actionTitle}>{actionTarget.name}</Text>
              {actionTarget.role === 'member' ? (
                <TouchableOpacity style={m.actionRow} onPress={() => handlePromote(actionTarget)}>
                  <Text style={m.actionIcon}>👑</Text>
                  <View>
                    <Text style={m.actionText}>관리자로 승격</Text>
                    <Text style={m.actionSub}>클럽 편집 권한이 부여됩니다</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={m.actionRow} onPress={() => handleDemote(actionTarget)}>
                  <Text style={m.actionIcon}>👤</Text>
                  <View>
                    <Text style={m.actionText}>멤버로 강등</Text>
                    <Text style={m.actionSub}>관리자 권한이 제거됩니다</Text>
                  </View>
                </TouchableOpacity>
              )}
              <View style={m.divider} />
              <TouchableOpacity style={m.actionRow} onPress={() => handleRemove(actionTarget)}>
                <Text style={m.actionIcon}>🚫</Text>
                <Text style={[m.actionText, { color: C.danger }]}>클럽에서 내보내기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 14, alignItems: 'center' }} onPress={() => setActionTarget(null)}>
                <Text style={{ color: C.muted, fontSize: 14 }}>취소</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.green} />}
      >
        <View style={m.countRow}>
          <Text style={m.countText}>전체 {members.length}명</Text>
        </View>
        {errorMsg && (
          <View style={m.errorBox}>
            <Text style={m.errorText}>{errorMsg}</Text>
          </View>
        )}

        {loading && members.length === 0 ? (
          <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />
        ) : (
          <>
            {admins.length > 0 && (
              <>
                <Text style={m.sectionLabel}>관리자</Text>
                <View style={m.card}>
                  {admins.map((member, i) => (
                    <MemberRow
                      key={member.userId}
                      member={member}
                      isSelf={member.userId === myUserId}
                      canManage={isAdmin}
                      isLast={i === admins.length - 1}
                      acting={acting}
                      onAction={() => setActionTarget(member)}
                    />
                  ))}
                </View>
              </>
            )}

            {regularMembers.length > 0 && (
              <>
                <Text style={m.sectionLabel}>멤버</Text>
                <View style={m.card}>
                  {regularMembers.map((member, i) => (
                    <MemberRow
                      key={member.userId}
                      member={member}
                      isSelf={member.userId === myUserId}
                      canManage={isAdmin}
                      isLast={i === regularMembers.length - 1}
                      acting={acting}
                      onAction={() => setActionTarget(member)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ─── 멤버 행 ──────────────────────────────────────────────────────────────────

function MemberRow({ member, isSelf, canManage, isLast, acting, onAction }: {
  member: Member
  isSelf: boolean
  canManage: boolean
  isLast: boolean
  acting: boolean
  onAction: () => void
}) {
  return (
    <View style={[m.memberRow, !isLast && m.rowDivider]}>
      <View style={m.avatar}>
        <Text style={m.avatarText}>{member.name.slice(0, 1)}</Text>
      </View>
      <Text style={m.memberName}>
        {member.name}{isSelf ? ' (나)' : ''}
      </Text>
      <View style={{ flex: 1 }} />
      {member.role === 'admin' && (
        <View style={m.roleBadge}>
          <Text style={m.roleBadgeText}>👑 관리자</Text>
        </View>
      )}
      {canManage && !isSelf && (
        <TouchableOpacity onPress={onAction} disabled={acting} style={m.moreBtn}>
          <Text style={m.moreBtnText}>···</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  actionCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 8,
    width: '100%', maxWidth: 380,
  },
  actionTitle: {
    fontSize: 13, fontWeight: '700', color: C.muted,
    textAlign: 'center', paddingVertical: 14, letterSpacing: 0.3,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  actionIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  actionText: { fontSize: 15, fontWeight: '600', color: C.text },
  actionSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 20 },

  countRow: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  countText: { fontSize: 15, fontWeight: '700', color: C.muted, letterSpacing: 0.5 },
  errorBox: { backgroundColor: '#fff0f0', borderRadius: 8, padding: 10, marginHorizontal: 16, marginBottom: 4, borderWidth: 1, borderColor: '#ffcccc' },
  errorText: { fontSize: 13, color: '#c0392b' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: C.green },
  memberName: { fontSize: 15, fontWeight: '600', color: C.text },
  roleBadge: {
    backgroundColor: '#fffbe8', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  roleBadgeText: { fontSize: 11, color: C.gold, fontWeight: '700' },
  moreBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f2f4f6', alignItems: 'center', justifyContent: 'center',
    marginLeft: 4,
  },
  moreBtnText: { fontSize: 16, color: C.muted, fontWeight: '700', letterSpacing: -1 },
})
