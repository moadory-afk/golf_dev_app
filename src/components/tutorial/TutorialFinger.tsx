import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import type { TutorialGesture } from "./tutorialTypes";

export function TutorialFinger({ gesture = "tap" }: { gesture?: TutorialGesture }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: gesture === "swipe" ? 850 : 500, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: gesture === "swipe" ? 850 : 500, useNativeDriver: true }),
        Animated.delay(280),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [gesture, progress]);

  const translateX = gesture === "swipe"
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [-28, 28] })
    : 0;
  const translateY = gesture === "tap"
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, 8] })
    : 0;
  const scale = gesture === "tap"
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] })
    : 1;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateX }, { translateY }, { scale }] }]}>
      {gesture === "tap" ? <View style={[styles.ripple, { opacity: progress }]} /> : null}
      <Text style={styles.hand}>☝🏻</Text>
      {gesture === "swipe" ? <Text style={styles.swipeGuide}>↔</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  ripple: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.86)",
  },
  hand: { fontSize: 34, lineHeight: 39 },
  swipeGuide: { marginTop: -4, color: "#fff", fontSize: 20, fontWeight: "900" },
});
