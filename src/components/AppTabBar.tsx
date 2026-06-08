import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C } from '../theme'
import type { RootStackParamList, MainTabParamList } from '../navigation/types'

type Tab = keyof MainTabParamList

const TABS: { name: Tab; icon: string; label: string }[] = [
  { name: 'Home',     icon: '🏠', label: '홈' },
  { name: 'History',  icon: '📋', label: '기록' },
  { name: 'Settings', icon: '⚙️', label: '설정' },
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
  tabBtn: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontSize: 10, fontWeight: '600', color: C.muted },
  labelActive: { color: C.green },
})
