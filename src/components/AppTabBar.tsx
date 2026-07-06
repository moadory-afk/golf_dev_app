import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSkin } from '../skins'
import { colorLayers, radius, spacing, typography } from '../design/tokens'
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

  if (!isModern) {
    return (
      <View style={[s.legacyBar, { paddingBottom: insets.bottom || spacing.md, backgroundColor: palette.tabBg, borderTopColor: palette.border }]}>
        {TABS.map((tab) => {
          const isActive = active === tab.name
          return (
            <TouchableOpacity key={tab.name} style={s.tabBtn} onPress={() => goTab(tab.name)} activeOpacity={0.7}>
              <Text style={s.legacyIcon}>{tab.icon}</Text>
              <Text style={[s.label, { color: isActive ? palette.green : palette.muted, fontWeight: isActive ? '900' : '700' }]}>{tab.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    )
  }

  return (
    <View style={[s.floatingWrap, { paddingBottom: insets.bottom || spacing.md }]} pointerEvents="box-none">
      <View
        style={[
          s.floatingBar,
          {
            backgroundColor: palette.tabBg,
            borderColor: colorLayers.cardHairline,
            shadowColor: palette.greenDark,
            shadowOpacity: palette.shadowOpacity * 2,
          },
        ]}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.name
          return (
            <TouchableOpacity key={tab.name} style={s.tabBtn} onPress={() => goTab(tab.name)} activeOpacity={0.72}>
              <View style={[s.pill, { borderColor: isActive ? palette.gold : palette.border }, isActive && { backgroundColor: palette.tabActiveBg }]}>
                <Icon name={tab.line} size={20} color={isActive ? palette.accentText : palette.muted} strokeWidth={isActive ? 2.3 : 1.8} />
              </View>
              <Text style={[s.label, { color: isActive ? palette.text : palette.muted, fontWeight: isActive ? '900' : '700' }]}>{tab.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  legacyBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  floatingWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: 'transparent',
  },
  floatingBar: {
    minHeight: 72,
    borderRadius: radius.xxl,
    borderWidth: 1,
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pill: {
    minWidth: 48,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legacyIcon: { fontSize: 22 },
  label: { ...typography.caption },
})
