import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  PanResponder,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native'

export function SwipeDownSheet({
  visible,
  onClose,
  children,
  overlayStyle,
  sheetStyle,
  distance = 760,
}: {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  overlayStyle?: StyleProp<ViewStyle>
  sheetStyle?: StyleProp<ViewStyle>
  distance?: number
}) {
  const translateY = useRef(new Animated.Value(distance)).current
  const opacity = useRef(new Animated.Value(0)).current
  const closingRef = useRef(false)

  useEffect(() => {
    if (!visible) return
    closingRef.current = false
    translateY.setValue(distance)
    opacity.setValue(0)
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 220,
          mass: 0.95,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start()
    })
  }, [distance, opacity, translateY, visible])

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: distance,
        duration: 230,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      closingRef.current = false
      if (finished) onClose()
    })
  }, [distance, onClose, opacity, translateY])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.15,
        onPanResponderGrant: () => translateY.stopAnimation(),
        onPanResponderMove: (_event, gesture) => {
          if (gesture.dy > 0) translateY.setValue(gesture.dy)
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 115 || gesture.vy > 0.85) {
            close()
            return
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 24,
            stiffness: 230,
          }).start()
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 24,
            stiffness: 230,
          }).start()
        },
      }),
    [close, translateY],
  )

  if (!visible) return null

  return (
    <Animated.View style={[styles.overlay, overlayStyle, { opacity, justifyContent: 'flex-end' }]}>
      <TouchableOpacity activeOpacity={1} onPress={close} style={StyleSheet.absoluteFill} />
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.sheet, sheetStyle, { transform: [{ translateY }] }]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
  },
})
