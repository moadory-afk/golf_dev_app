import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C, isTurf } from '../theme'
import { Icon, type IconName } from './Icon'
import type { RootStackParamList, MainTabParamList } from '../navigation/types'

type Tab = keyof MainTabParamList

// 이모지(legacy) ↔ 라인 아이콘(turf) 동시 정의
const TABS: { name: Tab; icon: string; line: IconName; label: string }[] = [
  { name: 'Home',     icon: '🏠', line: 'home',     label: '홈' },
  { name: 'History',  icon: '📋', line: 'list',     label: '기록' },
  { name: 'Settings', icon: '⚙️', line: 'settings', label: '설정' },
]

interface Props {
  active?: Tab
}

export default function AppTabBar({ active }: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const insets = useSafeAreaInsets()

  function goTab(screen: Tab) {
    nav.navigate('Main', { screen })
  }

  return (
    <View style={[s.bar, { paddingBottom: insets.bottom || 10 }]}>
      {TABS.map((tab) => {
        const isActive = active === tab.name

        // ── 새 디자인: 라임 알약 배경 + 라인 아이콘 ──
        if (isTurf) {
          return (
            <TouchableOpacity key={tab.name} style={s.tabBtn} onPress={() => goTab(tab.name)} activeOpacity={0.7}>
              <View style={[s.pill, isActive && s.pillActive]}>
                <Icon name={tab.line} size={20} color={isActive ? C.accentText : C.muted} />
              </View>
              <Text style={[s.label, isActive && s.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          )
        }

        // ── 기존 디자인: 이모지 ──
        return (
          <TouchableOpacity key={tab.name} style={s.tabBtn} onPress={() => goTab(tab.name)}>
            <Text style={{ fontSize: 22 }}>{tab.icon}</Text>
            <Text style={[s.label, isActive && s.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: isTurf ? 3 : 2 },
  pill: { borderRadius: 13, paddingHorizontal: 16, paddingVertical: 4 },
  pillActive: { backgroundColor: C.accent },
  label: { fontSize: 10, fontWeight: '600', color: C.muted },
  labelActive: { color: isTurf ? C.text : C.green, fontWeight: isTurf ? '700' : '600' },
})
