import { PropsWithChildren, useEffect, useRef } from 'react'
import { Animated, Easing, type ViewStyle } from 'react-native'

import { motion, spacing } from '../../../design/tokens'

type PremiumHomeMotionProps = PropsWithChildren<{
  index: number
  style?: ViewStyle
}>

export function PremiumHomeMotion({ children, index: _index, style }: PremiumHomeMotionProps) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(spacing.lg)).current

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ])

    animation.start()

    return () => animation.stop()
  }, [opacity, translateY])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}