import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { useRef, useState, type ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useClub } from '../lib/ClubContext'
import { shortName } from '../lib/store'
import { UserAvatarBtn } from './UserAvatar'
import { useSkin } from '../skins'
import { Icon } from './Icon'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function AppHeader({ myName, showSettings = false, rightExtra }: {
  myName: string | null
  showSettings?: boolean
  rightExtra?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const { palette, isModern } = useSkin()
  const nav = useNavigation<Nav>()
  const { activeClub: club, myClubs, setActiveClub } = useClub()
  const badgeRef = useRef<View>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; w: number } | null>(null)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요'
  const mutedHeaderText = palette.headerBg === '#ffffff' ? palette.muted : 'rgba(255,255,255,0.72)'
  const softHeaderBg = palette.headerBg === '#ffffff' ? palette.greenLight : 'rgba(255,255,255,0.15)'
  const softHeaderBorder = palette.headerBg === '#ffffff' ? palette.border : 'rgba(255,255,255,0.25)'

  function openMenu() {
    badgeRef.current?.measureInWindow((x, y, w, h) => setMenu({ x, y: y + h + 4, w: Math.max(w, 180) }))
  }

  return (
    <View style={[s.header, { paddingTop: insets.top + 16, backgroundColor: palette.headerBg }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.greeting, { color: mutedHeaderText }]} numberOfLines={1}>
          {myName ? <Text style={[s.greetingName, { color: palette.headerText }]}>{shortName(myName)}님 </Text> : null}
          {greeting}.
        </Text>
        <View style={s.identityRow}>
          {club && (
            <View ref={badgeRef} collapsable={false}>
              <TouchableOpacity
                style={[s.clubBadge, { backgroundColor: softHeaderBg, borderColor: isModern ? palette.accent : softHeaderBorder }]}
                onPress={openMenu}
                activeOpacity={0.7}
              >
                {isModern && <Icon name="flag" size={13} color={palette.accent} strokeWidth={2} />}
                <Text style={[s.clubBadgeText, { color: palette.headerText }]} numberOfLines={1}>{isModern ? '' : '⛳ '}{club.name}</Text>
                {isModern
                  ? <Icon name="chevronDown" size={13} color={palette.headerText} />
                  : <Text style={[s.caret, { color: palette.headerText }]}>▾</Text>}
              </TouchableOpacity>
            </View>
          )}
          {showSettings && club && (
            <TouchableOpacity
              style={[s.memberBtn, { backgroundColor: softHeaderBg, borderColor: softHeaderBorder }]}
              onPress={() => nav.navigate('Main', { screen: 'Club', params: { openManageMenu: true } })}
            >
              {isModern
                ? <Icon name="settings" size={12} color={palette.headerText} />
                : <Text style={{ fontSize: 11 }}>⚙️</Text>}
              <Text style={[s.memberBtnText, { color: palette.headerText }]}>설정</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.right}>
        {rightExtra}
        <UserAvatarBtn size={46} />
      </View>

      {menu && (
        <Modal transparent animationType="fade" onRequestClose={() => setMenu(null)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMenu(null)}>
            <View style={[s.menu, { left: menu.x, top: menu.y, minWidth: menu.w, backgroundColor: palette.card, borderColor: palette.border }]}>
              {myClubs.map((c) => {
                const active = c.id === club?.id
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.menuItem, active && { backgroundColor: palette.greenLight }]}
                    onPress={() => { setActiveClub(c); setMenu(null) }}
                  >
                    <Text style={[s.menuText, { color: active ? palette.green : palette.text, fontWeight: active ? '800' : '500' }]} numberOfLines={1}>⛳ {c.name}</Text>
                    {active && (isModern
                      ? <Icon name="check" size={14} color={palette.green} strokeWidth={2.4} />
                      : <Text style={[s.check, { color: palette.green }]}>✓</Text>)}
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
    paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  greeting: { fontSize: 14, marginBottom: 8 },
  greetingName: { fontSize: 14, fontWeight: '800' },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clubBadge: {
    borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, maxWidth: 150,
    borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  clubBadgeText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  caret: { fontSize: 11, marginLeft: 4 },
  memberBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 4,
    borderWidth: 1,
  },
  memberBtnText: { fontSize: 10, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  menu: {
    position: 'absolute', borderRadius: 12, paddingVertical: 6, maxWidth: 260, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  menuText: { fontSize: 14 },
  check: { fontWeight: '800', fontSize: 14 },
})
