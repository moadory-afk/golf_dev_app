import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { C } from '../theme'
import { Icon } from './Icon'

export type SegmentedIconTab<T extends string> = {
  value: T
  label: string
  icon: string
}

type SegmentedIconTabsProps<T extends string> = {
  items: Array<SegmentedIconTab<T>>
  value: T
  onChange: (value: T) => void
}

export function SegmentedIconTabs<T extends string>({
  items,
  value,
  onChange,
}: SegmentedIconTabsProps<T>) {
  return (
    <View style={styles.tabs}>
      {items.map((item) => {
        const active = value === item.value
        return (
          <TouchableOpacity
            key={item.value}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(item.value)}
            activeOpacity={0.86}
          >
            <View style={styles.tabContent}>
              <Icon
                name={item.icon as any}
                size={13}
                color={active ? C.green : C.muted}
                strokeWidth={2}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {item.label}
              </Text>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: C.greenLight,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 0,
    borderRadius: 50,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 50,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabText: {
    fontSize: 15,
    color: C.muted,
    fontWeight: '700',
  },
  tabTextActive: {
    color: C.green,
    fontWeight: '900',
  },
})
