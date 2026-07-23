import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TutorialFinger } from "./TutorialFinger";
import type { TutorialPlacement, TutorialRect, TutorialStepDefinition } from "./tutorialTypes";

const CARD_WIDTH = 252;
const CARD_HEIGHT = 112;
const GAP = 14;
const EDGE = 10;

export function TutorialOverlay({
  step,
  targetRect,
  containerWidth,
  containerHeight,
  currentIndex,
  totalSteps,
  onSkip,
}: {
  step: TutorialStepDefinition | null;
  targetRect: TutorialRect | null;
  containerWidth: number;
  containerHeight: number;
  currentIndex: number;
  totalSteps: number;
  onSkip: () => void;
}) {
  const layout = useMemo(() => {
    if (!step || !targetRect || containerWidth <= 0 || containerHeight <= 0) return null;
    const spaceTop = targetRect.y;
    const spaceBottom = containerHeight - (targetRect.y + targetRect.height);
    let placement: TutorialPlacement = step.placement ?? "auto";
    if (placement === "auto") placement = spaceTop >= CARD_HEIGHT + GAP || spaceTop >= spaceBottom ? "top" : "bottom";

    let left = targetRect.x + targetRect.width / 2 - CARD_WIDTH / 2;
    left = Math.max(EDGE, Math.min(left, containerWidth - CARD_WIDTH - EDGE));
    let top = placement === "top"
      ? targetRect.y - CARD_HEIGHT - GAP
      : targetRect.y + targetRect.height + GAP;
    top = Math.max(EDGE, Math.min(top, containerHeight - CARD_HEIGHT - EDGE));

    const fingerLeft = Math.max(8, Math.min(targetRect.x + targetRect.width / 2 - 22, containerWidth - 52));
    const fingerTop = Math.max(8, Math.min(targetRect.y + targetRect.height / 2 - 22, containerHeight - 58));
    return { placement, left, top, fingerLeft, fingerTop };
  }, [containerHeight, containerWidth, step, targetRect]);

  if (!step || !targetRect || !layout) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        pointerEvents="none"
        style={[
          styles.highlight,
          {
            left: targetRect.x - 4,
            top: targetRect.y - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          },
        ]}
      />
      <View pointerEvents="none" style={{ position: "absolute", left: layout.fingerLeft, top: layout.fingerTop }}>
        <TutorialFinger gesture={step.gesture} />
      </View>
      <View style={[styles.card, { left: layout.left, top: layout.top }]}>
        <View style={styles.headerRow}>
          <Text style={styles.progress}>{currentIndex + 1} / {totalSteps}</Text>
          <TouchableOpacity onPress={onSkip} hitSlop={10} style={styles.skipButton}>
            <Text style={styles.skipText}>건너뛰기</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.description}>{step.description}</Text>
        <View style={[styles.arrow, layout.placement === "top" ? styles.arrowDown : styles.arrowUp]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  highlight: {
    position: "absolute",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.94)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  card: {
    position: "absolute",
    width: CARD_WIDTH,
    minHeight: CARD_HEIGHT,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 14,
    borderRadius: 18,
    backgroundColor: "rgba(18,112,78,0.82)",
    shadowColor: "#0B3D2A",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  progress: { color: "rgba(255,255,255,0.68)", fontSize: 11, fontWeight: "800" },
  skipButton: { paddingVertical: 2, paddingLeft: 8 },
  skipText: { color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "800" },
  title: { color: "#F6F1DF", fontSize: 16, lineHeight: 21, fontWeight: "900", marginBottom: 4 },
  description: { color: "rgba(255,255,255,0.88)", fontSize: 12, lineHeight: 17, fontWeight: "600" },
  arrow: { position: "absolute", left: CARD_WIDTH / 2 - 9, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderLeftColor: "transparent", borderRightColor: "transparent" },
  arrowDown: { bottom: -9, borderTopWidth: 10, borderTopColor: "rgba(18,112,78,0.82)" },
  arrowUp: { top: -9, borderBottomWidth: 10, borderBottomColor: "rgba(18,112,78,0.82)" },
});
