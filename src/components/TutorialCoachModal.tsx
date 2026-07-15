import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { C } from '../theme'

export type CoachStep = {
  emoji: string
  eyebrow: string
  title: string
  description: string
  hint?: string
}

export function TutorialCoachModal({
  visible,
  step,
  stepIndex,
  total,
  onPrevious,
  onNext,
  onSkip,
  nextLabel,
}: {
  visible: boolean
  step: CoachStep
  stepIndex: number
  total: number
  onPrevious?: () => void
  onNext: () => void
  onSkip: () => void
  nextLabel?: string
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <View style={styles.focusRing} pointerEvents="none" />
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.progress}>{stepIndex + 1} / {total}</Text>
            <TouchableOpacity onPress={onSkip} hitSlop={10}>
              <Text style={styles.skip}>건너뛰기</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.emoji}>{step.emoji}</Text>
          <Text style={styles.eyebrow}>{step.eyebrow}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
          {!!step.hint && <Text style={styles.hint}>{step.hint}</Text>}
          <View style={styles.dots}>
            {Array.from({ length: total }).map((_, index) => (
              <View key={index} style={[styles.dot, index === stepIndex && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.actions}>
            {onPrevious ? (
              <TouchableOpacity style={styles.previousButton} onPress={onPrevious}>
                <Text style={styles.previousText}>이전</Text>
              </TouchableOpacity>
            ) : <View style={styles.previousPlaceholder} />}
            <TouchableOpacity style={styles.nextButton} onPress={onNext}>
              <Text style={styles.nextText}>{nextLabel || '다음'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(5,18,13,0.68)', justifyContent: 'flex-end', padding: 18, paddingBottom: 26 },
  focusRing: { position: 'absolute', top: 68, left: 18, right: 18, height: 185, borderRadius: 26, borderWidth: 3, borderColor: 'rgba(255,255,255,0.92)', backgroundColor: 'rgba(255,255,255,0.05)' },
  card: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 24, padding: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progress: { color: C.muted, fontSize: 12, fontWeight: '900' },
  skip: { color: C.muted, fontSize: 13, fontWeight: '900' },
  emoji: { fontSize: 44, marginTop: 12, textAlign: 'center' },
  eyebrow: { color: C.greenDark, fontSize: 13, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  title: { color: C.text, fontSize: 21, lineHeight: 29, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  description: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  hint: { color: C.text, backgroundColor: '#F3F8F5', borderRadius: 13, padding: 11, fontSize: 12, lineHeight: 18, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D9E2DD' },
  dotActive: { width: 22, backgroundColor: C.greenDark },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 18 },
  previousPlaceholder: { width: 82 },
  previousButton: { width: 82, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1EF' },
  previousText: { color: C.text, fontSize: 14, fontWeight: '900' },
  nextButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.greenDark, paddingHorizontal: 14 },
  nextText: { color: '#fff', fontSize: 14, fontWeight: '900' },
})
