import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GPButton, GPCard } from '../design'
import { useSkin } from '../skins'
import { useUserProfile } from '../lib/UserProfileContext'
import type { RootStackParamList } from '../navigation/types'
import { useCaddieBook, type AIShotPlanRoundSummary, type CaddieBookHole } from '../features/caddie'
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


function ShotPlanTimeline({ hole }: { hole: CaddieBookHole }) {
  const { palette } = useSkin()
  const plan = hole.shotPlan
  const steps = plan?.steps ?? []
  return (
    <GPCard style={styles.detailCard}>
      <View style={styles.shotPlanHeaderRow}>
        <View style={styles.aiHeaderText}>
          <Text style={[styles.cardEyebrow, { color: palette.green }]}>AI Shot Plan</Text>
          <Text style={[styles.shotPlanTitle, { color: palette.text }]}>{plan?.shortSummary || '추천 플랜 준비중'}</Text>
        </View>
        <View style={[styles.shotPlanBadge, { backgroundColor: palette.greenLight, borderColor: palette.border }]}> 
          <Text style={[styles.shotPlanBadgeText, { color: palette.green }]}>{plan?.riskLabel ?? 'SAFE'}</Text>
          <Text style={[styles.shotPlanBadgeMeta, { color: palette.muted }]}>{plan?.mode ?? 'SAFE'}</Text>
        </View>
      </View>

      <View style={[styles.predictionBox, { backgroundColor: palette.greenLight, borderColor: palette.border }]}> 
        <View style={styles.predictionItem}>
          <Text style={[styles.metricLabel, { color: palette.muted }]}>예상타수</Text>
          <Text style={[styles.predictionValue, { color: palette.text }]}>{plan?.expectedScoreText ?? '-'}</Text>
        </View>
        <View style={styles.predictionItem}>
          <Text style={[styles.metricLabel, { color: palette.muted }]}>Par 확률</Text>
          <Text style={[styles.predictionValue, { color: palette.gold }]}>{plan?.parProbability ?? 0}%</Text>
        </View>
        <View style={styles.predictionItem}>
          <Text style={[styles.metricLabel, { color: palette.muted }]}>목표</Text>
          <Text style={[styles.predictionValue, { color: palette.green }]}>{plan?.targetScoreLabel ?? 'Par'}</Text>
        </View>
      </View>

      <View style={styles.timelineBox}>
        {steps.length > 0 ? steps.map((step, index) => (
          <View key={`${step.order}-${step.clubLabel}`} style={styles.timelineStep}>
            <View style={[styles.timelineDot, { backgroundColor: index === 0 ? palette.gold : palette.green }]} />
            <View style={styles.timelineContent}>
              <View style={styles.timelineTitleRow}>
                <Text style={[styles.timelineClub, { color: palette.text }]}>{step.clubLabel}</Text>
                <Text style={[styles.timelineDistance, { color: palette.green }]}>{step.plannedDistanceM}m</Text>
              </View>
              <Text style={[styles.timelineNote, { color: palette.muted }]}>{step.note}</Text>
              <Text style={[styles.timelineRemain, { color: palette.muted }]}>남은거리 {step.remainingAfterM}m</Text>
            </View>
          </View>
        )) : <Text style={[styles.sectionText, { color: palette.muted }]}>AI Shot Plan을 준비 중입니다.</Text>}
      </View>

      <Text style={[styles.reasonText, { color: palette.text }]}>AI 한마디 · {plan?.reason ?? '사용자 비거리와 홀 정보를 기준으로 공략을 준비합니다.'}</Text>
    </GPCard>
  )
}

function ShotPlanOverview({ summary, onSelect }: { summary?: AIShotPlanRoundSummary; onSelect: (holeNo: number) => void }) {
  const { palette } = useSkin()
  if (!summary || summary.holes.length === 0) return null
  return (
    <GPCard style={styles.overviewCard}>
      <View style={styles.overviewHeader}>
        <View>
          <Text style={[styles.cardEyebrow, { color: palette.green }]}>18 Hole Shot Plan</Text>
          <Text style={[styles.overviewTitle, { color: palette.text }]}>오늘의 AI 전략표</Text>
        </View>
        <View style={[styles.expectedScorePill, { backgroundColor: palette.headerBg }]}> 
          <Text style={[styles.expectedScoreLabel, { color: palette.gold }]}>Expected</Text>
          <Text style={[styles.expectedScoreValue, { color: palette.headerText }]}>{summary.totalExpectedScore}</Text>
        </View>
      </View>
      <Text style={[styles.overviewMission, { color: palette.muted }]}>{summary.missionText}</Text>
      <View style={styles.missionGrid}>
        <MiniMetric label="Par" value={`${summary.parCount}개`} />
        <MiniMetric label="Bogey" value={`${summary.bogeyCount}개`} />
        <MiniMetric label="Double" value={`${summary.doubleCount}개`} tone="danger" />
      </View>
      <View style={styles.overviewList}>
        {summary.holes.slice(0, 18).map((item) => (
          <TouchableOpacity key={item.holeNo} activeOpacity={0.82} onPress={() => onSelect(item.holeNo)} style={[styles.overviewRow, { borderColor: palette.border }]}> 
            <Text style={[styles.overviewHoleNo, { color: palette.green }]}>{item.holeNo}</Text>
            <Text style={[styles.overviewPlan, { color: palette.text }]} numberOfLines={1}>{item.shortSummary}</Text>
            <Text style={[styles.overviewScore, { color: item.riskLabel === 'DANGER' ? palette.danger : palette.gold }]}>{item.expectedStrokes.toFixed(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </GPCard>
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

      <ShotPlanTimeline hole={hole} />

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
            <ShotPlanOverview summary={data.shotPlanSummary} onSelect={setSelectedHoleNo} />
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


  shotPlanHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  shotPlanTitle: { ...typography.cardTitle },
  shotPlanBadge: { minWidth: 82, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center', gap: 2 },
  shotPlanBadgeText: { ...typography.caption, fontWeight: '900' },
  shotPlanBadgeMeta: { ...typography.caption, fontWeight: '900' },
  predictionBox: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', gap: spacing.sm },
  predictionItem: { flex: 1, gap: spacing.xs },
  predictionValue: { ...typography.bodyLg, fontWeight: '900' },
  timelineBox: { gap: spacing.md },
  timelineStep: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  timelineContent: { flex: 1, gap: spacing.xs },
  timelineTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  timelineClub: { ...typography.bodyLg, fontWeight: '900' },
  timelineDistance: { ...typography.bodySm, fontWeight: '900' },
  timelineNote: { ...typography.bodySm, fontWeight: '700' },
  timelineRemain: { ...typography.caption, fontWeight: '900' },
  overviewCard: { padding: spacing.lg, gap: spacing.md },
  overviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  overviewTitle: { ...typography.sectionTitle },
  expectedScorePill: { borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center', minWidth: 76 },
  expectedScoreLabel: { ...typography.caption, fontWeight: '900' },
  expectedScoreValue: { fontSize: 25, lineHeight: 29, fontWeight: '900' },
  overviewMission: { ...typography.bodySm, fontWeight: '800' },
  missionGrid: { flexDirection: 'row', gap: spacing.sm },
  overviewList: { gap: spacing.xs },
  overviewRow: { minHeight: 42, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  overviewHoleNo: { ...typography.bodySm, fontWeight: '900', width: 24 },
  overviewPlan: { ...typography.bodySm, fontWeight: '900', flex: 1 },
  overviewScore: { ...typography.bodySm, fontWeight: '900', width: 40, textAlign: 'right' },

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
