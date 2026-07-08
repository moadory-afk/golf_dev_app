import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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

type CaddieBookRoute = RouteProp<RootStackParamList, "CaddieBook">;

type CourseLayoutTab = {
  id: string;
  name: string;
  holes?: number | null;
  pars?: number | null;
};

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
}: {
  hole: CaddieBookHole;
  width: number;
}) {
  const { palette } = useSkin();
  const [flipped, setFlipped] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;
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

  return (
    <TouchableOpacity
      activeOpacity={0.96}
      onPress={() => setFlipped((next) => !next)}
      style={[styles.flipShell, { width }]}
    >
      <Animated.View
        style={[
          styles.flipFace,
          { transform: [{ perspective: 900 }, { rotateY: frontRotate }] },
        ]}
      >
        <GPCard
          style={[styles.heroCard, { backgroundColor: palette.headerBg }]}
        >
          <View style={styles.detailHeroHeader}>
            <View style={styles.detailTitleWrap}>
              <Text style={[styles.heroEyebrow, { color: palette.gold }]}>
                Hole {hole.holeNo}
              </Text>
              <Text
                style={[styles.heroTitle, { color: palette.headerText }]}
                numberOfLines={2}
              >
                {hole.title}
              </Text>
            </View>
            <View
              style={[styles.parPill, { backgroundColor: palette.greenLight }]}
            >
              <Text style={[styles.parText, { color: palette.green }]}>
                PAR {hole.par ?? "-"}
              </Text>
            </View>
          </View>
          <Text
            style={[styles.heroMessage, { color: palette.headerText }]}
            numberOfLines={4}
          >
            {hole.summary}
          </Text>
          {!!hole.strategy && (
            <Text
              style={[styles.heroSubMessage, { color: palette.headerText }]}
              numberOfLines={4}
            >
              {hole.strategy}
            </Text>
          )}
          {!!hole.caution && (
            <Text
              style={[styles.heroWarning, { color: palette.gold }]}
              numberOfLines={2}
            >
              주의 · {hole.caution}
            </Text>
          )}
          <Text style={[styles.flipHint, { color: palette.headerText }]}>
            탭하면 AI Shot Plan
          </Text>
        </GPCard>
      </Animated.View>

      <Animated.View
        style={[
          styles.flipFace,
          styles.flipBackFace,
          { transform: [{ perspective: 900 }, { rotateY: backRotate }] },
        ]}
      >
        <GPCard
          style={[
            styles.heroCard,
            styles.shotPlanBackCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
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
              <Text style={[styles.confidenceValue, { color: palette.green }]}>
                {shotPlan?.confidence ?? 89}%
              </Text>
              <Text style={[styles.confidenceLabel, { color: palette.muted }]}>
                신뢰도
              </Text>
            </View>
          </View>

          <View style={styles.planTimelineWrap}>
            <View style={styles.planTimelineRail}>
              {planSteps.slice(0, 3).map((step, index) => (
                <View
                  key={`${step.type}-${index}`}
                  style={styles.planTimelineNodeWrap}
                >
                  <View
                    style={[
                      index === 2
                        ? styles.planTimelineGreenNode
                        : styles.planTimelineNode,
                      {
                        backgroundColor:
                          index === 0
                            ? palette.gold
                            : index === 1
                              ? palette.green
                              : palette.card,
                        borderColor: palette.green,
                      },
                    ]}
                  />
                  {index < 2 && (
                    <View
                      style={[
                        styles.planTimelineLine,
                        { backgroundColor: palette.border },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
            <View style={styles.planStepLabels}>
              {planSteps.slice(0, 3).map((step, index) => (
                <View
                  key={`${step.clubLabel}-${index}`}
                  style={styles.planStepLabel}
                >
                  <Text
                    style={[styles.planStepTitle, { color: palette.text }]}
                    numberOfLines={1}
                  >
                    {step.clubLabel}
                  </Text>
                  <Text
                    style={[styles.planStepMeta, { color: palette.muted }]}
                    numberOfLines={1}
                  >
                    {index === 2 ? "PUTT" : `${step.carryM || "-"}m`}
                  </Text>
                  {index < 2 && (
                    <Text
                      style={[styles.planStepRemain, { color: palette.green }]}
                      numberOfLines={1}
                    >
                      남은 {step.remainingAfterM || 0}m
                    </Text>
                  )}
                </View>
              ))}
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
              <Text style={[styles.probabilityItem, { color: palette.green }]}>
                Par {shotPlan?.probability.par ?? 62}%
              </Text>
              <Text style={[styles.probabilityItem, { color: palette.gold }]}>
                Bogey {shotPlan?.probability.bogey ?? 26}%
              </Text>
              <Text style={[styles.probabilityItem, { color: palette.danger }]}>
                Double {shotPlan?.probability.double ?? 12}%
              </Text>
            </View>
          </View>

          <Text
            style={[styles.shotPlanReason, { color: palette.text }]}
            numberOfLines={3}
          >
            {shotPlan?.reason ||
              hole.planMessage ||
              "안전한 구간으로 공략하면 그린 앞까지 안정적으로 연결됩니다."}
          </Text>
          {!!shotPlan?.mission && (
            <Text
              style={[styles.shotPlanMission, { color: palette.muted }]}
              numberOfLines={2}
            >
              {shotPlan.mission}
            </Text>
          )}
        </GPCard>
      </Animated.View>
    </TouchableOpacity>
  );
}

function HoleSwipePager({
  holes,
  selectedIndex,
  onIndexChange,
  width,
}: {
  holes: CaddieBookHole[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  width: number;
}) {
  const pagerRef = useRef<ScrollView>(null);

  useEffect(() => {
    pagerRef.current?.scrollTo({ x: selectedIndex * width, animated: true });
  }, [selectedIndex, width]);

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    onIndexChange(Math.max(0, Math.min(nextIndex, holes.length - 1)));
  };

  return (
    <ScrollView
      ref={pagerRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={handleMomentumEnd}
      style={styles.holePager}
    >
      {holes.map((hole) => (
        <HoleDetailCard key={hole.id} hole={hole} width={width} />
      ))}
    </ScrollView>
  );
}

export default function CaddieBookScreen() {
  const route = useRoute<CaddieBookRoute>();
  const insets = useSafeAreaInsets();
  const { palette } = useSkin();
  const { userId } = useUserProfile();
  const { width: windowWidth } = useWindowDimensions();
  const params = route.params ?? {};
  const [layoutTabs, setLayoutTabs] = useState<CourseLayoutTab[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState(params.layoutId ?? null);
  const [activeLayoutName, setActiveLayoutName] = useState(
    params.layoutName ?? null,
  );
  const pagerWidth = Math.max(280, windowWidth - spacing.lg * 2);
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
            .select("layout_id, layout_name")
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

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
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
          <Text style={[styles.eyebrow, { color: palette.green }]}>
            GogoPar Caddie Book
          </Text>
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
            <HolePicker
              holes={data.holes}
              selectedHoleNo={selectedHole.holeNo}
              onSelect={setSelectedHoleNo}
            />
            <HoleSwipePager
              holes={data.holes}
              selectedIndex={selectedIndex}
              onIndexChange={handleHoleIndexChange}
              width={pagerWidth}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  header: { gap: 3 },
  eyebrow: { ...typography.caption, fontWeight: "900", letterSpacing: 0.4 },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.0,
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
  courseTabsContent: { gap: spacing.sm, paddingRight: spacing.lg },
  courseTab: {
    minWidth: 78,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  courseTabText: { ...typography.bodySm, fontWeight: "900" },
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
  flipShell: { minHeight: 360, overflow: "visible" },
  flipFace: { width: "100%", backfaceVisibility: "hidden" },
  flipBackFace: { position: "absolute", left: 0, right: 0, top: 0 },
  heroCard: {
    width: "100%",
    minHeight: 350,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.xxl,
    overflow: "hidden",
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
