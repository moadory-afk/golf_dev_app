import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useCallback, useRef, useState } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import AsyncStorage from '@react-native-async-storage/async-storage'

import { useClub } from '../lib/ClubContext'
import { useSkin } from '../skins'
import type { RootStackParamList } from '../navigation/types'
import { UserAvatarBtn } from './UserAvatar'
import { useUserProfile } from '../lib/UserProfileContext'
import { getClubNotices } from '../lib/store'


type Nav = NativeStackNavigationProp<RootStackParamList>

function noticeReadKey(clubId?: string, userId?: string | null) {
  return `@gogopar_notice_reads:${clubId ?? 'none'}:${userId ?? 'guest'}`
}

type TopActionButtonsProps = {
  topInset?: number
  floating?: boolean
}

export function TopActionButtons({ topInset = 0, floating = false }: TopActionButtonsProps) {
  const { palette } = useSkin()
  const nav = useNavigation<Nav>()
  const { activeClub: club, myClubs, setActiveClub } = useClub()
  const { userId } = useUserProfile()
  const clubRef = useRef<View>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; w: number } | null>(null)
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let mounted = true

      async function loadUnreadNoticeCount() {
        if (!club?.id) {
          if (mounted) setUnreadNoticeCount(0)
          return
        }

        try {
          const [items, rawReads] = await Promise.all([
            getClubNotices(club.id),
            AsyncStorage.getItem(noticeReadKey(club.id, userId)),
          ])
          const readIds = rawReads ? JSON.parse(rawReads) : []
          const visibleItems = club.role === 'admin' ? items : items.filter((item) => item.isPublished)
          const unreadCount = visibleItems.filter((item) => !readIds.includes(item.id)).length
          if (mounted) setUnreadNoticeCount(unreadCount)
        } catch {
          if (mounted) setUnreadNoticeCount(0)
        }
      }

      loadUnreadNoticeCount()

      return () => {
        mounted = false
      }
    }, [club?.id, club?.role, userId]),
  )

  function openClubMenu() {
    clubRef.current?.measureInWindow((x, y, w, h) => setMenu({ x, y: y + h + 6, w: Math.max(w, 190) }))
  }

  return (
    <View style={[styles.row, floating && styles.floating, floating && { top: topInset + 10 }]} pointerEvents="box-none">
      <View ref={clubRef} collapsable={false} style={{ flexShrink: 1 }}>
        <TouchableOpacity activeOpacity={0.84} onPress={openClubMenu} style={styles.clubPill}>
          <Text style={styles.clubIcon}>⛳</Text>
          <Text style={styles.clubText} numberOfLines={1}>{club?.name || 'GogoPar Club'}</Text>
          <Text style={styles.clubArrow}>⌄</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity activeOpacity={0.84} onPress={() => nav.navigate('NoticePrototype')} style={styles.circleButton}>
          <BellLineIcon />
          {unreadNoticeCount > 0 && (
            <View style={[styles.badge, { backgroundColor: palette.danger }]}> 
              <Text style={styles.badgeText}>{unreadNoticeCount > 99 ? '99+' : unreadNoticeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <UserAvatarBtn size={40} borderColor="transparent" backgroundColor="transparent" />
      </View>

      {menu && (
        <Modal transparent animationType="fade" onRequestClose={() => setMenu(null)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenu(null)}>
            <View style={[styles.menu, { left: menu.x, top: menu.y, minWidth: menu.w, backgroundColor: palette.card, borderColor: palette.border }]}> 
              {myClubs.length === 0 ? (
                <Text style={[styles.menuEmpty, { color: palette.muted }]}>참여 중인 클럽이 없습니다</Text>
              ) : myClubs.map((item) => {
                const selected = item.id === club?.id
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuItem, selected && { backgroundColor: palette.greenLight }]}
                    onPress={() => { setActiveClub(item); setMenu(null) }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.menuText, { color: selected ? palette.green : palette.text, fontWeight: selected ? '800' : '600' }]} numberOfLines={1}>⛳ {item.name}</Text>
                      <Text style={[styles.menuSub, { color: palette.muted }]} numberOfLines={1}>{item.role === 'admin' ? '관리자' : '회원'}</Text>
                    </View>
                    {selected && <Text style={[styles.check, { color: palette.green }]}>✓</Text>}
                  </TouchableOpacity>
                )
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  )
}

function BellLineIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 20 20">
      <Path
        d="M18 10.5c0-3.4-2.2-6-6-6s-6 2.6-6 6v3.2l-1.5 2.5h15l-1.5-2.5v-3.2Z"
        fill="none"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.6 18.5c.45.8 1.25 1.25 2.4 1.25s1.95-.45 2.4-1.25"
        fill="none"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20 },
  floating: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
  clubPill: {
    height: 40,
    maxWidth: 210,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clubIcon: { fontSize: 15 },
  clubText: { color: '#fff', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  clubArrow: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: -3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: 6, right: 5, minWidth: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.16)' },
  menu: { position: 'absolute', borderRadius: 16, paddingVertical: 6, maxWidth: 280, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  menuText: { fontSize: 14 },
  menuSub: { fontSize: 11, marginTop: 2 },
  menuEmpty: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 },
  check: { fontWeight: '900', fontSize: 15 },
})
