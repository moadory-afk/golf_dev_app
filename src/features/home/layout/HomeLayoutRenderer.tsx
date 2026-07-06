import { StyleSheet, View } from 'react-native'
import type { HomeLayoutDefinition, HomeLayoutSlots } from './homeLayoutTypes'

type Props = {
  layout: HomeLayoutDefinition
  slots: HomeLayoutSlots
}

export function HomeLayoutRenderer({ layout, slots }: Props) {
  return (
    <View style={styles.root}>
      {layout.sections.map((section) => {
        const node = slots[section.slot]
        if (section.visible === false || !node) return null
        return (
          <View
            key={section.key}
            style={{
              paddingHorizontal: section.slot === 'hero' ? 0 : 20,
              marginTop: section.marginTop ?? 0,
              marginBottom: section.marginBottom ?? 0,
              zIndex: section.slot === 'concierge' ? 2 : section.slot === 'hero' ? 1 : 0,
            }}
          >
            {node}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { width: '100%' },
})
