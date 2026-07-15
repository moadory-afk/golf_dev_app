import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { C } from '../theme'

export function FeatureFirstUseModal({ visible, emoji, title, description, onClose }: { visible: boolean; emoji: string; title: string; description: string; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.badge}>처음 이용 안내</Text>
          <Text style={s.emoji}>{emoji}</Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.description}>{description}</Text>
          <TouchableOpacity style={s.button} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.buttonText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(5,18,13,0.68)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 430, backgroundColor: '#fff', borderRadius: 24, padding: 22, alignItems: 'center' },
  badge: { color: C.greenDark, backgroundColor: '#EEF7F1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: '900' },
  emoji: { fontSize: 48, marginTop: 16 },
  title: { color: C.text, fontSize: 21, lineHeight: 29, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  description: { color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 11 },
  button: { width: '100%', minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.greenDark, marginTop: 22 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
})
