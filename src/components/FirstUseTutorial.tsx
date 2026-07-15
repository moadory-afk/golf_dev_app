import { useEffect, useMemo, useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { C } from '../theme'
import { hasCompletedTutorial, markTutorialCompleted, subscribeTutorialOpen } from '../lib/tutorial'

type TutorialStep = {
  emoji: string
  eyebrow: string
  title: string
  description: string
  hint: string
}

const STEPS: TutorialStep[] = [
  {
    emoji: '⛳',
    eyebrow: 'GogoPar 시작하기',
    title: '골프 모임의 모든 순간을\n한곳에서 관리하세요',
    description: '라운드 일정부터 참석, 기록, 시상까지 클럽 운영에 필요한 기능을 간편하게 사용할 수 있습니다.',
    hint: '5단계만 확인하면 바로 시작할 수 있어요.',
  },
  {
    emoji: '🏌️',
    eyebrow: '예정 라운드',
    title: '홈 카드에서 다음 라운드를\n좌우로 넘겨 확인하세요',
    description: '골프장, 티오프 시간, 날씨와 이동 정보를 확인하고 참석 여부도 바로 등록할 수 있습니다.',
    hint: '카드는 한 장씩 자연스럽게 이동합니다.',
  },
  {
    emoji: '🧢',
    eyebrow: 'AI 캐디',
    title: '현재 상황에 필요한 일을\nAI 캐디가 알려드립니다',
    description: '참석 등록, 조 편성, 캐디북 확인, 로또 구매와 결과 등록 등 진행 단계에 맞는 안내를 확인하세요.',
    hint: '안내 카드의 버튼을 누르면 해당 기능으로 이동합니다.',
  },
  {
    emoji: '🏆',
    eyebrow: '클럽과 기록',
    title: '클럽 운영과 경기 기록을\n메뉴에서 한눈에 확인하세요',
    description: '클럽 메뉴에서는 회원·공지·회비를 관리하고, 기록 메뉴에서는 라운드 결과와 시상 내역을 볼 수 있습니다.',
    hint: '하단의 홈 · 클럽 · 기록 메뉴를 이용하세요.',
  },
  {
    emoji: '🎉',
    eyebrow: '준비 완료',
    title: '이제 GogoPar를\n시작해 볼까요?',
    description: '프로필의 “튜토리얼 다시 보기”에서 언제든 이 안내를 다시 확인할 수 있습니다.',
    hint: '즐거운 라운드와 클럽 운영을 시작하세요.',
  },
]

export function FirstUseTutorial({ session }: { session: Session | null }) {
  const [visible, setVisible] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const userId = session?.user?.id
  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1
  const progress = useMemo(() => `${stepIndex + 1} / ${STEPS.length}`, [stepIndex])

  useEffect(() => {
    let active = true
    if (!userId) {
      setVisible(false)
      return () => { active = false }
    }

    hasCompletedTutorial(userId).then((completed) => {
      if (!active || completed) return
      setStepIndex(0)
      setVisible(true)
    })

    return () => { active = false }
  }, [userId])

  useEffect(() => subscribeTutorialOpen(() => {
    setStepIndex(0)
    setVisible(true)
  }), [])

  async function completeTutorial() {
    if (userId) await markTutorialCompleted(userId)
    setVisible(false)
    setStepIndex(0)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={completeTutorial}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.progress}>{progress}</Text>
            <TouchableOpacity onPress={completeTutorial} hitSlop={10}>
              <Text style={styles.skip}>건너뛰기</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.visual}>
            <View style={styles.visualGlow} />
            <Text style={styles.emoji}>{step.emoji}</Text>
          </View>

          <Text style={styles.eyebrow}>{step.eyebrow}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
          <View style={styles.hintBox}>
            <Text style={styles.hintIcon}>✓</Text>
            <Text style={styles.hintText}>{step.hint}</Text>
          </View>

          <View style={styles.dots}>
            {STEPS.map((_, index) => (
              <View key={index} style={[styles.dot, index === stepIndex && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.actions}>
            {stepIndex > 0 ? (
              <TouchableOpacity style={styles.previousButton} onPress={() => setStepIndex((value) => value - 1)}>
                <Text style={styles.previousText}>이전</Text>
              </TouchableOpacity>
            ) : <View style={styles.previousPlaceholder} />}
            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => isLast ? completeTutorial() : setStepIndex((value) => value + 1)}
            >
              <Text style={styles.nextText}>{isLast ? 'GogoPar 시작하기' : '다음'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(5,18,13,0.72)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  card: { width: '100%', maxWidth: 430, backgroundColor: '#fff', borderRadius: 28, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { color: C.muted, fontSize: 12, fontWeight: '800' },
  skip: { color: C.muted, fontSize: 13, fontWeight: '800', paddingVertical: 4 },
  visual: { height: 150, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  visualGlow: { position: 'absolute', width: 118, height: 118, borderRadius: 59, backgroundColor: '#EAF5EF' },
  emoji: { fontSize: 68 },
  eyebrow: { color: C.greenDark, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  title: { color: C.text, fontSize: 23, lineHeight: 32, fontWeight: '900', textAlign: 'center', marginTop: 9 },
  description: { color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 13 },
  hintBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F8F5', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, marginTop: 16 },
  hintIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.greenDark, color: '#fff', textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '900', marginRight: 9 },
  hintText: { flex: 1, color: C.text, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D9E2DD' },
  dotActive: { width: 22, backgroundColor: C.greenDark },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  previousPlaceholder: { width: 84 },
  previousButton: { width: 84, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1EF' },
  previousText: { color: C.text, fontSize: 14, fontWeight: '900' },
  nextButton: { flex: 1, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.greenDark, paddingHorizontal: 16 },
  nextText: { color: '#fff', fontSize: 15, fontWeight: '900' },
})
