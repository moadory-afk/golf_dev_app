import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSkin } from '../skins'
import { Icon, type IconName } from './Icon'
import type { RootStackParamList, MainTabParamList } from '../navigation/types'

type Tab = keyof MainTabParamList

const TABS: { name: Tab; icon: string; line: IconName; label: string }[] = [
  { name: 'Home', icon: '🏠', line: 'home', label: '홈' },
  { name: 'History', icon: '📋', line: 'list', label: '기록' },
  { name: 'Club', icon: '⛳', line: 'flag', label: '클럽' },
]

interface Props {
  active?: Tab
}

export default function AppTabBar({ active }: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const insets = useSafeAreaInsets()
  const { palette, isModern } = useSkin()

  function goTab(screen: Tab) {
    nav.navigate('Main', { screen })
  }

  return (
    <View style={[s.bar, { paddingBottom: insets.bottom || 10, backgroundColor: palette.tabBg, borderTopColor: palette.border }]}>
      {TABS.map((tab) => {
        const isActive = active === tab.name

        if (isModern) {
          return (
            <TouchableOpacity key={tab.name} style={s.tabBtn} onPress={() => goTab(tab.name)} activeOpacity={0.7}>
              <View style={[s.pill, isActive && { backgroundColor: palette.tabActiveBg }]}>
                <Icon name={tab.line} size={20} color={isActive ? palette.accentText : palette.muted} />
              </View>
              <Text style={[s.label, { color: isActive ? palette.text : palette.muted, fontWeight: isActive ? '800' : '600' }]}>{tab.label}</Text>
            </TouchableOpacity>
          )
        }

        return (
          <TouchableOpacity key={tab.name} style={s.tabBtn} onPress={() => goTab(tab.name)}>
            <Text style={{ fontSize: 22 }}>{tab.icon}</Text>
            <Text style={[s.label, { color: isActive ? palette.green : palette.muted, fontWeight: isActive ? '800' : '600' }]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3 },
  pill: { borderRadius: 13, paddingHorizontal: 16, paddingVertical: 4 },
  label: { fontSize: 10 },
})
