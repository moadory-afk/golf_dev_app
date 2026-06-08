import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { useRef, useState, type ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useClub } from '../lib/ClubContext'
import { shortName } from '../lib/store'
import { UserAvatarBtn } from './UserAvatar'
import { C } from '../theme'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

// 홈/클럽/기록 공용 헤더.
// 기본: 인사말 + [내이름] [클럽▾] ... [아바타]
// showSettings: 클럽명 오른쪽에 설정 버튼 추가 (클럽 화면)
// rightExtra: 아바타 왼쪽에 요소 추가 (기록 화면의 스코어 입력 등)
export function AppHeader({ myName, showSettings = false, rightExtra }: {
  myName: string | null
  showSettings?: boolean
  rightExtra?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const { activeClub: club, myClubs, setActiveClub } = useClub()
  const badgeRef = useRef<View>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; w: number } | null>(null)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요'

  function openMenu() {
    badgeRef.current?.measureInWindow((x, y, w, h) => setMenu({ x, y: y + h + 4, w: Math.max(w, 180) }))
  }

  return (
    <View style={[s.header, { paddingTop: insets.top + 16 }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.greeting} numberOfLines={1}>
          {myName ? <Text style={s.greetingName}>{shortName(myName)}님 </Text> : null}
          {greeting}.
        </Text>
        <View style={s.identityRow}>
          {club && (
            <View ref={badgeRef} collapsable={false}>
              <TouchableOpacity style={s.clubBadge} onPress={openMenu} activeOpacity={0.7}>
                <Text style={s.clubBadgeText} numberOfLines={1}>⛳ {club.name}</Text>
                <Text style={s.caret}>▾</Text>
              </TouchableOpacity>
            </View>
          )}
          {showSettings && club && (
            <TouchableOpacity style={s.memberBtn} onPress={() => nav.navigate('Settings')}>
              <Text style={{ fontSize: 11 }}>⚙️</Text>
              <Text style={s.memberBtnText}>설정</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.right}>
        {rightExtra}
        <UserAvatarBtn size={38} />
      </View>

      {menu && (
        <Modal transparent animationType="fade" onRequestClose={() => setMenu(null)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMenu(null)}>
            <View style={[s.menu, { left: menu.x, top: menu.y, minWidth: menu.w }]}>
              {myClubs.map((c) => {
                const active = c.id === club?.id
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.menuItem, active && s.menuItemActive]}
                    onPress={() => { setActiveClub(c); setMenu(null) }}
                  >
                    <Text style={[s.menuText, active && s.menuTextActive]} numberOfLines={1}>⛳ {c.name}</Text>
                    {active && <Text style={s.check}>✓</Text>}
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

const s = StyleSheet.create({
  header: {
    backgroundColor: C.greenDark, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 8 },
  greetingName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  right: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  clubBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, maxWidth: 150,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    flexDirection: 'row', alignItems: 'center',
  },
  clubBadgeText: { color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  caret: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginLeft: 4 },
  memberBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  memberBtnText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  menu: {
    position: 'absolute', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 6, maxWidth: 260,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  menuItemActive: { backgroundColor: C.greenLight },
  menuText: { fontSize: 14, color: C.text, fontWeight: '500' },
  menuTextActive: { color: C.green, fontWeight: '700' },
  check: { color: C.green, fontWeight: '800', fontSize: 14 },
})
