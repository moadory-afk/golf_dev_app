import { useState } from 'react'
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
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
  const frameWidth = 280
  const aspectValue = aspect[0] / aspect[1]
  const frameHeight = frameWidth / aspectValue
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)

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

  function move(dx: number, dy: number) {
    setOffsetX((value) => clamp(value + dx, -1, 1))
    setOffsetY((value) => clamp(value + dy, -1, 1))
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          <View style={[s.frame, { width: frameWidth, height: frameHeight }]}>
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

          <View style={s.zoomRow}>
            <TouchableOpacity style={s.controlBtn} onPress={() => setZoom((value) => clamp(value - 0.2, 1, 3))}>
              <Text style={s.controlText}>축소</Text>
            </TouchableOpacity>
            <Text style={s.zoomText}>{Math.round(zoom * 100)}%</Text>
            <TouchableOpacity style={s.controlBtn} onPress={() => setZoom((value) => clamp(value + 0.2, 1, 3))}>
              <Text style={s.controlText}>확대</Text>
            </TouchableOpacity>
          </View>

          <View style={s.movePad}>
            <TouchableOpacity style={s.moveBtn} onPress={() => move(0, -0.18)}><Text style={s.moveText}>위</Text></TouchableOpacity>
            <View style={s.moveRow}>
              <TouchableOpacity style={s.moveBtn} onPress={() => move(-0.18, 0)}><Text style={s.moveText}>왼쪽</Text></TouchableOpacity>
              <TouchableOpacity style={s.moveBtn} onPress={() => move(0.18, 0)}><Text style={s.moveText}>오른쪽</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={s.moveBtn} onPress={() => move(0, 0.18)}><Text style={s.moveText}>아래</Text></TouchableOpacity>
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
  card: { width: '100%', maxWidth: 360, borderRadius: 20, backgroundColor: '#fff', padding: 18, alignItems: 'center' },
  title: { alignSelf: 'stretch', fontSize: 16, fontWeight: '900', color: C.text, marginBottom: 14 },
  frame: { overflow: 'hidden', borderRadius: 14, backgroundColor: '#eef3ef', borderWidth: 1, borderColor: C.border },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  controlBtn: { borderRadius: 999, backgroundColor: C.greenLight, paddingHorizontal: 14, paddingVertical: 8 },
  controlText: { fontSize: 12, fontWeight: '900', color: C.green },
  zoomText: { width: 54, textAlign: 'center', fontSize: 12, fontWeight: '900', color: C.text },
  movePad: { alignItems: 'center', gap: 6, marginTop: 10 },
  moveRow: { flexDirection: 'row', gap: 52 },
  moveBtn: { minWidth: 54, borderRadius: 12, backgroundColor: '#f2f4f6', paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  moveText: { fontSize: 12, fontWeight: '800', color: C.muted },
  actionRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 16 },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f2f4f6' },
  confirmBtn: { backgroundColor: C.green },
  cancelText: { fontSize: 13, fontWeight: '900', color: C.muted },
  confirmText: { fontSize: 13, fontWeight: '900', color: '#fff' },
})
