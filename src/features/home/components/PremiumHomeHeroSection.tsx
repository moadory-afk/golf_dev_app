import {
  Animated,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useEffect, useRef, useState } from "react";

import { colorLayers, radius, spacing } from "../../../design/tokens";
import { getCourseHeroImageSource } from "../../../data/courseHeroImages";
import { useSkin } from "../../../skins";
import { TopActionButtons } from "../../../components/TopActionButtons";
import type { HomeHeroRound } from "../types/home";

const HERO_DISPLAY_HEIGHT_RATIO = 0.6;
const HERO_MIN_WIDTH = 280;

type PremiumHomeHeroSectionProps = {
  greeting: string;
  userName: string;
  clubName: string;
  rounds: HomeHeroRound[];
  fallbackCourseName: string;
  fallbackAddress: string;
  fallbackWeatherText: string;
  fallbackTemperature: string;
  fallbackDday: string;
  fallbackRoundDate: string;
  fallbackTeeTime: string;
  isAdmin?: boolean;
  onCreateRound: () => void;
  onCaddieBookPress?: (round: HomeHeroRound) => void;
  onGroupsPress?: (round: HomeHeroRound) => void;
  onLottoPress?: (round: HomeHeroRound) => void;
  onAwardPress?: (round: HomeHeroRound) => void;
  onEditRoundPress?: (round: HomeHeroRound) => void;
  heroImageSource?: ImageSourcePropType;
  topInset?: number;
};

export function PremiumHomeHeroSection({
  rounds,
  fallbackCourseName,
  fallbackAddress,
  fallbackWeatherText,
  fallbackTemperature,
  fallbackDday,
  fallbackRoundDate,
  fallbackTeeTime,
  isAdmin = false,
  onCreateRound,
  onCaddieBookPress,
  onGroupsPress,
  onLottoPress,
  onAwardPress,
  onEditRoundPress,
  heroImageSource,
  topInset = 0,
}: PremiumHomeHeroSectionProps) {
  const { palette } = useSkin();
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [measuredHeroWidth, setMeasuredHeroWidth] = useState(0);
  const fallbackHeroWidth = Math.max(HERO_MIN_WIDTH, windowWidth);
  const heroWidth = measuredHeroWidth || fallbackHeroWidth;
  const heroHeight = Math.round(
    heroWidth * HERO_DISPLAY_HEIGHT_RATIO + topInset,
  );
  const hasRounds = rounds.length > 0;
  const totalCount = Math.max(1, rounds.length + (isAdmin ? 1 : 0));
  const dots = Array.from({ length: totalCount });

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / heroWidth);
    setActiveIndex(Math.max(0, Math.min(index, totalCount - 1)));
  };

  return (
    <View style={styles.shell}>
      <View
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width);
          if (nextWidth > 0 && nextWidth !== measuredHeroWidth)
            setMeasuredHeroWidth(nextWidth);
        }}
        style={[styles.heroCard, { height: heroHeight }]}
      >
        <View style={styles.heroImage}>
          <TopActionButtons topInset={topInset} floating />
          <ScrollView
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            style={styles.carousel}
          >
            {hasRounds ? (
              rounds.map((round) => (
                <HeroRoundCard
                  key={round.id}
                  width={heroWidth}
                  height={heroHeight}
                  topInset={topInset}
                  round={round}
                  isAdmin={isAdmin}
                  onCaddieBookPress={onCaddieBookPress}
                  onGroupsPress={onGroupsPress}
                  onLottoPress={onLottoPress}
                  onAwardPress={onAwardPress}
                  onEditRoundPress={onEditRoundPress}
                />
              ))
            ) : (
              <HeroEmptyCard
                width={heroWidth}
                height={heroHeight}
                topInset={topInset}
                courseName={fallbackCourseName}
                address={fallbackAddress}
                weatherText={fallbackWeatherText}
                temperature={fallbackTemperature}
                dday={fallbackDday}
                roundDate={fallbackRoundDate}
                teeTime={fallbackTeeTime}
                isAdmin={isAdmin}
                onCreateRound={onCreateRound}
                heroImageSource={heroImageSource}
              />
            )}

            {isAdmin && hasRounds && (
              <HeroCreateRoundCard
                width={heroWidth}
                height={heroHeight}
                topInset={topInset}
                onCreateRound={onCreateRound}
              />
            )}
          </ScrollView>

          <View style={styles.dotsRow} pointerEvents="none">
            {dots.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      index === activeIndex
                        ? palette.text
                        : "rgba(255,255,255,0.48)",
                    width: index === activeIndex ? 9 : 7,
                    height: index === activeIndex ? 9 : 7,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function HeroRoundCard({
  width,
  height,
  topInset,
  round,
  isAdmin,
  onCaddieBookPress,
  onGroupsPress,
  onLottoPress,
  onAwardPress,
  onEditRoundPress,
}: {
  width: number;
  height: number;
  topInset: number;
  round: HomeHeroRound;
  isAdmin: boolean;
  onCaddieBookPress?: (round: HomeHeroRound) => void;
  onGroupsPress?: (round: HomeHeroRound) => void;
  onLottoPress?: (round: HomeHeroRound) => void;
  onAwardPress?: (round: HomeHeroRound) => void;
  onEditRoundPress?: (round: HomeHeroRound) => void;
}) {
  const roundHeroImageSource = getCourseHeroImageSource(round.courseName);
  const [flipped, setFlipped] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(flip, {
      toValue: flipped ? 1 : 0,
      friction: 8,
      tension: 42,
      useNativeDriver: true,
    }).start();
  }, [flip, flipped]);

  const frontRotateY = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotateY = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  return (
    <View style={[styles.slide, { width, height, paddingTop: topInset + 52 }]}>
      <Animated.View
        style={[
          styles.flipFace,
          { transform: [{ perspective: 1000 }, { rotateY: frontRotateY }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.96}
          onPress={() => setFlipped(true)}
          style={styles.flipTouchable}
        >
          <Image
            source={roundHeroImageSource}
            style={styles.slideBackgroundImage}
            resizeMode="cover"
          />
          <View style={styles.scrim} />
          <View style={styles.frontSummaryWrap}>
            <HeroBottomSummary
              courseName={round.courseName}
              temperature={round.temperature}
              windText={round.windText || "--"}
              dday={round.dday}
              dateLabel={round.dateLabel}
              teeTime={round.teeTime}
              groupCount={round.groupCount}
              routeTimeText={round.routeTimeText}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.flipFace,
          styles.flipBackFace,
          { transform: [{ perspective: 1000 }, { rotateY: backRotateY }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.96}
          onPress={() => setFlipped(false)}
          style={styles.flipTouchable}
        >
          <HeroBackSide
            round={round}
            isAdmin={isAdmin}
            onCaddieBookPress={onCaddieBookPress}
            onGroupsPress={onGroupsPress}
            onLottoPress={onLottoPress}
            onAwardPress={onAwardPress}
            onEditRoundPress={onEditRoundPress}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function HeroBackSide({
  round,
  isAdmin,
  onCaddieBookPress,
  onGroupsPress,
  onLottoPress,
  onAwardPress,
  onEditRoundPress,
}: any) {
  const companionText = formatRoundCompanions(round);
  const courseLine = `${round.teeTime || "--:--"} ${round.courseLine || (round.layoutName ? `${round.layoutName} 코스` : "코스 미정")}`;

  return (
    <View style={styles.backCard}>
      <View style={styles.backLeftColumn}>
        <Text style={styles.backEyebrow}>Round Detail</Text>
        <Text style={styles.backCourseName} numberOfLines={1}>
          {round.courseName}
        </Text>

        <View style={styles.backDetailList}>
          <RoundDetailLine icon="📅" value={round.dateLabel} />
          <RoundDetailLine icon="⛳" value={courseLine} />
          <RoundDetailLine icon="👥" value={companionText} multiline />
        </View>
      </View>

      <View style={styles.backMenuColumn}>
        <BackMenuButton icon="📖" label="캐디북" onPress={() => onCaddieBookPress?.(round)} />
        <BackMenuButton icon="👥" label="조편성" onPress={() => onGroupsPress?.(round)} />
        <BackMenuButton icon="🎲" label="LOTTO" onPress={() => onLottoPress?.(round)} />
        <BackMenuButton icon="🏆" label="시상계획" onPress={() => onAwardPress?.(round)} />
        {isAdmin ? (
          <BackMenuButton icon="⚙️" label="설정" onPress={() => onEditRoundPress?.(round)} />
        ) : null}
      </View>
    </View>
  );
}

function formatRoundCompanions(round: any) {
  const source =
    round.memberNames ||
    round.companionNames ||
    round.groupMemberNames ||
    round.myGroupMemberNames ||
    round.members ||
    round.groupMembers ||
    round.players;

  if (typeof source === "string" && source.trim()) return source.trim();

  if (Array.isArray(source)) {
    const names = source
      .map((member) =>
        typeof member === "string"
          ? member
          : member?.name || member?.displayName || member?.userName || "",
      )
      .filter(Boolean);

    if (names.length > 0) return names.join(", ");
  }

  return round.memberCount ? `${round.memberCount}명` : "동반자 정보 준비중";
}

function RoundDetailLine({
  icon,
  value,
  multiline = false,
}: {
  icon: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.backDetailLine}>
      <Text style={styles.backDetailIcon}>{icon}</Text>
      <View style={styles.backDetailTextWrap}>
        <Text
          style={styles.backDetailValue}
          numberOfLines={multiline ? 2 : 1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function BackMenuButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={styles.backMenuButton}>
      <View style={styles.backMenuIconBubble}>
        <Text style={styles.backMenuIcon}>{icon}</Text>
      </View>
      <Text style={styles.backMenuLabel} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function HeroEmptyCard({
  width,
  height,
  courseName,
  address,
  weatherText,
  temperature,
  dday,
  roundDate,
  teeTime,
  isAdmin,
  onCreateRound,
  topInset,
  heroImageSource,
}: {
  width: number;
  height: number;
  topInset: number;
  courseName: string;
  address: string;
  weatherText: string;
  temperature: string;
  dday: string;
  roundDate: string;
  teeTime: string;
  isAdmin: boolean;
  onCreateRound: () => void;
  onCaddieBookPress?: (round: HomeHeroRound) => void;
  onGroupsPress?: (round: HomeHeroRound) => void;
  onLottoPress?: (round: HomeHeroRound) => void;
  onAwardPress?: (round: HomeHeroRound) => void;
  onEditRoundPress?: (round: HomeHeroRound) => void;
  heroImageSource?: ImageSourcePropType;
}) {
  const { palette } = useSkin();
  void address;
  void weatherText;

  return (
    <View style={[styles.slide, { width, height, paddingTop: topInset + 52 }]}>
      {heroImageSource ? (
        <Image
          source={heroImageSource}
          style={styles.slideBackgroundImage}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.scrim} />
      <HeroBottomSummary
        courseName={courseName}
        temperature={temperature}
        windText="--"
        dday={dday}
        dateLabel={roundDate}
        teeTime={teeTime}
      />

      {isAdmin && (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onCreateRound}
          style={[styles.emptyCreateButton, { borderColor: palette.gold }]}
        >
          <Text style={styles.emptyCreateText}>＋ 새 라운딩 등록</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function HeroCreateRoundCard({
  width,
  height,
  topInset,
  onCreateRound,
}: {
  width: number;
  height: number;
  topInset: number;
  onCreateRound: () => void;
}) {
  const { palette } = useSkin();

  return (
    <View style={[styles.slide, { width, height, paddingTop: topInset + 52 }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onCreateRound}
        style={[styles.createCard, { borderColor: palette.gold }]}
      >
        <Text style={styles.createIcon}>＋</Text>
        <Text style={[styles.createTitle, { color: palette.text }]}>
          새 라운딩 등록
        </Text>
        <Text style={styles.createSubtitle}>
          다음 일정을 등록하고 참가자를 모집하세요.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function HeroBottomSummary({
  courseName,
  temperature,
  windText,
  dday,
  dateLabel,
  teeTime,
  groupCount,
  routeTimeText,
}: {
  courseName: string;
  temperature: string;
  windText: string;
  dday: string;
  dateLabel: string;
  teeTime?: string;
  groupCount?: number;
  routeTimeText?: string;
}) {
  const scheduleLine = teeTime ? `Tee Off ${teeTime}` : "Tee Off --:--";
  void groupCount;
  const travelTimeText =
    routeTimeText && !routeTimeText.includes("준비중")
      ? routeTimeText
      : "50분 소요";

  return (
    <View style={styles.bottomSummary}>
      <Text style={styles.summaryCourseName} numberOfLines={1}>
        {courseName}
      </Text>
      <View style={styles.summaryContentRow}>
        <View style={styles.weatherSummary}>
          <Text style={styles.summaryWeatherIcon}>☀️</Text>
          <View style={styles.weatherTextWrap}>
            <Text style={styles.summaryTemperature} numberOfLines={1}>
              {temperature}
            </Text>
            <View style={styles.windRow}>
              <Text style={styles.windIcon}>🌬</Text>
              <Text style={styles.summaryWindText} numberOfLines={1}>
                {windText}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.scheduleSummary}>
          <Text style={styles.summaryDday} numberOfLines={1}>
            {dday}
          </Text>
          <Text style={styles.summaryDate} numberOfLines={1}>
            🗓 {dateLabel}
          </Text>
          <Text style={styles.summaryTeeTime} numberOfLines={1}>
            ◷ {scheduleLine}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.travelSummary}>
          <Text style={styles.travelLabel} numberOfLines={1}>
            지금 출발시
          </Text>
          <Text style={styles.travelTime} numberOfLines={1}>
            {travelTimeText}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginBottom: 0,
    width: "100%",
    overflow: "visible",
  },
  headerRow: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clubPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "44%",
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  clubIcon: { fontSize: 12 },
  clubText: {
    flex: 1,
    color: "#fff",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  clubArrow: { color: "#fff", fontSize: 12, lineHeight: 12, fontWeight: "900" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  circleButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  bellText: { fontSize: 15 },
  badge: {
    position: "absolute",
    top: -5,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  profileButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  profileImage: { width: 32, height: 32 },
  heroCard: {
    width: "100%",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 56,
  },
  heroImage: { flex: 1, backgroundColor: "#10261B", overflow: "hidden" },
  flipFace: { ...StyleSheet.absoluteFillObject, backfaceVisibility: "hidden" },
  flipBackFace: { backfaceVisibility: "hidden" },
  flipTouchable: { flex: 1, justifyContent: "flex-end" },
  frontSummaryWrap: { paddingHorizontal: 14, paddingBottom: 22 },
  heroBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  slideBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  carousel: { flex: 1 },
  slide: {
    paddingHorizontal: 14,
    paddingBottom: 22,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  courseBlock: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 4,
    paddingBottom: 6,
  },
  ddayPill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 4,
    marginBottom: 6,
  },
  ddayText: { color: "#fff", fontSize: 12, lineHeight: 16, fontWeight: "900" },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    maxWidth: "100%",
  },
  courseName: {
    maxWidth: "72%",
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -1.4,
  },
  layoutName: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  metaText: { color: "#fff", fontSize: 10, lineHeight: 14, fontWeight: "900" },
  emptyAddress: {
    color: colorLayers.heroTextMuted,
    fontSize: 11,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  bottomSummary: {
    width: "100%",
    minWidth: 292,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.26)",
    paddingTop: 8,
  },
  summaryCourseName: {
    color: "#fff",
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  summaryContentRow: { flexDirection: "row", alignItems: "stretch" },
  weatherSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  summaryWeatherIcon: { fontSize: 29, lineHeight: 34 },
  weatherTextWrap: { flex: 1, minWidth: 0 },
  summaryTemperature: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  windRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  windIcon: { color: "rgba(255,255,255,0.82)", fontSize: 12, lineHeight: 14 },
  summaryWindText: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: -0.25,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.44)",
    marginHorizontal: 6,
  },
  scheduleSummary: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  summaryDday: {
    color: "#B6FF8F",
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  travelSummary: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  travelLabel: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  travelTime: {
    color: "#fff",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 1,
  },
  summaryDate: {
    color: "#fff",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  summaryTeeTime: {
    color: "#fff",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "900",
    marginTop: 1,
    letterSpacing: -0.45,
  },
  backCard: {
    flex: 1,
    borderRadius: 0,
    backgroundColor: "rgba(236,246,238,0.94)",
    paddingLeft: 24,
    paddingRight: 176,
    paddingTop: 62,
    paddingBottom: 24,
    position: "relative",
  },
  backLeftColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: "flex-start",
  },
  backEyebrow: {
    color: "#4C9167",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  backCourseName: {
    color: "#10351F",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginBottom: 10,
  },
  backDetailList: {
    gap: 4,
  },
  backDetailLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(16,53,31,0.08)",
    paddingTop: 5,
  },
  backDetailIcon: {
    width: 31,
    color: "#19733D",
    fontSize: 22,
    lineHeight: 26,
    textAlign: "center",
  },
  backDetailTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  backDetailLabel: {
    color: "#2F7E50",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  backDetailValue: {
    color: "#18251D",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  backMenuColumn: {
    position: "absolute",
    right: 0,
    top: 62,
    width: 120,
    justifyContent: "flex-start",
    alignItems: "stretch",
    gap: 0,
  },
  backMenuButton: {
    width: "100%",
    height: 35,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "rgba(16,53,31,0.08)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    gap: 9,
  },
  backMenuIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(25,115,61,0.12)",
  },
  backMenuIcon: { fontSize: 17, lineHeight: 23 },
  backMenuLabel: {
    flex: 1,
    color: "#17251D",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
    letterSpacing: -0.45,
  },
  backInfoGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  backInfoItem: {
    width: "48%",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  backInfoLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    marginBottom: 3,
  },
  backInfoValue: {
    color: "#fff",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  backActionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  backActionButton: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  editRoundButton: {
    flexBasis: "100%",
    backgroundColor: "rgba(182,255,143,0.20)",
  },
  backActionIcon: { fontSize: 16, lineHeight: 19 },
  backRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
  },
  backLink: { fontSize: 16, fontWeight: "700", color: "#B6FF8F" },
  backInfoStrong: {
    fontSize: 15,
    fontWeight: "900",
    color: "rgba(255,255,255,0.94)",
    letterSpacing: -0.3,
  },
  backIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  backIcon: { fontSize: 18, lineHeight: 22 },
  backActionText: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  dotsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  dot: { borderRadius: radius.pill },
  heroWave: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 1,
    opacity: 0,
  },
  emptyCreateButton: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.xl,
    borderStyle: "dashed",
    backgroundColor: colorLayers.heroGlass,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  emptyCreateText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  createCard: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radius.xxl,
    backgroundColor: colorLayers.heroGlass,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  createIcon: {
    color: "#fff",
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
  },
  createTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: spacing.sm,
  },
  createSubtitle: {
    color: "#fff",
    opacity: 0.8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
