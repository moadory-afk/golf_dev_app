import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GPButton, GPCard } from '../design'
import { useSkin } from '../skins'
import { useUserProfile } from '../lib/UserProfileContext'
import type { RootStackParamList } from '../navigation/types'
import { useCaddieBook, type AIShotPlanHole, type AIShotPlanSummary, type CaddieBookHole } from '../features/caddie'
import { radius, spacing, typography } from '../design/tokens'

type CaddieBookRoute = RouteProp<RootStackParamList, 'CaddieBook'>

function EmptyCaddieBook({ onRetry }: { onRetry: () => void }) {
  const { palette } = useSkin()
  return (
    <GPCard style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>📗</Text>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>표시할 캐디북이 없습니다</Text>
      <Text style={[styles.emptyText, { color: palette.muted }]}>홈의 예정 라운드에서 캐디북을 열거나, 라운드 일정에 골프장과 코스를 연결해 주세요.</Text>
      <GPButton label="다시 불러오기" variant="soft" onPress={onRetry} style={styles.emptyButton} />
    </GPCard>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { palette } = useSkin()
  return (
    <GPCard style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>⚠️</Text>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>캐디북을 불러오지 못했습니다</Text>
      <Text style={[styles.emptyText, { color: palette.muted }]}>{message}</Text>
      <GPButton label="다시 시도" variant="soft" onPress={onRetry} style={styles.emptyButton} />
    </GPCard>
  )
}

function SectionTitle({ label, value }: { label: string; value?: string | null }) {
  const { palette } = useSkin()
  if (!value) return null
  return (
    <View style={styles.detailSection}>
      <Text style={[styles.sectionLabel, { color: palette.green }]}>{label}</Text>
      <Text style={[styles.sectionText, { color: palette.text }]}>{value}</Text>
    </View>
  )
}

function MiniMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'gold' | 'danger' }) {
  const { palette } = useSkin()
  const valueColor = tone === 'gold' ? palette.gold : tone === 'danger' ? palette.danger : palette.text
  return (
    <View style={[styles.metricBox, { backgroundColor: palette.greenLight, borderColor: palette.border }]}> 
      <Text style={[styles.metricLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
    </View>
  )
}


function ModeBadge({ mode, confidence }: { mode: string; confidence: number }) {
  const { palette } = useSkin()
  const label = mode === 'SAFE' ? 'SAFE' : mode === 'ATTACK' ? 'ATTACK' : 'BALANCED'
  return (
    <View style={[styles.modeBadge, { backgroundColor: palette.greenLight, borderColor: palette.border }]}> 
      <Text style={[styles.modeBadgeText, { color: palette.green }]}>{label}</Text>
      <Text style={[styles.modeBadgeMeta, { color: palette.muted }]}>{confidence}%</Text>
    </View>
  )
}

function ScoreRow({ label, stars, value }: { label: string; stars: string; value: number }) {
  const { palette } = useSkin()
  return (
    <View style={styles.scoreRow}>
      <Text style={[styles.scoreLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.scoreStars, { color: palette.gold }]}>{stars}</Text>
      <Text style={[styles.scoreValue, { color: palette.text }]}>{value}%</Text>
    </View>
  )
}

function StrategyStep({ title, message }: { title: string; message: string }) {
  const { palette } = useSkin()
  return (
    <View style={[styles.strategyStep, { borderColor: palette.border }]}> 
      <Text style={[styles.strategyStepTitle, { color: palette.green }]}>{title}</Text>
      <Text style={[styles.strategyStepText, { color: palette.text }]}>{message}</Text>
    </View>
  )
}

function HolePicker({ holes, selectedHoleNo, onSelect }: { holes: CaddieBookHole[]; selectedHoleNo: number; onSelect: (holeNo: number) => void }) {
  const { palette } = useSkin()
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.holePickerContent}>
      {holes.map((hole) => {
        const selected = hole.holeNo === selectedHoleNo
        return (
          <TouchableOpacity
            key={hole.id}
            activeOpacity={0.82}
            onPress={() => onSelect(hole.holeNo)}
            style={[
              styles.holePickerItem,
              { backgroundColor: selected ? palette.headerBg : palette.card, borderColor: selected ? palette.gold : palette.border },
            ]}
          >
            <Text style={[styles.holePickerNo, { color: selected ? palette.headerText : palette.text }]}>{hole.holeNo}</Text>
            <Text style={[styles.holePickerMeta, { color: selected ? palette.gold : palette.muted }]}>PAR {hole.par ?? '-'}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}


function ShotPlanTimeline({ plan }: { plan?: AIShotPlanHole | null }) {
  const { palette } = useSkin()
  const steps = plan?.steps ?? []
  if (!plan || steps.length === 0) return null

  return (
    <View style={styles.timelineWrap}>
      <View style={styles.timelineRail}>
        {steps.map((step, index) => (
          <View key={`${step.type}-${index}`} style={styles.timelineNodeWrap}>
            <View style={[styles.timelineNode, { backgroundColor: index === 0 ? palette.gold : palette.green }]} />
            {index < steps.length - 1 && <View style={[styles.timelineLine, { backgroundColor: palette.border }]} />}
          </View>
        ))}
        <View style={styles.timelineNodeWrap}>
          <View style={[styles.timelineGreenNode, { borderColor: palette.green }]} />
        </View>
      </View>
      <View style={styles.timelineLabels}>
        {steps.map((step, index) => (
          <View key={`${step.clubLabel}-${index}`} style={styles.timelineStepLabel}>
            <Text style={[styles.timelineStepTitle, { color: palette.text }]}>{step.clubLabel}</Text>
            <Text style={[styles.timelineStepMeta, { color: palette.muted }]}>{step.carryM}m</Text>
            <Text style={[styles.timelineStepRemain, { color: palette.green }]}>남은 {step.remainingAfterM}m</Text>
          </View>
        ))}
        <View style={styles.timelineStepLabel}>
          <Text style={[styles.timelineStepTitle, { color: palette.text }]}>Green</Text>
          <Text style={[styles.timelineStepMeta, { color: palette.muted }]}>PUTT</Text>
        </View>
      </View>
    </View>
  )
}

function AIShotPlanCard({ plan }: { plan?: AIShotPlanHole | null }) {
  const { palette } = useSkin()
  if (!plan) return null

  return (
    <GPCard style={[styles.shotPlanCard, { backgroundColor: palette.card }]}> 
      <View style={styles.shotPlanHeaderRow}>
        <View style={styles.shotPlanHeaderText}>
          <Text style={[styles.cardEyebrow, { color: palette.green }]}>AI Shot Plan</Text>
          <Text style={[styles.shotPlanTitle, { color: palette.text }]}>{plan.modeLabel} · {plan.compact || '플랜 준비중'}</Text>
        </View>
        <View style={[styles.confidencePill, { borderColor: palette.border, backgroundColor: palette.greenLight }]}> 
          <Text style={[styles.confidenceValue, { color: palette.green }]}>{plan.confidence}%</Text>
          <Text style={[styles.confidenceLabel, { color: palette.muted }]}>신뢰도</Text>
        </View>
      </View>

      <ShotPlanTimeline plan={plan} />

      <View style={styles.predictionGrid}>
        <MiniMetric label="예상타수" value={plan.expectedStrokes.toFixed(1)} tone="gold" />
        <MiniMetric label="구간" value={plan.expectedScoreLabel} />
        <MiniMetric label="난이도" value={plan.difficultyLabel} tone={plan.difficulty === 'HARD' ? 'danger' : 'default'} />
      </View>

      <View style={[styles.probabilityBox, { borderColor: palette.border, backgroundColor: palette.greenLight }]}> 
        <Text style={[styles.probabilityTitle, { color: palette.text }]}>스코어 확률</Text>
        <View style={styles.probabilityRow}>
          <Text style={[styles.probabilityItem, { color: palette.green }]}>Par {plan.probability.par}%</Text>
          <Text style={[styles.probabilityItem, { color: palette.gold }]}>Bogey {plan.probability.bogey}%</Text>
          <Text style={[styles.probabilityItem, { color: palette.danger }]}>Double {plan.probability.double}%</Text>
        </View>
      </View>

      <Text style={[styles.shotPlanReason, { color: palette.text }]}>{plan.reason}</Text>
      <Text style={[styles.shotPlanMission, { color: palette.muted }]}>{plan.mission}</Text>
    </GPCard>
  )
}

function ShotPlanSummaryCard({ summary }: { summary?: AIShotPlanSummary }) {
  const { palette } = useSkin()
  if (!summary || summary.compactRows.length === 0) return null

  return (
    <GPCard style={styles.summaryCard}>
      <View style={styles.summaryHeaderRow}>
        <View>
          <Text style={[styles.cardEyebrow, { color: palette.green }]}>18 Hole Strategy</Text>
          <Text style={[styles.summaryTitle, { color: palette.text }]}>오늘 AI 예상 {summary.expectedScore}타</Text>
        </View>
        <View style={[styles.missionPill, { backgroundColor: palette.headerBg }]}> 
          <Text style={[styles.missionPillText, { color: palette.headerText }]}>목표 {summary.missionScore}타</Text>
        </View>
      </View>

      <View style={styles.summaryMetricRow}>
        <MiniMetric label="Par" value={`${summary.parCount}`} />
        <MiniMetric label="Bogey" value={`${summary.bogeyCount}`} tone="gold" />
        <MiniMetric label="Double" value={`${summary.doubleCount}`} tone="danger" />
      </View>

      <View style={styles.strategyTable}>
        {summary.compactRows.slice(0, 18).map((row) => (
          <View key={row.holeNo} style={[styles.strategyRow, { borderColor: palette.border }]}> 
            <Text style={[styles.strategyHoleNo, { color: palette.green }]}>{row.holeNo}</Text>
            <Text style={[styles.strategyCompact, { color: palette.text }]} numberOfLines={1}>{row.compact}</Text>
            <Text style={[styles.strategyExpected, { color: palette.gold }]}>{row.expectedStrokes.toFixed(1)}</Text>
          </View>
        ))}
      </View>
    </GPCard>
  )
}

function HoleDetailCard({ hole }: { hole: CaddieBookHole }) {
  const { palette } = useSkin()
  const advice = hole.advice
  const strategy = advice?.strategy
  const recommendation = advice?.recommendation ?? null
  const effectiveDistance = advice?.effectiveDistance
  const risk = advice?.risk
  const scores = strategy?.scores ?? []
  const sections = strategy?.sections ?? []
  const strategyBullets = strategy?.bullets ?? []
  const checkpoints = hole.checkpoints ?? []
  const effectiveNotes = effectiveDistance?.notes ?? []
  const riskSignals = risk?.signals ?? []
  const bullets = [...strategyBullets, ...checkpoints].filter(Boolean).slice(0, 5)

  return (
    <>
      <GPCard style={[styles.heroCard, { backgroundColor: palette.headerBg }]}> 
        <View style={styles.detailHeroHeader}>
          <View>
            <Text style={[styles.heroEyebrow, { color: palette.gold }]}>Hole {hole.holeNo}</Text>
            <Text style={[styles.heroTitle, { color: palette.headerText }]}>{hole.title}</Text>
          </View>
          <View style={[styles.parPill, { backgroundColor: palette.greenLight }]}> 
            <Text style={[styles.parText, { color: palette.green }]}>PAR {hole.par ?? '-'}</Text>
          </View>
        </View>
        <Text style={[styles.heroMessage, { color: palette.headerText }]}>{hole.summary}</Text>
        <View style={styles.metricsRow}>
          <MiniMetric label="기준 거리" value={hole.teeDistanceM ? `${hole.teeDistanceM}m` : '준비중'} />
          <MiniMetric label="AI 거리" value={hole.effectiveDistanceM ? `${hole.effectiveDistanceM}m` : '-'} tone="gold" />
          <MiniMetric label="위험도" value={hole.riskLabel} tone={risk?.level === 'high' ? 'danger' : 'default'} />
        </View>
      </GPCard>

      <AIShotPlanCard plan={hole.shotPlan} />

      <GPCard style={styles.detailCard}>
        <View style={styles.aiHeaderRow}>
          <View style={styles.aiHeaderText}>
            <Text style={[styles.cardEyebrow, { color: palette.green }]}>🤖 AI Caddie Recommendation</Text>
            <Text style={[styles.recommendTitle, { color: palette.text }]}>{strategy?.title ?? 'AI 공략 준비중'}</Text>
          </View>
          <ModeBadge mode={strategy?.mode ?? 'BALANCED'} confidence={strategy?.confidence ?? 0} />
        </View>
        <Text style={[styles.recommendMessage, { color: palette.muted }]}>{hole.aiStrategyMessage}</Text>
        {!!strategy?.warning && <Text style={[styles.warningText, { color: palette.danger }]}>주의 · {strategy.warning}</Text>}
        <View style={styles.scoreBox}>
          {scores.length > 0 ? scores.map((score) => (
            <ScoreRow key={score.label} label={score.label} stars={score.stars} value={score.value} />
          )) : <Text style={[styles.sectionText, { color: palette.muted }]}>AI 점수 데이터를 준비 중입니다.</Text>}
        </View>
        {!!recommendation?.reason && <Text style={[styles.reasonText, { color: palette.text }]}>추천 근거 · {recommendation.reason}</Text>}
      </GPCard>

      <GPCard style={styles.detailCard}>
        <Text style={[styles.cardEyebrow, { color: palette.green }]}>AI 홀별 공략</Text>
        {sections.length > 0 ? sections.map((section) => (
          <StrategyStep key={section.title} title={section.title} message={section.message} />
        )) : <Text style={[styles.sectionText, { color: palette.muted }]}>홀별 AI 공략을 준비 중입니다.</Text>}
      </GPCard>

      <GPCard style={styles.detailCard}>
        <Text style={[styles.cardEyebrow, { color: palette.green }]}>원본 캐디북</Text>
        <SectionTitle label="전략" value={hole.strategy} />
        <SectionTitle label="주의" value={hole.caution} />
        {!hole.strategy && !hole.caution && <Text style={[styles.sectionText, { color: palette.muted }]}>등록된 세부 공략이 없습니다. AI 추천과 홀 요약을 기준으로 안전하게 플레이하세요.</Text>}
      </GPCard>

      <GPCard style={styles.detailCard}>
        <Text style={[styles.cardEyebrow, { color: palette.green }]}>체크포인트</Text>
        {bullets.length > 0 ? bullets.map((item) => (
          <View key={item} style={styles.checkRow}>
            <Text style={[styles.checkDot, { color: palette.green }]}>✓</Text>
            <Text style={[styles.checkText, { color: palette.muted }]}>{item}</Text>
          </View>
        )) : <Text style={[styles.sectionText, { color: palette.muted }]}>체크포인트를 준비 중입니다.</Text>}
      </GPCard>

      <GPCard style={styles.detailCard}>
        <Text style={[styles.cardEyebrow, { color: palette.green }]}>AI 분석 근거</Text>
        {effectiveNotes.map((note) => (
          <View key={note} style={styles.checkRow}>
            <Text style={[styles.checkDot, { color: palette.gold }]}>•</Text>
            <Text style={[styles.checkText, { color: palette.muted }]}>{note}</Text>
          </View>
        ))}
        {riskSignals.slice(0, 4).map((signal) => (
          <View key={`${signal.key}-${signal.label}`} style={styles.checkRow}>
            <Text style={[styles.checkDot, { color: signal.level === 'high' ? palette.danger : palette.green }]}>•</Text>
            <Text style={[styles.checkText, { color: palette.muted }]}>{signal.label} · {signal.reason}</Text>
          </View>
        ))}
        {effectiveNotes.length === 0 && riskSignals.length === 0 && <Text style={[styles.sectionText, { color: palette.muted }]}>추가 분석 근거를 준비 중입니다.</Text>}
      </GPCard>
    </>
  )
}

function HoleNavigation({ currentIndex, total, onPrev, onNext }: { currentIndex: number; total: number; onPrev: () => void; onNext: () => void }) {
  const { palette } = useSkin()
  return (
    <View style={styles.holeNavRow}>
      <GPButton label="이전 홀" variant="soft" disabled={currentIndex <= 0} onPress={onPrev} style={styles.navButton} />
      <Text style={[styles.holeNavText, { color: palette.muted }]}>{currentIndex + 1} / {total}</Text>
      <GPButton label="다음 홀" variant="primary" disabled={currentIndex >= total - 1} onPress={onNext} style={styles.navButton} />
    </View>
  )
}

export default function CaddieBookScreen() {
  const route = useRoute<CaddieBookRoute>()
  const insets = useSafeAreaInsets()
  const { palette } = useSkin()
  const { userId } = useUserProfile()
  const params = route.params ?? {}
  const { data, loading, error, refresh } = useCaddieBook({ ...params, userId })
  const [selectedHoleNo, setSelectedHoleNo] = useState(1)

  useEffect(() => {
    if (data.primaryHole) setSelectedHoleNo(data.primaryHole.holeNo)
  }, [data.primaryHole?.holeNo])

  const selectedIndex = useMemo(() => {
    const index = data.holes.findIndex((hole) => hole.holeNo === selectedHoleNo)
    return index >= 0 ? index : 0
  }, [data.holes, selectedHoleNo])
  const selectedHole = data.holes[selectedIndex]

  const goPrev = () => {
    const prev = data.holes[selectedIndex - 1]
    if (prev) setSelectedHoleNo(prev.holeNo)
  }

  const goNext = () => {
    const next = data.holes[selectedIndex + 1]
    if (next) setSelectedHoleNo(next.holeNo)
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}> 
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.green} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: palette.green }]}>GogoPar Caddie Book</Text>
          <Text style={[styles.title, { color: palette.text }]}>{data.courseName}</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>{data.layoutName || '코스를 선택하면 홀별 공략이 표시됩니다.'}</Text>
        </View>

        {data.holes.length > 0 && <ShotPlanSummaryCard summary={data.shotPlanSummary} />}

        {loading && data.holes.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={palette.green} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>캐디북을 불러오는 중입니다</Text>
          </View>
        ) : error ? (
          <ErrorCard message={error} onRetry={refresh} />
        ) : data.holes.length === 0 ? (
          <EmptyCaddieBook onRetry={refresh} />
        ) : selectedHole ? (
          <>
            <HolePicker holes={data.holes} selectedHoleNo={selectedHole.holeNo} onSelect={setSelectedHoleNo} />
            <HoleDetailCard hole={selectedHole} />
            <HoleNavigation currentIndex={selectedIndex} total={data.holes.length} onPrev={goPrev} onNext={goNext} />
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  header: { gap: spacing.xs },
  eyebrow: { ...typography.caption, fontWeight: '900', letterSpacing: 0.4 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -1.1 },
  subtitle: { ...typography.body, fontWeight: '700' },
  loadingBox: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { ...typography.bodySm, fontWeight: '800' },
  emptyCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { ...typography.cardTitle, textAlign: 'center' },
  emptyText: { ...typography.body, textAlign: 'center' },
  emptyButton: { marginTop: spacing.md },
  holePickerContent: { gap: spacing.sm, paddingRight: spacing.lg },
  holePickerItem: { width: 58, minHeight: 62, borderRadius: radius.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  holePickerNo: { fontSize: 20, lineHeight: 24, fontWeight: '900' },
  holePickerMeta: { ...typography.caption, fontWeight: '900' },
  heroCard: { padding: spacing.xl, gap: spacing.md },
  detailHeroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  heroEyebrow: { ...typography.caption, fontWeight: '900' },
  heroTitle: { fontSize: 27, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 },
  heroMessage: { ...typography.bodyLg, opacity: 0.86 },
  parPill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  parText: { ...typography.caption, fontWeight: '900' },
  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  metricBox: { flex: 1, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: spacing.md, gap: spacing.xs },
  metricLabel: { ...typography.caption, fontWeight: '900' },
  metricValue: { ...typography.bodySm, fontWeight: '900' },

  shotPlanCard: { padding: spacing.lg, gap: spacing.md },
  shotPlanHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  shotPlanHeaderText: { flex: 1, gap: spacing.xs },
  shotPlanTitle: { ...typography.bodyLg, fontWeight: '900' },
  confidencePill: { minWidth: 74, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center', gap: 2 },
  confidenceValue: { ...typography.bodySm, fontWeight: '900' },
  confidenceLabel: { ...typography.caption, fontWeight: '900' },
  timelineWrap: { gap: spacing.md },
  timelineRail: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  timelineNodeWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  timelineNode: { width: 12, height: 12, borderRadius: 6 },
  timelineGreenNode: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  timelineLine: { height: 2, flex: 1, marginHorizontal: spacing.xs },
  timelineLabels: { flexDirection: 'row', gap: spacing.sm },
  timelineStepLabel: { flex: 1, gap: 2 },
  timelineStepTitle: { ...typography.caption, fontWeight: '900' },
  timelineStepMeta: { ...typography.caption, fontWeight: '800' },
  timelineStepRemain: { ...typography.caption, fontWeight: '900' },
  predictionGrid: { flexDirection: 'row', gap: spacing.sm },
  probabilityBox: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  probabilityTitle: { ...typography.bodySm, fontWeight: '900' },
  probabilityRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  probabilityItem: { ...typography.caption, fontWeight: '900' },
  shotPlanReason: { ...typography.bodySm, fontWeight: '800' },
  shotPlanMission: { ...typography.bodySm, fontWeight: '900' },
  summaryCard: { padding: spacing.lg, gap: spacing.md },
  summaryHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  summaryTitle: { ...typography.bodyLg, fontWeight: '900' },
  missionPill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  missionPillText: { ...typography.caption, fontWeight: '900' },
  summaryMetricRow: { flexDirection: 'row', gap: spacing.sm },
  strategyTable: { gap: spacing.xs },
  strategyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, paddingVertical: spacing.sm },
  strategyHoleNo: { ...typography.bodySm, fontWeight: '900', width: 24 },
  strategyCompact: { ...typography.bodySm, fontWeight: '900', flex: 1 },
  strategyExpected: { ...typography.bodySm, fontWeight: '900', width: 42, textAlign: 'right' },

  modeBadge: { minWidth: 88, borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center', gap: 2 },
  modeBadgeText: { ...typography.caption, fontWeight: '900' },
  modeBadgeMeta: { ...typography.caption, fontWeight: '900' },
  aiHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  aiHeaderText: { flex: 1, gap: spacing.xs },
  scoreBox: { gap: spacing.xs },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreLabel: { ...typography.caption, fontWeight: '900', width: 68 },
  scoreStars: { ...typography.bodySm, fontWeight: '900', flex: 1 },
  scoreValue: { ...typography.caption, fontWeight: '900', width: 44, textAlign: 'right' },
  strategyStep: { borderLeftWidth: 3, paddingLeft: spacing.md, gap: spacing.xs },
  strategyStepTitle: { ...typography.caption, fontWeight: '900' },
  strategyStepText: { ...typography.bodySm, fontWeight: '800' },
  warningText: { ...typography.bodySm, fontWeight: '900' },
  detailCard: { padding: spacing.lg, gap: spacing.md },
  cardEyebrow: { ...typography.caption, fontWeight: '900' },
  recommendTitle: { ...typography.bodyLg, fontWeight: '900' },
  recommendMessage: { ...typography.bodySm, fontWeight: '700' },
  reasonText: { ...typography.bodySm, fontWeight: '900' },
  detailSection: { gap: spacing.xs },
  sectionLabel: { ...typography.caption, fontWeight: '900' },
  sectionText: { ...typography.body, fontWeight: '700' },
  checkRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  checkDot: { ...typography.bodySm, fontWeight: '900' },
  checkText: { ...typography.bodySm, flex: 1, fontWeight: '700' },
  holeNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  navButton: { flex: 1 },
  holeNavText: { ...typography.bodySm, fontWeight: '900' },
})
