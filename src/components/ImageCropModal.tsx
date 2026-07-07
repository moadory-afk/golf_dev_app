import { useRef, useState } from 'react'
import { Image, Modal, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { C } from '../theme'

export type ImageCropRect = {
  originX: number
  originY: number
  width: number
  height: number
}

type Props = {
  uri: string
  width: number
  height: number
  aspect: [number, number]
  title: string
  onCancel: () => void
  onConfirm: (crop: ImageCropRect) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function ImageCropModal({ uri, width, height, aspect, title, onCancel, onConfirm }: Props) {
  const frameWidth = 320
  const aspectValue = aspect[0] / aspect[1]
  const frameHeight = frameWidth / aspectValue
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const lastPinchDistance = useRef<number | null>(null)
  const gestureStartOffset = useRef({ x: 0, y: 0 })

  function getPinchDistance(touches: Array<{ pageX: number; pageY: number }>) {
    if (touches.length < 2) return null
    const [a, b] = touches
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        gestureStartOffset.current = { x: offsetX, y: offsetY }
        lastPinchDistance.current = getPinchDistance(event.nativeEvent.touches as Array<{ pageX: number; pageY: number }>)
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches as Array<{ pageX: number; pageY: number }>
        const pinchDistance = getPinchDistance(touches)
        if (pinchDistance && lastPinchDistance.current) {
          const ratio = pinchDistance / lastPinchDistance.current
          setZoom((value) => clamp(value * ratio, 1, 3))
          lastPinchDistance.current = pinchDistance
          return
        }

        lastPinchDistance.current = null
        setOffsetX(clamp(gestureStartOffset.current.x - gesture.dx / (frameWidth / 2), -1, 1))
        setOffsetY(clamp(gestureStartOffset.current.y - gesture.dy / (frameHeight / 2), -1, 1))
      },
      onPanResponderRelease: () => { lastPinchDistance.current = null },
      onPanResponderTerminate: () => { lastPinchDistance.current = null },
    }),
  ).current

  let baseCropWidth = width
  let baseCropHeight = baseCropWidth / aspectValue
  if (baseCropHeight > height) {
    baseCropHeight = height
    baseCropWidth = baseCropHeight * aspectValue
  }

  const cropWidth = baseCropWidth / zoom
  const cropHeight = baseCropHeight / zoom
  const maxOriginX = Math.max(0, width - cropWidth)
  const maxOriginY = Math.max(0, height - cropHeight)
  const originX = clamp(maxOriginX / 2 + offsetX * (maxOriginX / 2), 0, maxOriginX)
  const originY = clamp(maxOriginY / 2 + offsetY * (maxOriginY / 2), 0, maxOriginY)
  const scale = frameWidth / cropWidth

  const cropOriginX = Math.round(originX)
  const cropOriginY = Math.round(originY)
  const crop: ImageCropRect = {
    originX: cropOriginX,
    originY: cropOriginY,
    width: Math.min(Math.round(cropWidth), width - cropOriginX),
    height: Math.min(Math.round(cropHeight), height - cropOriginY),
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          <View style={[s.frame, { width: frameWidth, height: frameHeight }]} {...panResponder.panHandlers}>
            <Image
              source={{ uri }}
              style={{
                width: width * scale,
                height: height * scale,
                transform: [{ translateX: -originX * scale }, { translateY: -originY * scale }],
              }}
              resizeMode="stretch"
            />
          </View>

          <Text style={s.guideText}>사진을 드래그해서 위치를 맞추고, 두 손가락으로 확대/축소하세요.</Text>

          <View style={s.zoomRow}>
            <TouchableOpacity style={s.controlBtn} onPress={() => setZoom((value) => clamp(value - 0.2, 1, 3))}>
              <Text style={s.controlText}>−</Text>
            </TouchableOpacity>
            <Text style={s.zoomText}>{Math.round(zoom * 100)}%</Text>
            <TouchableOpacity style={s.controlBtn} onPress={() => setZoom((value) => clamp(value + 0.2, 1, 3))}>
              <Text style={s.controlText}>＋</Text>
            </TouchableOpacity>
          </View>

          <View style={s.actionRow}>
            <TouchableOpacity style={[s.actionBtn, s.cancelBtn]} onPress={onCancel}>
              <Text style={s.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.confirmBtn]} onPress={() => onConfirm(crop)}>
              <Text style={s.confirmText}>적용</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: { width: '100%', maxWidth: 390, borderRadius: 20, backgroundColor: '#fff', padding: 18, alignItems: 'center' },
  title: { alignSelf: 'stretch', fontSize: 16, fontWeight: '900', color: C.text, marginBottom: 14 },
  frame: { overflow: 'hidden', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, backgroundColor: '#10291d' },
  guideText: { marginTop: 12, fontSize: 12, lineHeight: 17, fontWeight: '700', color: C.muted, textAlign: 'center' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  controlBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  controlText: { fontSize: 20, fontWeight: '900', color: C.green },
  zoomText: { width: 54, textAlign: 'center', fontSize: 12, fontWeight: '900', color: C.text },
  actionRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 16 },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f2f4f6' },
  confirmBtn: { backgroundColor: C.green },
  cancelText: { fontSize: 13, fontWeight: '900', color: C.muted },
  confirmText: { fontSize: 13, fontWeight: '900', color: '#fff' },
})
