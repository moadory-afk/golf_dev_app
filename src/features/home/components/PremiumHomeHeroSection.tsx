import {
  Alert,
  Animated,
  Image,
  ImageSourcePropType,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { colorLayers, radius, spacing } from "../../../design/tokens";
import { getCourseHeroImageSource } from "../../../data/courseHeroImages";
import { useSkin } from "../../../skins";
import { TopActionButtons } from "../../../components/TopActionButtons";
import type { HomeHeroRound } from "../types/home";
import { isCompactWidth } from "../../../lib/responsive";
import { getOptimizedRemoteImageUrl } from "../../../lib/imageOptimization";

const HERO_DISPLAY_HEIGHT_RATIO = 0.7;
const HERO_MIN_WIDTH = 280;

type HomeHeroCarouselItem =
  | { kind: "round"; round: HomeHeroRound }
  | { kind: "empty" }
  | { kind: "create" };

type NavigationProvider = "kakao" | "tmap" | "naver";

const MAP_NAVIGATION_APPS: Array<{
  id: NavigationProvider;
  label: string;
  icon: ImageSourcePropType;
}> = [
  {
    id: "kakao",
    label: "카카오맵",
    icon: require("../../../assets/map-apps/kakaomap.png"),
  },
  {
    id: "tmap",
    label: "티맵",
    icon: require("../../../assets/map-apps/tmap.png"),
  },
  {
    id: "naver",
    label: "네이버지도",
    icon: require("../../../assets/map-apps/navermap.png"),
  },
];

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
  onWeatherPress?: (round: HomeHeroRound) => void;
  heroImageSource?: ImageSourcePropType;
  topInset?: number;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  departureBufferMinutes?: number;
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
  onWeatherPress,
  heroImageSource,
  topInset = 0,
  activeIndex: controlledActiveIndex,
  onActiveIndexChange,
  departureBufferMinutes = 40,
}: PremiumHomeHeroSectionProps) {
  const { palette } = useSkin();
  const [internalActiveIndex, setInternalActiveIndex] = useState(0);
  const activeIndex = controlledActiveIndex ?? internalActiveIndex;
  const [measuredHeroWidth, setMeasuredHeroWidth] = useState(0);
  const scrollRef = useRef<FlatList<HomeHeroCarouselItem>>(null);
  const dotsScrollRef = useRef<ScrollView>(null);
  const activeIndexRef = useRef(0);
  const fallbackHeroWidth = HERO_MIN_WIDTH;
  const heroWidth = measuredHeroWidth || fallbackHeroWidth;
  const heroHeight = Math.round(
    heroWidth * HERO_DISPLAY_HEIGHT_RATIO + topInset,
  );
  const hasRounds = rounds.length > 0;
  const totalCount = hasRounds
    ? rounds.length + (isAdmin ? 1 : 0)
    : 1;
  const dots = Array.from({ length: totalCount });
  const carouselItems = useMemo<HomeHeroCarouselItem[]>(() => {
    if (!hasRounds) return [{ kind: "empty" }];
    const items: HomeHeroCarouselItem[] = rounds.map((round) => ({
      kind: "round",
      round,
    }));
    if (isAdmin) items.push({ kind: "create" });
    return items;
  }, [hasRounds, isAdmin, rounds]);

  const updateActiveIndex = (nextIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(nextIndex, totalCount - 1));
    activeIndexRef.current = clampedIndex;
    setInternalActiveIndex(clampedIndex);
    onActiveIndexChange?.(clampedIndex);
    return clampedIndex;
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / heroWidth);
    updateActiveIndex(index);
  };

  useEffect(() => {
    const dotStep = 15;
    const targetX = Math.max(0, activeIndex * dotStep - dotStep * 2);
    dotsScrollRef.current?.scrollTo({ x: targetX, y: 0, animated: true });
  }, [activeIndex, totalCount]);

  useEffect(() => {
    const nextIndex = Math.max(0, Math.min(activeIndex, totalCount - 1));
    if (
      controlledActiveIndex !== undefined &&
      activeIndexRef.current !== nextIndex
    ) {
      activeIndexRef.current = nextIndex;
      scrollRef.current?.scrollToOffset({
        offset: nextIndex * heroWidth,
        animated: true,
      });
    }
  }, [activeIndex, controlledActiveIndex, heroWidth, totalCount]);



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
          <FlatList
            ref={scrollRef}
            horizontal
            pagingEnabled
            data={carouselItems}
            keyExtractor={(item, index) =>
              item.kind === "round" ? item.round.id : `${item.kind}-${index}`
            }
            decelerationRate="fast"
            snapToInterval={heroWidth}
            getItemLayout={(_, index) => ({
              length: heroWidth,
              offset: heroWidth * index,
              index,
            })}
            showsHorizontalScrollIndicator={false}

            onScroll={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / heroWidth);
              if (index !== activeIndexRef.current) {
                updateActiveIndex(index);
              }
            }}
            onMomentumScrollEnd={handleScrollEnd}
            onScrollEndDrag={(event) => {
              const velocityX = event.nativeEvent.velocity?.x ?? 0;
              if (Math.abs(velocityX) < 0.05) handleScrollEnd(event);
            }}
            scrollEventThrottle={16}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews
            style={styles.carousel}
            renderItem={({ item, index }) => {
              if (item.kind === "round") {
                return (
                  <HeroRoundCard
                    width={heroWidth}
                    height={heroHeight}
                    topInset={topInset}
                    round={item.round}
                    shouldLoadImage={true}
                    isAdmin={isAdmin}
                    onCaddieBookPress={onCaddieBookPress}
                    onGroupsPress={onGroupsPress}
                    onLottoPress={onLottoPress}
                    onAwardPress={onAwardPress}
                    onEditRoundPress={onEditRoundPress}
                    onWeatherPress={onWeatherPress}
                    departureBufferMinutes={departureBufferMinutes}
                  />
                );
              }
              if (item.kind === "create") {
                return (
                  <HeroCreateRoundCard
                    width={heroWidth}
                    height={heroHeight}
                    topInset={topInset}
                    onCreateRound={onCreateRound}
                  />
                );
              }
              return (
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
                  departureBufferMinutes={departureBufferMinutes}
                />
              );
            }}
          />

          <View style={styles.dotsViewport} pointerEvents="none">
            <ScrollView
              ref={dotsScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false}
              contentContainerStyle={styles.dotsRow}
            >
              {dots.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        index === activeIndex
                          ? "#fff"
                          : "rgba(255,255,255,0.48)",
                      width: index === activeIndex ? 16 : 6,
                      height: 6,
                    },
                  ]}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
}

const HeroRoundCard = memo(function HeroRoundCard({
  width,
  height,
  topInset,
  round,
  shouldLoadImage,
  isAdmin,
  onCaddieBookPress,
  onGroupsPress,
  onLottoPress,
  onAwardPress,
  onEditRoundPress,
  onWeatherPress,
  departureBufferMinutes,
}: {
  width: number;
  height: number;
  topInset: number;
  round: HomeHeroRound;
  shouldLoadImage: boolean;
  isAdmin: boolean;
  onCaddieBookPress?: (round: HomeHeroRound) => void;
  onGroupsPress?: (round: HomeHeroRound) => void;
  onLottoPress?: (round: HomeHeroRound) => void;
  onAwardPress?: (round: HomeHeroRound) => void;
  onEditRoundPress?: (round: HomeHeroRound) => void;
  onWeatherPress?: (round: HomeHeroRound) => void;
  departureBufferMinutes: number;
}) {
  const optimizedHeroImageUrl = useMemo(
    () =>
      getOptimizedRemoteImageUrl(round.heroImageUrl, {
        width: Math.max(width, 800),
        height: Math.max(height, 560),
        quality: 78,
      }),
    [height, round.heroImageUrl, width],
  );
  const roundHeroImageSource = round.heroImageUrl
    ? optimizedHeroImageUrl
      ? { uri: optimizedHeroImageUrl }
      : null
    : getCourseHeroImageSource(round.courseName);
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
          {shouldLoadImage && roundHeroImageSource ? (
            <Image
              source={roundHeroImageSource}
              style={styles.slideBackgroundImage}
              resizeMode="cover"
              fadeDuration={160}
            />
          ) : (
            <View style={styles.slideBackgroundPlaceholder} />
          )}
          <View style={styles.scrim} />
          <View style={[styles.frontSummaryWrap, { paddingHorizontal: isCompactWidth(width) ? 10 : 14, paddingBottom: isCompactWidth(width) ? 18 : 22 }]}>
            <HeroBottomSummary
              width={width}
              courseName={round.courseName}
              temperature={round.temperature}
              windText={round.windText || "--"}
              dday={round.dday}
              dateLabel={round.dateLabel}
              teeTime={round.teeTime}
              groupCount={round.groupCount}
              routeTimeText={round.routeTimeText}
              departureTimeText={round.departureTimeText}
              departureBufferMinutes={departureBufferMinutes}
              courseLatitude={round.courseLatitude}
              courseLongitude={round.courseLongitude}
              onWeatherPress={() => onWeatherPress?.(round)}
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
            width={width}
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
});

function HeroBackSide({
  width,
  round,
  isAdmin,
  onCaddieBookPress,
  onGroupsPress,
  onLottoPress,
  onAwardPress,
  onEditRoundPress,
}: any) {
  const isCompact = isCompactWidth(width);
  const contentTop = isCompact ? 52 : 62;
  const horizontalPadding = isCompact ? 18 : 24;
  // 오른쪽 메뉴 영역을 조금 줄여 왼쪽 조별 참석자명이 한 줄에 더 잘 보이도록 한다.
  const menuWidth = isCompact ? 94 : 108;
  const menuButtonHeight = isCompact ? 32 : 35;
  const iconSize = isCompact ? 28 : 32;
  const companionText = formatRoundCompanions(round);
  const courseLabel = stripCourseSuffix(round.courseLine || (round.layoutName ? `${round.layoutName} 코스` : "코스 미정"));
  const courseLine = `${round.teeTime || "--:--"} ${courseLabel}`;

  return (
    <View
      style={[
        styles.backCard,
        {
          paddingHorizontal: horizontalPadding,
          paddingTop: contentTop,
          paddingBottom: isCompact ? 18 : 24,
          gap: isCompact ? 8 : 12,
        },
      ]}
    >
      <View style={styles.backLeftColumn}>
        <Text style={styles.backEyebrow}>Round Detail</Text>
        <Text
          style={[
            styles.backCourseName,
            {
              fontSize: isCompact ? 28 : 34,
              lineHeight: isCompact ? 34 : 40,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {round.courseName}
        </Text>

        <View style={styles.backDetailList}>
          <RoundDetailLine icon="📅" value={round.dateLabel} compact={isCompact} />
          <RoundDetailLine icon="⛳" value={courseLine} compact={isCompact} />
          <RoundDetailLine icon="👥" value={companionText} compact={isCompact} multiline />
        </View>
      </View>

      <View style={[styles.backMenuColumn, { width: menuWidth }]}>
        <BackMenuButton icon="📖" label="캐디북" height={menuButtonHeight} iconSize={iconSize} compact={isCompact} onPress={() => onCaddieBookPress?.(round)} />
        <BackMenuButton icon="👥" label="조편성" height={menuButtonHeight} iconSize={iconSize} compact={isCompact} onPress={() => onGroupsPress?.(round)} />
        <BackMenuButton icon="🎲" label="LOTTO" height={menuButtonHeight} iconSize={iconSize} compact={isCompact} onPress={() => onLottoPress?.(round)} />
        <BackMenuButton icon="🏆" label="시상계획" height={menuButtonHeight} iconSize={iconSize} compact={isCompact} onPress={() => onAwardPress?.(round)} />
        {isAdmin ? (
          <BackMenuButton icon="⚙️" label="설정" height={menuButtonHeight} iconSize={iconSize} compact={isCompact} onPress={() => onEditRoundPress?.(round)} />
        ) : null}
      </View>
    </View>
  );
}

function stripCourseSuffix(value: string) {
  return value.replace(/\s*코스\s*$/u, "").trim();
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
  compact = false,
  multiline = false,
}: {
  icon: string;
  value: string;
  compact?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.backDetailLine}>
      <Text style={styles.backDetailIcon}>{icon}</Text>
      <View style={styles.backDetailTextWrap}>
        <Text
          style={[
            styles.backDetailValue,
            {
              fontSize: compact ? 13 : 15,
              lineHeight: compact ? 19 : 22,
            },
          ]}
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
  height,
  iconSize,
  compact = false,
  onPress,
}: {
  icon: string;
  label: string;
  height: number;
  iconSize: number;
  compact?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={[styles.backMenuButton, { height }]}>
      <View style={[styles.backMenuIconBubble, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}>
        <Text style={[styles.backMenuIcon, { fontSize: compact ? 15 : 17, lineHeight: compact ? 21 : 23 }]}>{icon}</Text>
      </View>
      <Text style={[styles.backMenuLabel, { fontSize: compact ? 12 : 13 }]} numberOfLines={1}>
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
  departureBufferMinutes,
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
  departureBufferMinutes: number;
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
        width={width}
        courseName={courseName}
        temperature={temperature}
        windText="--"
        dday={dday}
        dateLabel={roundDate}
        teeTime={teeTime}
        departureBufferMinutes={departureBufferMinutes}
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
  width,
  courseName,
  temperature,
  windText,
  dday,
  dateLabel,
  teeTime,
  groupCount,
  routeTimeText,
  departureTimeText,
  departureBufferMinutes,
  courseLatitude,
  courseLongitude,
  onWeatherPress,
}: {
  width: number;
  courseName: string;
  temperature: string;
  windText: string;
  dday: string;
  dateLabel: string;
  teeTime?: string;
  groupCount?: number;
  routeTimeText?: string;
  departureTimeText?: string;
  departureBufferMinutes: number;
  courseLatitude?: number | null;
  courseLongitude?: number | null;
  onWeatherPress?: () => void;
}) {
  const isCompact = isCompactWidth(width);
  const scheduleLine = teeTime ? `Tee Off ${teeTime}` : "Tee Off --:--";
  void groupCount;
  const travelTimeText =
    routeTimeText
      ? routeTimeText.replace(/\s*소요$/, "")
      : "이동시간 준비중";
  const departureText =
    departureTimeText && !departureTimeText.includes("준비중")
      ? departureTimeText.replace(/^출발 추천\s*/, "")
      : "";
  const [mapChooserVisible, setMapChooserVisible] = useState(false);
  const hasDestination =
    typeof courseLatitude === "number" &&
    Number.isFinite(courseLatitude) &&
    typeof courseLongitude === "number" &&
    Number.isFinite(courseLongitude);

  const openNavigation = async (provider: NavigationProvider) => {
    if (!hasDestination) {
      Alert.alert("길안내 준비중", "골프장 위치 정보가 등록되지 않았습니다.");
      return;
    }

    const name = encodeURIComponent(courseName);
    const lat = courseLatitude;
    const lng = courseLongitude;
    const urls = {
      kakao: {
        app: `kakaomap://route?ep=${lat},${lng}&by=CAR`,
        web: `https://map.kakao.com/link/to/${name},${lat},${lng}`,
      },
      tmap: {
        app: `tmap://route?goalname=${name}&goalx=${lng}&goaly=${lat}`,
        web: `https://www.tmap.co.kr/search?searchKeyword=${name}`,
      },
      naver: {
        app: `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${name}&appname=gogopar`,
        web: `https://map.naver.com/p/search/${name}`,
      },
    }[provider];

    setMapChooserVisible(false);
    try {
      if (Platform.OS === "web") {
        await Linking.openURL(urls.web);
        return;
      }
      const supported = await Linking.canOpenURL(urls.app);
      await Linking.openURL(supported ? urls.app : urls.web);
    } catch {
      try {
        await Linking.openURL(urls.web);
      } catch {
        Alert.alert("길안내 실행 실패", "지도 앱을 열 수 없습니다.");
      }
    }
  };

  return (
    <View style={[styles.bottomSummary, { paddingTop: isCompact ? 6 : 8 }]}>
      <Text
        style={[
          styles.summaryCourseName,
          {
            fontSize: isCompact ? 18 : 21,
            lineHeight: isCompact ? 22 : 25,
            marginBottom: isCompact ? 6 : 8,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {courseName}
      </Text>
      <View style={styles.summaryContentRow}>
        <TouchableOpacity
          activeOpacity={0.72}
          onPress={(event) => {
            event.stopPropagation?.();
            onWeatherPress?.();
          }}
          style={[
            styles.weatherSummary,
            { gap: isCompact ? 4 : 8, paddingHorizontal: isCompact ? 3 : 8 },
          ]}
        >
          <Text
            style={[
              styles.summaryWeatherIcon,
              { fontSize: isCompact ? 23 : 29, lineHeight: isCompact ? 28 : 34 },
            ]}
          >
            ☀️
          </Text>
          <View style={styles.weatherTextWrap}>
            <Text
              style={[
                styles.summaryTemperature,
                { fontSize: isCompact ? 19 : 24, lineHeight: isCompact ? 23 : 28 },
              ]}
              numberOfLines={1}
            >
              {temperature}
            </Text>
            <View style={styles.windRow}>
              <Text style={styles.windIcon}>🌬</Text>
              <Text
                style={[
                  styles.summaryWindText,
                  { fontSize: isCompact ? 10 : 11, lineHeight: isCompact ? 14 : 16 },
                ]}
                numberOfLines={1}
              >
                {windText}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={[styles.summaryDivider, { marginHorizontal: isCompact ? 3 : 6 }]} />

        <View style={[styles.scheduleSummary, { paddingHorizontal: isCompact ? 4 : 8 }]}>
          <Text
            style={[
              styles.summaryDday,
              { fontSize: isCompact ? 17 : 21, lineHeight: isCompact ? 21 : 25 },
            ]}
            numberOfLines={1}
          >
            {dday}
          </Text>
          <Text
            style={[
              styles.summaryDate,
              { fontSize: isCompact ? 12 : 14, lineHeight: isCompact ? 16 : 19 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {dateLabel}
          </Text>
          <Text
            style={[
              styles.summaryTeeTime,
              { fontSize: isCompact ? 12 : 14, lineHeight: isCompact ? 16 : 19 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {scheduleLine}
          </Text>
        </View>

        <View style={[styles.summaryDivider, { marginHorizontal: isCompact ? 3 : 6 }]} />

        <TouchableOpacity
          activeOpacity={0.72}
          disabled={!hasDestination}
          onPress={(event) => {
            event.stopPropagation?.();
            setMapChooserVisible(true);
          }}
          style={[styles.travelSummary, { paddingHorizontal: isCompact ? 4 : 8 }]}
        >
          <Text
            style={[
              styles.departureTime,
              { fontSize: isCompact ? 17 : 21, lineHeight: isCompact ? 21 : 25 },
            ]}
            numberOfLines={1}
          >
            {departureText || "--:--"}
          </Text>
          <Text
            style={[
              styles.travelTime,
              { fontSize: isCompact ? 12 : 14, lineHeight: isCompact ? 16 : 19 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {travelTimeText.includes("준비중") ? travelTimeText : `${travelTimeText} 소요`}
          </Text>
          <Text
            style={[
              styles.travelBuffer,
              { fontSize: isCompact ? 11 : 13, lineHeight: isCompact ? 15 : 18 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {`${Math.max(0, Math.round(departureBufferMinutes))}분 여유 가정`}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={mapChooserVisible}
        onRequestClose={() => setMapChooserVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setMapChooserVisible(false)}
          style={styles.mapModalBackdrop}
        >
          <TouchableOpacity activeOpacity={1} style={styles.mapChooser}>
            <Text style={styles.mapChooserTitle}>길안내 앱 선택</Text>
            <Text style={styles.mapChooserCourse} numberOfLines={1}>{courseName}</Text>
            <View style={styles.mapOptionRow}>
              {MAP_NAVIGATION_APPS.map((app) => (
                <TouchableOpacity
                  key={app.id}
                  style={styles.mapOption}
                  onPress={() => openNavigation(app.id)}
                  activeOpacity={0.84}
                >
                  <Image source={app.icon} style={styles.mapOptionIcon} resizeMode="cover" />
                  <Text style={styles.mapOptionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                    {app.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.mapCancel} onPress={() => setMapChooserVisible(false)}>
              <Text style={styles.mapCancelText}>취소</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    fontSize: 13,
    lineHeight: 16,
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
  frontSummaryWrap: {},
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
  slideBackgroundPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#10261B",
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
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.26)",
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
    alignItems: "flex-start",
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
    marginTop: 2,
    textAlign: "left",
  },
  departureTime: {
    color: "#FFD166",
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "left",
  },
  travelBuffer: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
    marginTop: 1,
    textAlign: "left",
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
    backgroundColor: "rgba(206,224,211,0.96)",
    flexDirection: "row",
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
    justifyContent: "flex-start",
    alignItems: "stretch",
    gap: 0,
  },
  backMenuButton: {
    width: "100%",
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
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 0,
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
  dotsViewport: {
    position: "absolute",
    alignSelf: "center",
    bottom: 10,
    width: 112,
    overflow: "hidden",
  },
  dotsRow: {
    minWidth: 112,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.xs,
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
  mapModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.48)",
    padding: 16,
  },
  mapChooser: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 10,
  },
  mapChooserTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  mapChooserCourse: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 4,
  },
  mapOptionRow: {
    flexDirection: "row",
    gap: 10,
  },
  mapOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 112,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#F8FAF9",
    borderWidth: 1,
    borderColor: "#E1E8E4",
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  mapOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    marginBottom: 9,
  },
  mapOptionText: {
    color: "#111827",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  mapCancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  mapCancelText: {
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "600",
  },

});
