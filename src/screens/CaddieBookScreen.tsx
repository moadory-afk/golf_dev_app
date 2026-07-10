import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GPButton, GPCard } from "../design";
import { useSkin } from "../skins";
import { useUserProfile } from "../lib/UserProfileContext";
import { supabase } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/types";
import { useCaddieBook, type CaddieBookHole } from "../features/caddie";
import { radius, spacing, typography } from "../design/tokens";
import {
  getPersonalRoundStat,
  savePersonalRoundStat,
  type PersonalRoundFir,
  type PersonalRoundHoleStat,
} from "../lib/store";
import { clamp, isCompactWidth } from "../lib/responsive";

type CaddieBookRoute = RouteProp<RootStackParamList, "CaddieBook">;

type CourseLayoutTab = {
  id: string;
  name: string;
  holes?: number | null;
  pars?: number | null;
};
type RoundMeta = {
  clubId: string | null;
  roundDate: string | null;
};

const DEFAULT_TEE_OPTIONS: Array<{ label: string; value: PersonalRoundFir }> = [
  { label: "좌OB", value: "left_ob" },
  { label: "우OB", value: "right_ob" },
  { label: "해저드", value: "hazard" },
];

function todayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultHoleStats(holes: CaddieBookHole[]): PersonalRoundHoleStat[] {
  return holes.map((hole, index) => ({
    hole: hole.holeNo || index + 1,
    par: hole.par || 4,
    fir: null,
    putts: 2,
    penalties: 0,
  }));
}

function EmptyCaddieBook({ onRetry }: { onRetry: () => void }) {
  const { palette } = useSkin();
  return (
    <GPCard style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>📗</Text>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>
        표시할 캐디북이 없습니다
      </Text>
      <Text style={[styles.emptyText, { color: palette.muted }]}>
        홈의 예정 라운드에서 캐디북을 열거나, 라운드 일정에 골프장과 코스를
        연결해 주세요.
      </Text>
      <GPButton
        label="다시 불러오기"
        variant="soft"
        onPress={onRetry}
        style={styles.emptyButton}
      />
    </GPCard>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { palette } = useSkin();
  return (
    <GPCard style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>⚠️</Text>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>
        캐디북을 불러오지 못했습니다
      </Text>
      <Text style={[styles.emptyText, { color: palette.muted }]}>
        {message}
      </Text>
      <GPButton
        label="다시 시도"
        variant="soft"
        onPress={onRetry}
        style={styles.emptyButton}
      />
    </GPCard>
  );
}

function MiniMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "gold" | "danger";
}) {
  const { palette } = useSkin();
  const valueColor =
    tone === "gold"
      ? palette.gold
      : tone === "danger"
        ? palette.danger
        : palette.text;
  return (
    <View
      style={[
        styles.metricBox,
        { backgroundColor: palette.greenLight, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.metricLabel, { color: palette.muted }]}>
        {label}
      </Text>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function compactClubLabel(label?: string | null) {
  const value = (label || "").trim();
  const upper = value.toUpperCase();
  if (!value) return "-";
  if (upper.includes("DRIVER")) return "D";
  if (upper.includes("PUTT")) return "Putt";
  if (upper === "PW") return "P";
  if (upper === "AW") return "A";
  if (upper === "SW") return "S";
  return value.replace(/\s+/g, "");
}

function buildShotPlanStages(
  steps: Array<{ type: string; clubLabel: string; carryM: number }>,
) {
  const tee = steps.find((step) => step.type === "tee") ?? steps[0];
  const second =
    steps.find((step) => step.type === "second") ??
    steps.find((step) => step.type === "approach");
  const third = steps.find((step) => step.type === "second")
    ? steps.find((step) => step.type === "approach")
    : undefined;
  return [
    { key: "tee", title: "Tee", step: tee },
    { key: "second", title: "Second", step: second },
    { key: "third", title: "Third", step: third },
    {
      key: "putt",
      title: "Putt",
      step: { type: "green", clubLabel: "Putt", carryM: 0 },
    },
  ];
}

function CourseLayoutTabs({
  layouts,
  activeLayoutId,
  onSelect,
}: {
  layouts: CourseLayoutTab[];
  activeLayoutId?: string | null;
  onSelect: (layout: CourseLayoutTab) => void;
}) {
  const { palette } = useSkin();
  if (layouts.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.courseTabsContent}
    >
      {layouts.map((layout) => {
        const selected = layout.id === activeLayoutId;
        return (
          <TouchableOpacity
            key={layout.id}
            activeOpacity={0.82}
            onPress={() => onSelect(layout)}
            style={[
              styles.courseTab,
              {
                backgroundColor: selected ? palette.headerBg : palette.card,
                borderColor: selected ? palette.gold : palette.border,
              },
            ]}
          >
            <Text
              style={[
                styles.courseTabText,
                { color: selected ? palette.headerText : palette.text },
              ]}
              numberOfLines={1}
            >
              {layout.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function HolePicker({
  holes,
  selectedHoleNo,
  onSelect,
}: {
  holes: CaddieBookHole[];
  selectedHoleNo: number;
  onSelect: (holeNo: number) => void;
}) {
  const { palette } = useSkin();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.holePickerContent}
    >
      {holes.map((hole) => {
        const selected = hole.holeNo === selectedHoleNo;
        return (
          <TouchableOpacity
            key={hole.id}
            activeOpacity={0.82}
            onPress={() => onSelect(hole.holeNo)}
            style={[
              styles.holePickerItem,
              {
                backgroundColor: selected ? palette.headerBg : palette.card,
                borderColor: selected ? palette.gold : palette.border,
              },
            ]}
          >
            <Text
              style={[
                styles.holePickerNo,
                { color: selected ? palette.headerText : palette.text },
              ]}
            >
              {hole.holeNo}
            </Text>
            <Text
              style={[
                styles.holePickerMeta,
                { color: selected ? palette.gold : palette.muted },
              ]}
            >
              PAR {hole.par ?? "-"}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function CourseHoleInfoBar({
  hole,
  layoutName,
}: {
  hole: CaddieBookHole;
  layoutName?: string | null;
}) {
  const { palette } = useSkin();
  const courseLabel = layoutName
    ? `${layoutName} ${hole.holeNo}번`
    : `${hole.holeNo}번`;
  const distances = [
    { color: "#2F73D9", value: hole.blueTeeM },
    { color: "#9AA5A0", value: hole.whiteTeeM },
    { color: "#DE544B", value: hole.redTeeM },
  ].filter(
    (item) => typeof item.value === "number" && Number.isFinite(item.value),
  );

  return (
    <View
      style={[
        styles.courseInfoBar,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
    >
      <Text
        style={[styles.courseInfoTitle, { color: palette.text }]}
        numberOfLines={1}
      >
        {courseLabel} (Par {hole.par ?? "-"})
      </Text>
      <View style={styles.courseDistanceRow}>
        {distances.map((item) => (
          <View
            key={`${item.color}-${item.value}`}
            style={styles.courseDistanceItem}
          >
            <View
              style={[
                styles.courseDistanceDot,
                { backgroundColor: item.color },
              ]}
            />
            <Text style={[styles.courseDistanceText, { color: palette.muted }]}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function HoleDetailCard({
  hole,
  width,
  height,
  compact,
  onCardScrollBegin,
  onCardScrollEnd,
}: {
  hole: CaddieBookHole;
  width: number;
  height: number;
  compact: boolean;
  onCardScrollBegin?: () => void;
  onCardScrollEnd?: () => void;
}) {
  const { palette } = useSkin();
  const [flipped, setFlipped] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;
  const frontTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const frontTouchMovedRef = useRef(false);
  const shotPlan = hole.shotPlan;
  const planSteps = shotPlan?.steps?.length
    ? shotPlan.steps
    : [
        {
          type: "tee" as const,
          label: "Tee Shot",
          clubLabel: hole.recommendedClub || "Driver",
          carryM: hole.teeDistanceM || 0,
          remainingAfterM: Math.max(0, (hole.teeDistanceM || 0) - 155),
        },
        {
          type: "second" as const,
          label: "Second",
          clubLabel: "4H",
          carryM: 155,
          remainingAfterM: 0,
        },
        {
          type: "green" as const,
          label: "Green",
          clubLabel: "Putt",
          carryM: 0,
          remainingAfterM: 0,
        },
      ];

  useEffect(() => {
    Animated.spring(flip, {
      toValue: flipped ? 1 : 0,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [flip, flipped]);

  const frontRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });
  const timelineWidth = Math.max(width - 64, planSteps.length * 72);
  const handleFrontTouchStart = (event: any) => {
    frontTouchMovedRef.current = false;
    frontTouchStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  };
  const handleFrontTouchMove = (event: any) => {
    const start = frontTouchStartRef.current;
    if (!start) return;
    const dx = Math.abs(event.nativeEvent.pageX - start.x);
    const dy = Math.abs(event.nativeEvent.pageY - start.y);
    if (dx > 8 || dy > 8) frontTouchMovedRef.current = true;
  };
  const handleFrontTouchEnd = () => {
    if (!frontTouchMovedRef.current) setFlipped(true);
    frontTouchStartRef.current = null;
  };

  return (
    <View style={[styles.flipShell, { width, height }]}>
      <Animated.View
        pointerEvents={flipped ? "none" : "auto"}
        style={[
          styles.flipFace,
          { transform: [{ perspective: 900 }, { rotateY: frontRotate }] },
        ]}
      >
        <GPCard
          style={[
            styles.heroCard,
            compact && styles.heroCardCompact,
            { height, backgroundColor: palette.headerBg },
          ]}
        >
          <ScrollView
            style={styles.heroCardScroller}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            directionalLockEnabled
            onTouchStart={handleFrontTouchStart}
            onTouchMove={handleFrontTouchMove}
            onTouchEnd={handleFrontTouchEnd}
            onScrollBeginDrag={onCardScrollBegin}
            onScrollEndDrag={onCardScrollEnd}
            onMomentumScrollEnd={onCardScrollEnd}
            contentContainerStyle={styles.heroCardScrollContent}
          >
            <View style={styles.detailHeroHeader}>
              <View style={styles.detailTitleWrap}>
                <Text style={[styles.heroEyebrow, { color: palette.gold }]}>
                  Hole {hole.holeNo}
                </Text>
                <Text
                  style={[styles.heroTitle, { color: palette.headerText }]}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  numberOfLines={2}
                >
                  {hole.title}
                </Text>
              </View>
              <View
                style={[
                  styles.parPill,
                  { backgroundColor: palette.greenLight },
                ]}
              >
                <Text style={[styles.parText, { color: palette.green }]}>
                  PAR {hole.par ?? "-"}
                </Text>
              </View>
            </View>
            <Text style={[styles.heroMessage, { color: palette.headerText }]}>
              {hole.summary}
            </Text>
            {!!hole.strategy && (
              <Text
                style={[styles.heroSubMessage, { color: palette.headerText }]}
              >
                {hole.strategy}
              </Text>
            )}
            {!!hole.caution && (
              <Text style={[styles.heroWarning, { color: palette.gold }]}>
                주의 · {hole.caution}
              </Text>
            )}
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setFlipped(true)}
              style={styles.flipAction}
            >
              <Text style={[styles.flipHint, { color: palette.headerText }]}>
                AI Shot Plan 보기
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </GPCard>
      </Animated.View>

      <Animated.View
        pointerEvents={flipped ? "auto" : "none"}
        style={[
          styles.flipFace,
          styles.flipBackFace,
          { transform: [{ perspective: 900 }, { rotateY: backRotate }] },
        ]}
      >
        <GPCard
          style={[
            styles.heroCard,
            compact && styles.heroCardCompact,
            styles.shotPlanBackCard,
            {
              height,
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}
        >
          <ScrollView
            style={styles.heroCardScroller}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            directionalLockEnabled
            onScrollBeginDrag={onCardScrollBegin}
            onScrollEndDrag={onCardScrollEnd}
            onMomentumScrollEnd={onCardScrollEnd}
            contentContainerStyle={styles.heroCardScrollContent}
          >
            <View style={styles.safeHeaderRow}>
              <View style={styles.safeTitleWrap}>
                <Text style={[styles.heroEyebrow, { color: palette.green }]}>
                  AI Shot Plan
                </Text>
                <View style={styles.safeModeRow}>
                  <Text style={styles.safeDot}>●</Text>
                  <Text
                    style={[styles.safeTitle, { color: palette.text }]}
                    numberOfLines={1}
                  >
                    {shotPlan?.modeLabel || "SAFE"} ·{" "}
                    {shotPlan?.compact ||
                      hole.planHeadline ||
                      `${hole.holeNo}번 홀 공략`}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.confidencePill,
                  {
                    backgroundColor: palette.greenLight,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text
                  style={[styles.confidenceValue, { color: palette.green }]}
                >
                  {shotPlan?.confidence ?? 89}%
                </Text>
                <Text
                  style={[styles.confidenceLabel, { color: palette.muted }]}
                >
                  신뢰도
                </Text>
              </View>
            </View>

            <View style={styles.shotPlanGraphic}>
              <View style={styles.shotPlanStageHeaderRow}>
                {buildShotPlanStages(planSteps).map((stage) => (
                  <Text
                    key={`${stage.key}-title`}
                    style={[
                      styles.shotPlanStageTitle,
                      { color: palette.muted },
                    ]}
                    numberOfLines={1}
                  >
                    {stage.title}
                  </Text>
                ))}
              </View>
              <View style={styles.shotPlanClubRow}>
                {buildShotPlanStages(planSteps).map((stage, index) => {
                  const active = Boolean(stage.step);
                  const isPutt = stage.key === "putt";
                  return (
                    <View
                      key={`${stage.key}-club`}
                      style={styles.shotPlanStageCell}
                    >
                      <View
                        style={[
                          styles.shotPlanClubBadge,
                          {
                            backgroundColor: active
                              ? palette.greenLight
                              : "rgba(0,0,0,0.04)",
                            borderColor: active
                              ? palette.green
                              : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.shotPlanClubText,
                            { color: active ? palette.text : palette.muted },
                          ]}
                          numberOfLines={1}
                        >
                          {isPutt
                            ? "Putt"
                            : compactClubLabel(stage.step?.clubLabel)}
                        </Text>
                      </View>
                      {index < 3 && (
                        <View
                          pointerEvents="none"
                          style={[
                            styles.shotPlanConnector,
                            { backgroundColor: palette.border },
                          ]}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
              <View style={styles.shotPlanDistanceRow}>
                {buildShotPlanStages(planSteps).map((stage) => {
                  const distance =
                    stage.step?.carryM && stage.key !== "putt"
                      ? `${stage.step.carryM}m`
                      : "";
                  return (
                    <Text
                      key={`${stage.key}-distance`}
                      style={[
                        styles.shotPlanDistanceText,
                        { color: palette.green },
                      ]}
                      numberOfLines={1}
                    >
                      {distance}
                    </Text>
                  );
                })}
              </View>
            </View>

            <View style={styles.planMetricRow}>
              <MiniMetric
                label="예상타수"
                value={shotPlan?.expectedStrokes?.toFixed(1) || "4.4"}
                tone="gold"
              />
              <MiniMetric
                label="구간"
                value={shotPlan?.expectedScoreLabel || "Par ~ Bogey"}
              />
              <MiniMetric
                label="난이도"
                value={shotPlan?.difficultyLabel || "NORMAL"}
                tone="gold"
              />
            </View>

            <View
              style={[
                styles.probabilityBox,
                {
                  backgroundColor: palette.greenLight,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={[styles.probabilityTitle, { color: palette.text }]}>
                스코어 확률
              </Text>
              <View style={styles.probabilityRow}>
                <Text
                  style={[styles.probabilityItem, { color: palette.green }]}
                >
                  Par {shotPlan?.probability.par ?? 62}%
                </Text>
                <Text style={[styles.probabilityItem, { color: palette.gold }]}>
                  Bogey {shotPlan?.probability.bogey ?? 26}%
                </Text>
                <Text
                  style={[styles.probabilityItem, { color: palette.danger }]}
                >
                  Double {shotPlan?.probability.double ?? 12}%
                </Text>
              </View>
            </View>

            <Text style={[styles.shotPlanReason, { color: palette.text }]}>
              {shotPlan?.reason ||
                hole.planMessage ||
                "안전한 구간으로 공략하면 그린 앞까지 안정적으로 연결됩니다."}
            </Text>
            {!!shotPlan?.mission && (
              <Text style={[styles.shotPlanMission, { color: palette.muted }]}>
                {shotPlan.mission}
              </Text>
            )}
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setFlipped(false)}
              style={styles.flipAction}
            >
              <Text style={[styles.flipHint, { color: palette.text }]}>
                홀 공략으로 돌아가기
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </GPCard>
      </Animated.View>
    </View>
  );
}

function DailyScoreInputPanel({
  hole,
  editable,
  saving,
  stat,
  onChange,
}: {
  hole: CaddieBookHole;
  editable: boolean;
  saving: boolean;
  stat?: PersonalRoundHoleStat;
  onChange: (patch: Partial<PersonalRoundHoleStat>) => void;
}) {
  const { palette } = useSkin();
  if (!editable) return null;

  const currentStat = stat ?? {
    hole: hole.holeNo,
    par: hole.par || 4,
    fir: null,
    putts: 2,
    penalties: 0,
  };
  const firDisabled = (hole.par ?? currentStat.par) === 3;

  return (
    <View
      style={[
        styles.dailyScorePanel,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
    >
      <View style={styles.dailyScoreHeaderRow}>
        <View>
          <Text style={[styles.dailyScoreTitle, { color: palette.text }]}>
            홀별 스코어 입력
          </Text>
        </View>
        {saving ? (
          <ActivityIndicator size="small" color={palette.green} />
        ) : null}
      </View>

      <View style={styles.dailyScoreRow}>
        <Text
          style={[
            styles.dailyScoreLabel,
            { color: firDisabled ? palette.muted : palette.text },
          ]}
        >
          티샷
        </Text>
        <View style={styles.dailyScoreOptions}>
          {DEFAULT_TEE_OPTIONS.map((option) => {
            const selected = currentStat.fir === option.value;
            return (
              <TouchableOpacity
                key={option.label}
                activeOpacity={0.82}
                disabled={firDisabled}
                onPress={() => onChange({ fir: selected ? null : option.value })}
                style={[
                  styles.dailyScoreOption,
                  firDisabled && styles.dailyScoreOptionDisabled,
                  {
                    borderColor: selected ? palette.green : palette.border,
                    backgroundColor: selected
                      ? palette.greenLight
                      : "rgba(0,0,0,0.035)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dailyScoreOptionText,
                    {
                      color: firDisabled
                        ? palette.muted
                        : selected
                          ? palette.green
                          : palette.muted,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.dailyScoreRow}>
        <Text style={[styles.dailyScoreLabel, { color: palette.text }]}>
          퍼팅수
        </Text>
        <View style={styles.dailyScoreOptions}>
          {[0, 1, 2, 3, 4].map((putts) => {
            const selected = currentStat.putts === putts;
            return (
              <TouchableOpacity
                key={`putt-${putts}`}
                activeOpacity={0.82}
                onPress={() => onChange({ putts })}
                style={[
                  styles.dailyScoreOption,
                  {
                    borderColor: selected ? palette.green : palette.border,
                    backgroundColor: selected
                      ? palette.greenLight
                      : "rgba(0,0,0,0.035)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dailyScoreOptionText,
                    { color: selected ? palette.green : palette.muted },
                  ]}
                >
                  {putts}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function HoleSwipePager({
  holes,
  selectedIndex,
  onIndexChange,
  width,
  height,
  compact,
}: {
  holes: CaddieBookHole[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  width: number;
  height: number;
  compact: boolean;
}) {
  const pagerRef = useRef<ScrollView>(null);
  const lastIndexRef = useRef(selectedIndex);
  const userScrollingRef = useRef(false);
  const pagerUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);

  useEffect(() => {
    return () => {
      if (pagerUnlockTimerRef.current) clearTimeout(pagerUnlockTimerRef.current);
    };
  }, []);

  useEffect(() => {
    lastIndexRef.current = selectedIndex;
    if (!userScrollingRef.current) {
      pagerRef.current?.scrollTo({ x: selectedIndex * width, animated: true });
    }
  }, [selectedIndex, width]);

  const syncIndexFromOffset = (offsetX: number) => {
    const nextIndex = Math.max(
      0,
      Math.min(Math.round(offsetX / width), holes.length - 1),
    );
    if (nextIndex !== lastIndexRef.current) {
      lastIndexRef.current = nextIndex;
      onIndexChange(nextIndex);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncIndexFromOffset(event.nativeEvent.contentOffset.x);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncIndexFromOffset(event.nativeEvent.contentOffset.x);
    userScrollingRef.current = false;
  };

  const lockPagerForCardScroll = () => {
    if (pagerUnlockTimerRef.current) clearTimeout(pagerUnlockTimerRef.current);
    setPagerScrollEnabled(false);
    pagerUnlockTimerRef.current = setTimeout(() => {
      setPagerScrollEnabled(true);
    }, 900);
  };

  const unlockPagerAfterCardScroll = () => {
    if (pagerUnlockTimerRef.current) clearTimeout(pagerUnlockTimerRef.current);
    pagerUnlockTimerRef.current = null;
    setPagerScrollEnabled(true);
  };

  return (
    <ScrollView
      ref={pagerRef}
      horizontal
      pagingEnabled
      directionalLockEnabled
      disableScrollViewPanResponder
      scrollEnabled={pagerScrollEnabled}
      showsHorizontalScrollIndicator={false}
      onScrollBeginDrag={() => {
        userScrollingRef.current = true;
      }}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onScrollEndDrag={handleScrollEnd}
      onMomentumScrollEnd={handleScrollEnd}
      style={styles.holePager}
    >
      {holes.map((hole) => (
        <HoleDetailCard
          key={hole.id}
          hole={hole}
          width={width}
          height={height}
          compact={compact}
          onCardScrollBegin={lockPagerForCardScroll}
          onCardScrollEnd={unlockPagerAfterCardScroll}
        />
      ))}
    </ScrollView>
  );
}

export default function CaddieBookScreen() {
  const route = useRoute<CaddieBookRoute>();
  const insets = useSafeAreaInsets();
  const { palette } = useSkin();
  const { userId } = useUserProfile();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const params = route.params ?? {};
  const [layoutTabs, setLayoutTabs] = useState<CourseLayoutTab[]>([]);
  const [roundMeta, setRoundMeta] = useState<RoundMeta>({
    clubId: null,
    roundDate: null,
  });
  const [holeStats, setHoleStats] = useState<PersonalRoundHoleStat[]>([]);
  const [scoreSaving, setScoreSaving] = useState(false);
  const [activeLayoutId, setActiveLayoutId] = useState(params.layoutId ?? null);
  const [activeLayoutName, setActiveLayoutName] = useState(
    params.layoutName ?? null,
  );
  const isCompactScreen = isCompactWidth(windowWidth);
  const availableHeight = windowHeight - insets.top - insets.bottom;
  const horizontalPadding = isCompactScreen ? spacing.md : spacing.lg;
  const pagerWidth = Math.max(280, windowWidth - horizontalPadding * 2);
  const strategyCardHeight = clamp(
    Math.round(Math.min(pagerWidth * 0.78, availableHeight * 0.48)),
    isCompactScreen ? 280 : 310,
    availableHeight < 720 ? 360 : 430,
  );
  const { data, loading, error, refresh } = useCaddieBook({
    ...params,
    layoutId: activeLayoutId,
    layoutName: activeLayoutName,
    userId,
  });
  const [selectedHoleNo, setSelectedHoleNo] = useState(1);

  useEffect(() => {
    let alive = true;

    const addUniqueLayout = (
      list: CourseLayoutTab[],
      id?: string | null,
      name?: string | null,
    ) => {
      if (!id) return;
      if (list.some((item) => item.id === id)) return;
      list.push({ id, name: name?.trim() || "코스" });
    };

    async function loadLayouts() {
      if (params.scheduleId) {
        const [{ data: scheduleRow }, { data: groupRows }] = await Promise.all([
          supabase
            .from("club_round_schedules")
            .select("club_id, round_date, layout_id, layout_name")
            .eq("id", params.scheduleId)
            .maybeSingle(),
          supabase
            .from("club_round_groups")
            .select(
              "front_layout_id, front_layout_name, back_layout_id, back_layout_name",
            )
            .eq("schedule_id", params.scheduleId)
            .order("group_no", { ascending: true }),
        ]);
        if (!alive) return;
        setRoundMeta({
          clubId: scheduleRow?.club_id ?? null,
          roundDate: scheduleRow?.round_date ?? null,
        });

        const tabs: CourseLayoutTab[] = [];
        for (const group of groupRows ?? []) {
          addUniqueLayout(tabs, group.front_layout_id, group.front_layout_name);
          addUniqueLayout(tabs, group.back_layout_id, group.back_layout_name);
        }
        addUniqueLayout(
          tabs,
          scheduleRow?.layout_id ?? params.layoutId,
          scheduleRow?.layout_name ?? params.layoutName,
        );

        setLayoutTabs(tabs);
        const initialTab =
          tabs.find((tab) => tab.id === activeLayoutId) ?? tabs[0];
        if (initialTab) {
          setActiveLayoutId(initialTab.id);
          setActiveLayoutName(initialTab.name);
        }
        return;
      }

      if (params.layoutId) {
        setRoundMeta({ clubId: null, roundDate: null });
        setLayoutTabs([
          {
            id: params.layoutId,
            name: params.layoutName || "라운드 코스",
          },
        ]);
        setActiveLayoutId(params.layoutId);
        setActiveLayoutName(params.layoutName ?? null);
        return;
      }
      if (!params.courseId) {
        setRoundMeta({ clubId: null, roundDate: null });
        setLayoutTabs([]);
        return;
      }
      const { data: rows } = await supabase
        .from("course_layouts")
        .select("id, name, holes, pars")
        .eq("golf_course_id", params.courseId)
        .order("name", { ascending: true });
      if (!alive) return;
      const tabs = (rows ?? []) as CourseLayoutTab[];
      setLayoutTabs(tabs);
      if (!activeLayoutId && tabs[0]) {
        setActiveLayoutId(tabs[0].id);
        setActiveLayoutName(tabs[0].name);
      }
    }
    loadLayouts();
    return () => {
      alive = false;
    };
  }, [params.courseId, params.layoutId, params.layoutName, params.scheduleId]);

  useEffect(() => {
    if (data.primaryHole) setSelectedHoleNo(data.primaryHole.holeNo);
  }, [data.primaryHole?.holeNo]);

  useEffect(() => {
    let alive = true;
    async function loadPersonalStats() {
      if (!params.scheduleId || !userId || data.holes.length === 0) {
        setHoleStats(defaultHoleStats(data.holes));
        return;
      }
      try {
        const saved = await getPersonalRoundStat(params.scheduleId, userId);
        if (!alive) return;
        const baseStats = defaultHoleStats(data.holes);
        const savedByHole = new Map(
          (saved?.holeStats ?? []).map((item) => [item.hole, item]),
        );
        setHoleStats(
          baseStats.map((item) => ({
            ...item,
            ...(savedByHole.get(item.hole) ?? {}),
            par: item.par,
          })),
        );
      } catch {
        if (alive) setHoleStats(defaultHoleStats(data.holes));
      }
    }
    loadPersonalStats();
    return () => {
      alive = false;
    };
  }, [data.holes, params.scheduleId, userId]);

  const selectedIndex = useMemo(() => {
    const index = data.holes.findIndex(
      (hole) => hole.holeNo === selectedHoleNo,
    );
    return index >= 0 ? index : 0;
  }, [data.holes, selectedHoleNo]);
  const selectedHole = data.holes[selectedIndex];

  const handleHoleIndexChange = (index: number) => {
    const next = data.holes[index];
    if (next) setSelectedHoleNo(next.holeNo);
  };

  const handleLayoutSelect = (layout: CourseLayoutTab) => {
    setActiveLayoutId(layout.id);
    setActiveLayoutName(layout.name);
    setSelectedHoleNo(1);
  };

  const canEditDailyScore = Boolean(
    params.scheduleId &&
    userId &&
    roundMeta.clubId &&
    roundMeta.roundDate === todayDateKey(),
  );

  const selectedHoleStat = selectedHole
    ? holeStats.find((item) => item.hole === selectedHole.holeNo)
    : undefined;

  const updateSelectedHoleStat = async (
    patch: Partial<PersonalRoundHoleStat>,
  ) => {
    if (!params.scheduleId || !userId || !roundMeta.clubId || !selectedHole)
      return;
    const baseStats = holeStats.length
      ? holeStats
      : defaultHoleStats(data.holes);
    const nextStats = baseStats.map((item) =>
      item.hole === selectedHole.holeNo
        ? {
            ...item,
            ...patch,
            hole: selectedHole.holeNo,
            par: selectedHole.par || item.par || 4,
          }
        : item,
    );
    setHoleStats(nextStats);
    setScoreSaving(true);
    try {
      await savePersonalRoundStat({
        clubId: roundMeta.clubId,
        scheduleId: params.scheduleId,
        userId,
        holeStats: nextStats,
      });
    } catch (error) {
      Alert.alert(
        "저장 실패",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setScoreSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <ScrollView
        scrollEnabled
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.xxl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={palette.green}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>
            {data.courseName}
          </Text>
        </View>

        <CourseLayoutTabs
          layouts={layoutTabs}
          activeLayoutId={activeLayoutId}
          onSelect={handleLayoutSelect}
        />

        {selectedHole ? (
          <CourseHoleInfoBar
            hole={selectedHole}
            layoutName={activeLayoutName || data.layoutName}
          />
        ) : null}

        {loading && data.holes.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={palette.green} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>
              캐디북을 불러오는 중입니다
            </Text>
          </View>
        ) : error ? (
          <ErrorCard message={error} onRetry={refresh} />
        ) : data.holes.length === 0 ? (
          <EmptyCaddieBook onRetry={refresh} />
        ) : selectedHole ? (
          <>
            <HoleSwipePager
              holes={data.holes}
              selectedIndex={selectedIndex}
              onIndexChange={handleHoleIndexChange}
              width={pagerWidth}
              height={strategyCardHeight}
              compact={isCompactScreen}
            />
            {selectedHole ? (
              <DailyScoreInputPanel
                hole={selectedHole}
                editable={canEditDailyScore}
                saving={scoreSaving}
                stat={selectedHoleStat}
                onChange={updateSelectedHoleStat}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  header: { gap: 3 },
  eyebrow: { ...typography.caption, fontWeight: "900", letterSpacing: 0.4 },
  title: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  subtitle: { ...typography.body, fontWeight: "700" },
  loadingBox: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: { ...typography.bodySm, fontWeight: "800" },
  emptyCard: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { ...typography.cardTitle, textAlign: "center" },
  emptyText: { ...typography.body, textAlign: "center" },
  emptyButton: { marginTop: spacing.md },
  courseTabsContent: { gap: spacing.xs, paddingRight: spacing.lg },
  courseTab: {
    minWidth: 64,
    minHeight: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  courseTabText: { ...typography.caption, fontWeight: "900" },
  courseInfoBar: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  courseInfoTitle: { ...typography.bodySm, fontWeight: "900", flex: 1 },
  courseDistanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  courseDistanceItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  courseDistanceDot: { width: 9, height: 9, borderRadius: 5 },
  courseDistanceText: { ...typography.caption, fontWeight: "900" },
  holePickerContent: { gap: spacing.sm, paddingRight: spacing.lg },
  holePickerItem: {
    width: 50,
    minHeight: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  holePickerNo: { fontSize: 17, lineHeight: 21, fontWeight: "900" },
  holePickerMeta: { ...typography.caption, fontWeight: "900" },
  holePager: { overflow: "visible", width: "100%" },
  flipShell: { overflow: "visible" },
  flipFace: { width: "100%", backfaceVisibility: "hidden" },
  flipBackFace: { position: "absolute", left: 0, right: 0, top: 0 },
  heroCard: {
    width: "100%",
    padding: spacing.lg,
    borderRadius: radius.xxl,
    overflow: "hidden",
  },
  heroCardCompact: {
    padding: spacing.md,
  },
  heroCardScroller: { flex: 1 },
  heroCardScrollContent: {
    flexGrow: 1,
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  detailHeroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  detailTitleWrap: { flex: 1, minWidth: 0, flexShrink: 1 },
  heroEyebrow: { ...typography.caption, fontWeight: "900" },
  heroTitle: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  heroMessage: {
    ...typography.body,
    opacity: 0.88,
    fontWeight: "800",
    flexShrink: 1,
  },
  heroSubMessage: {
    ...typography.bodySm,
    opacity: 0.78,
    fontWeight: "800",
    flexShrink: 1,
  },
  heroWarning: { ...typography.bodySm, fontWeight: "900", flexShrink: 1 },
  flipHint: {
    ...typography.caption,
    opacity: 0.7,
    fontWeight: "900",
    textAlign: "right",
    marginTop: "auto",
  },
  flipAction: {
    alignSelf: "flex-end",
    marginTop: "auto",
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
  },
  parPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  parText: { ...typography.caption, fontWeight: "900" },
  metricsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  metricLabel: { ...typography.caption, fontWeight: "900" },
  metricValue: { ...typography.bodySm, fontWeight: "900" },

  safeHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  safeTitleWrap: { flex: 1, minWidth: 0, flexShrink: 1, gap: 3 },
  safeModeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  safeDot: { color: "#2AA35F", fontSize: 14, lineHeight: 18 },
  safeTitle: { ...typography.bodySm, fontWeight: "900", letterSpacing: -0.2 },
  planTimelineScrollContent: { paddingRight: spacing.sm },
  planTimelineWrap: { gap: spacing.sm },
  planTimelineRail: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  planTimelineNodeWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  planTimelineNode: { width: 10, height: 10, borderRadius: 5 },
  planTimelineGreenNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  planTimelineLine: { height: 2, flex: 1, marginHorizontal: spacing.xs },
  planStepLabels: { flexDirection: "row", gap: spacing.sm },
  planStepLabel: { flex: 1, gap: 1 },
  planStepTitle: { ...typography.caption, fontWeight: "900" },
  planStepMeta: { ...typography.caption, fontWeight: "800" },
  planStepRemain: { ...typography.caption, fontWeight: "900" },
  shotPlanGraphic: {
    marginTop: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(42,157,98,0.18)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: "rgba(42,157,98,0.06)",
    gap: spacing.sm,
  },
  shotPlanStageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  shotPlanStageTitle: {
    flex: 1,
    textAlign: "center",
    ...typography.caption,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  shotPlanClubRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  shotPlanStageCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  shotPlanClubBadge: {
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    zIndex: 2,
  },
  shotPlanClubText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  shotPlanConnector: {
    position: "absolute",
    left: "50%",
    right: "-50%",
    height: 2,
    top: 20,
    zIndex: 1,
  },
  shotPlanDistanceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  shotPlanDistanceText: {
    flex: 1,
    textAlign: "center",
    ...typography.caption,
    fontWeight: "900",
  },
  planMetricRow: { flexDirection: "row", gap: spacing.sm },
  shotPlanBackCard: { borderWidth: 1 },
  shotStepList: { gap: spacing.sm },
  shotStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
  },
  shotStepOrder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "900",
    backgroundColor: "rgba(42,157,98,0.12)",
  },
  shotStepBody: { flex: 1, minWidth: 0 },
  shotStepTitle: { ...typography.bodySm, fontWeight: "900" },
  shotStepMeta: { ...typography.caption, fontWeight: "800" },
  shotPlanCard: { padding: spacing.lg, gap: spacing.md },
  shotPlanHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  shotPlanHeaderText: { flex: 1, gap: spacing.xs },
  shotPlanTitle: { ...typography.bodyLg, fontWeight: "900" },
  confidencePill: {
    minWidth: 74,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  confidenceValue: { ...typography.bodySm, fontWeight: "900" },
  confidenceLabel: { ...typography.caption, fontWeight: "900" },
  timelineWrap: { gap: spacing.md },
  timelineRail: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  timelineNodeWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  timelineNode: { width: 12, height: 12, borderRadius: 6 },
  timelineGreenNode: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  timelineLine: { height: 2, flex: 1, marginHorizontal: spacing.xs },
  timelineLabels: { flexDirection: "row", gap: spacing.sm },
  timelineStepLabel: { flex: 1, gap: 2 },
  timelineStepTitle: { ...typography.caption, fontWeight: "900" },
  timelineStepMeta: { ...typography.caption, fontWeight: "800" },
  timelineStepRemain: { ...typography.caption, fontWeight: "900" },
  predictionGrid: { flexDirection: "row", gap: spacing.sm },
  probabilityBox: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  probabilityTitle: { ...typography.bodySm, fontWeight: "900" },
  probabilityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  probabilityItem: { ...typography.caption, fontWeight: "900" },
  shotPlanReason: { ...typography.bodySm, fontWeight: "800", flexShrink: 1 },
  shotPlanMission: { ...typography.bodySm, fontWeight: "900", flexShrink: 1 },
  summaryCard: { padding: spacing.lg, gap: spacing.md },
  summaryHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  summaryTitle: { ...typography.bodyLg, fontWeight: "900" },
  missionPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  missionPillText: { ...typography.caption, fontWeight: "900" },
  summaryMetricRow: { flexDirection: "row", gap: spacing.sm },
  strategyTable: { gap: spacing.xs },
  strategyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
  },
  strategyHoleNo: { ...typography.bodySm, fontWeight: "900", width: 24 },
  strategyCompact: { ...typography.bodySm, fontWeight: "900", flex: 1 },
  strategyExpected: {
    ...typography.bodySm,
    fontWeight: "900",
    width: 42,
    textAlign: "right",
  },

  modeBadge: {
    minWidth: 88,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  modeBadgeText: { ...typography.caption, fontWeight: "900" },
  modeBadgeMeta: { ...typography.caption, fontWeight: "900" },
  aiHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  aiHeaderText: { flex: 1, gap: spacing.xs },
  scoreBox: { gap: spacing.xs },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  scoreLabel: { ...typography.caption, fontWeight: "900", width: 68 },
  scoreStars: { ...typography.bodySm, fontWeight: "900", flex: 1 },
  scoreValue: {
    ...typography.caption,
    fontWeight: "900",
    width: 44,
    textAlign: "right",
  },
  strategyStep: {
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  strategyStepTitle: { ...typography.caption, fontWeight: "900" },
  strategyStepText: { ...typography.bodySm, fontWeight: "800" },
  warningText: { ...typography.bodySm, fontWeight: "900" },
  detailCard: { padding: spacing.lg, gap: spacing.md },
  cardEyebrow: { ...typography.caption, fontWeight: "900" },
  recommendTitle: { ...typography.bodyLg, fontWeight: "900" },
  recommendMessage: { ...typography.bodySm, fontWeight: "700" },
  reasonText: { ...typography.bodySm, fontWeight: "900" },
  dailyScorePanel: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dailyScoreHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dailyScoreTitle: { ...typography.bodySm, fontWeight: "900" },
  dailyScoreSubtitle: {
    ...typography.caption,
    fontWeight: "800",
    marginTop: 2,
  },
  dailyScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dailyScoreLabel: { ...typography.bodySm, fontWeight: "900", width: 52 },
  dailyScoreOptions: { flex: 1, flexDirection: "row", gap: spacing.xs },
  dailyScoreOption: {
    flex: 1,
    minHeight: 32,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  dailyScoreOptionDisabled: { opacity: 0.45 },
  dailyScoreOptionText: { ...typography.bodySm, fontWeight: "900" },
  detailSection: { gap: spacing.xs },
  sectionLabel: { ...typography.caption, fontWeight: "900" },
  sectionText: { ...typography.body, fontWeight: "700" },
  checkRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  checkDot: { ...typography.bodySm, fontWeight: "900" },
  checkText: { ...typography.bodySm, flex: 1, fontWeight: "700" },
  holeNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  navButton: { flex: 1 },
  holeNavText: { ...typography.bodySm, fontWeight: "900" },
});
