import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSkin } from '../skins'
import { TopActionButtons } from './TopActionButtons'

export function AppHeader({ myName: _myName }: { myName: string | null }) {
  const insets = useSafeAreaInsets()
  const { palette } = useSkin()

  return (
    <View style={[s.header, { paddingTop: insets.top + 10, backgroundColor: palette.headerBg }]}> 
      <TopActionButtons />
    </View>
  )
}

const s = StyleSheet.create({
  header: {
    paddingBottom: 12,
  },
})
