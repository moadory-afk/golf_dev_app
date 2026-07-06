import { View } from 'react-native'
import { useSkin } from '../../skins'
import type { GPStyle } from './types'

export function GPDivider({ style }: { style?: GPStyle }) {
  const { palette } = useSkin()
  return <View style={[{ height: 1, backgroundColor: palette.border, alignSelf: 'stretch' }, style]} />
}
