import {
  ScrollView,
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  Image,
  Share,
  Alert,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CommonActions,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useState, useCallback, useEffect, useRef } from "react";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  DEFAULT_LOTTO_AWARD_CONFIG,
  createClub,
  getClubLottoAwardConfig,
  getClubMembers,
  getClubNotices,
  getGolfCourses,
  getRoundLottoDrawsByScheduleIds,
  getRoundLottoEntriesByScheduleIds,
  getRoundSummaries,
  playerTotal,
  leaveClub,
  totalPar,
  computeHandicaps,
  saveClubLottoAwardConfig,
  shortName,
  updateClubSettings,
  type ClubInfo,
  type ClubNotice,
  type GolfCourse,
  type LottoAwardConfig,
  type RoundLottoDrawScore,
  type SavedRound,
} from "../lib/store";
import { supabase } from "../lib/supabase";
import { useClub } from "../lib/ClubContext";
import { useUserProfile } from "../lib/UserProfileContext";
import { useAsync } from "../lib/useAsync";
import {
  loadHandicapBasis,
  saveHandicapBasis,
  type HandicapBasis,
} from "../lib/handicapBasis";
import { C } from "../theme";
import { TopActionButtons } from "../components/TopActionButtons";
import { PwaInstallGuide } from "../components/PwaInstallGuide";
import { Icon } from "../components/Icon";
import { EmojiIcon } from "../components/EmojiIcon";
import {
  ImageCropModal,
  type ImageCropRect,
} from "../components/ImageCropModal";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { isCompactWidth } from "../lib/responsive";
import { notifyHomeDashboardChanged } from "../lib/homeDashboardEvents";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ClubRoute = RouteProp<MainTabParamList, "Club">;
type ClubHeroItem =
  | { kind: "club"; club: ClubInfo }
  | { kind: "create" };
type RankingType =
  | "recentMedal"
  | "recentWins"
  | "wins"
  | "streak"
  | "lowestHandicap"
  | "birdie"
  | "singleBirdie";

const CLUB_HERO_IMAGE =
  "https://images.unsplash.com/photo-1592919505780-303950717480?auto=format&fit=crop&w=1200&q=80";
const CLUB_HERO_DISPLAY_HEIGHT_RATIO = 0.7;
const CLUB_HERO_MIN_WIDTH = 280;
const APP_URL = "https://golf-seven-psi.vercel.app";
const LOTTO_JACKPOT_BASE = 50000;
const LOTTO_JACKPOT_STEP = 10000;

function formatNoticeDate(value: string) {
  if (!value) return "-";
  const date = value.slice(5, 10);
  return date.length === 5 ? date.replace("-", ".") : value;
}

function diffText(d: number) {
  return d > 0 ? `+${d}` : `${d}`;
}

function formatWon(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString("ko-KR")}원`;
}

function formatLottoScore(score: number | undefined, par: number | undefined) {
  if (typeof score !== "number" || typeof par !== "number") return "";
  const diff = score - par;
  if (diff <= -3) return "알바트로스";
  if (diff === -2) return "이글";
  if (diff === -1) return "버디";
  if (diff === 0) return "파";
  if (diff === 1) return "보기";
  if (diff === 2) return "더블";
  if (diff >= par) return "양파";
  return `+${diff}`;
}

function compactLottoScoreLabel(label: string) {
  return label
    .replace("더블보기", "더블")
    .replace("트리플보기", "트리플")
    .replace("더블+", "더블")
    .replace("양파+", "양파")
    .trim();
}

function isLottoScoreHit(
  myScore: number | undefined,
  par: number | undefined,
  drawScore: RoundLottoDrawScore | null,
) {
  if (typeof myScore !== "number" || typeof par !== "number" || !drawScore)
    return false;
  const myLabel = compactLottoScoreLabel(formatLottoScore(myScore, par));
  const drawLabel = compactLottoScoreLabel(
    drawScore.label ?? formatLottoScore(drawScore.score, drawScore.par ?? par),
  );
  return myLabel === drawLabel;
}

async function calculateLottoCarryoverAmount(
  rounds: SavedRound[],
  members: Array<{ userId: string; name: string; role: string }>,
) {
  const memberNameById = new Map(
    members.map((member) => [member.userId, member.name]),
  );
  const scheduleIds = rounds
    .map((round) => round.scheduleId)
    .filter((id): id is string => !!id);
  const [draws, entries] = await Promise.all([
    getRoundLottoDrawsByScheduleIds(scheduleIds).catch(() => []),
    getRoundLottoEntriesByScheduleIds(scheduleIds).catch(() => []),
  ]);
  const drawByScheduleId = new Map(
    draws.map((draw) => [draw.scheduleId, draw]),
  );
  const entriesByScheduleId = entries.reduce<Record<string, typeof entries>>(
    (acc, entry) => {
      if (!acc[entry.scheduleId]) acc[entry.scheduleId] = [];
      acc[entry.scheduleId].push(entry);
      return acc;
    },
    {},
  );
  const completedLottoRounds = rounds
    .filter((round) => {
      const draw = round.scheduleId
        ? drawByScheduleId.get(round.scheduleId)
        : null;
      return !!draw && draw.drawStatus === "COMPLETED" && !!draw.drawnScores;
    })
    .map((round) => ({
      round,
      draw: drawByScheduleId.get(round.scheduleId!)!,
      entries: entriesByScheduleId[round.scheduleId!] ?? [],
    }))
    .sort((a, b) => a.round.date.localeCompare(b.round.date));

  return completedLottoRounds.reduce((amount, item) => {
    const hasFirstPrizeWinner = item.entries.some((entry) => {
      const playerName = memberNameById.get(entry.userId);
      const player = item.round.players.find(
        (roundPlayer) => roundPlayer.name === playerName,
      );
      if (!player) return false;
      const selectedHoles = [
        ...entry.selectedHoles.par3,
        ...entry.selectedHoles.par4,
        ...entry.selectedHoles.par5,
      ];
      const hits = selectedHoles.filter((hole) =>
        isLottoScoreHit(
          player.strokes[hole - 1],
          item.round.pars[hole - 1],
          item.draw.drawnScores?.[String(hole)] ?? null,
        ),
      ).length;
      return hits >= 6;
    });

    return hasFirstPrizeWinner
      ? LOTTO_JACKPOT_BASE
      : amount + LOTTO_JACKPOT_STEP;
  }, LOTTO_JACKPOT_BASE);
}

// 공동 수상자 포맷: 3명 이하 전원, 4명 이상 "A 외 N명"
function formatWinners(names: string[], value: string): string {
  if (names.length === 0) return "-";
  const label =
    names.length <= 3
      ? names.map(shortName).join(", ")
      : `${shortName(names[0])} 외 ${names.length - 1}명`;
  return `${label} (${value})`;
}

function getWinner(
  r: SavedRound,
  handicaps: Map<string, number>,
): string | null {
  const ranked = r.players
    .map((p) => {
      const total = playerTotal(p.strokes);
      return { name: p.name, net: total - (handicaps.get(p.name) ?? 0), total };
    })
    .sort((a, b) => (a.net !== b.net ? a.net - b.net : a.total - b.total)); // net 동점 → 총타수 낮은 순
  return ranked[0]?.name ?? null;
}

export default function ClubScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const nav = useNavigation<Nav>();
  const route = useRoute<ClubRoute>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [measuredClubHeroWidth, setMeasuredClubHeroWidth] = useState(0);
  const clubHeroScrollRef = useRef<FlatList<ClubHeroItem>>(null);
  const [clubHeroIndex, setClubHeroIndex] = useState(0);
  const isCompactScreen = isCompactWidth(windowWidth);
  const clubHeroWidth = measuredClubHeroWidth || CLUB_HERO_MIN_WIDTH;
  const clubHeroHeight = Math.round(
    clubHeroWidth * CLUB_HERO_DISPLAY_HEIGHT_RATIO + insets.top,
  );
  const { activeClub: club, myClubs, setActiveClub, refreshClubs } = useClub();

  const clubHeroPageCount = myClubs.length + 1;
  const clubHeroItems: ClubHeroItem[] = [
    ...myClubs.map((heroClub) => ({ kind: "club" as const, club: heroClub })),
    { kind: "create" as const },
  ];
  const clubHeroClubIds = myClubs.map((item) => item.id).join("|");
  const { data, loading } = useAsync(
    () => (club ? getRoundSummaries(club.id) : Promise.resolve([])),
    [refreshKey, club?.id],
  );
  const { data: clubMembers } = useAsync(
    () => (club ? getClubMembers(club.id) : Promise.resolve([])),
    [refreshKey, club?.id],
  );
  const { data: lottoAwardConfig } = useAsync(
    () =>
      club
        ? getClubLottoAwardConfig(club.id)
        : Promise.resolve(DEFAULT_LOTTO_AWARD_CONFIG),
    [refreshKey, club?.id],
  );
  const { data: clubNotices } = useAsync(
    () => (club ? getClubNotices(club.id) : Promise.resolve([])),
    [refreshKey, club?.id],
  );
  const rounds = data ?? [];
  const members = clubMembers ?? [];
  const { data: lottoCarryoverAmount } = useAsync(
    () => calculateLottoCarryoverAmount(rounds, members),
    [refreshKey, club?.id, rounds.length, members.length],
  );
  // 설치 안내 1건을 항상 첫 번째로 표시하므로, 일반 공지는 최신 1건만 노출합니다.
  // 클럽 메뉴 공지 영역의 전체 노출 수는 최대 2건입니다.
  const recentNotices = (clubNotices ?? [])
    .filter((notice) => notice.isPublished)
    .slice(0, 1);
  const adminMembers = members.filter((member) => member.role === "admin");
  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const [rankingType, setRankingType] = useState<RankingType | null>(null);
  const [clubInfoOpen, setClubInfoOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<ClubNotice | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [showLottoAwardGuide, setShowLottoAwardGuide] = useState(false);
  const [showHallCriteria, setShowHallCriteria] = useState(false);
  const [manageMenuOpen, setManageMenuOpen] = useState(false);
  const [createClubOpen, setCreateClubOpen] = useState(false);
  const [courseImagesOpen, setCourseImagesOpen] = useState(false);
  const [lottoAwardOpen, setLottoAwardOpen] = useState(false);
  const { name: myName, userId: myUserId } = useUserProfile();

  const [handicapBasis, setHandicapBasis] = useState<HandicapBasis>(5);
  const currentLottoAwardConfig =
    lottoAwardConfig ?? DEFAULT_LOTTO_AWARD_CONFIG;
  const currentLottoCarryoverAmount =
    lottoCarryoverAmount ?? LOTTO_JACKPOT_BASE;

  useEffect(() => {
    loadHandicapBasis(club?.id).then(setHandicapBasis);
  }, [club?.id]);

  useEffect(() => {
    if (!club?.id || clubHeroWidth <= 0 || myClubs.length === 0) return;
    const nextIndex = myClubs.findIndex((item) => item.id === club.id);
    if (nextIndex < 0) return;
    setClubHeroIndex(nextIndex);
    requestAnimationFrame(() => {
      clubHeroScrollRef.current?.scrollToOffset({
        offset: nextIndex * clubHeroWidth,
        animated: false,
      });
    });
  }, [club?.id, clubHeroWidth, clubHeroClubIds]);

  const handleClubHeroScrollEnd = useCallback(
    (offsetX: number) => {
      if (clubHeroWidth <= 0) return;
      const nextIndex = Math.max(
        0,
        Math.min(clubHeroPageCount - 1, Math.round(offsetX / clubHeroWidth)),
      );
      setClubHeroIndex(nextIndex);
      const nextClub = myClubs[nextIndex];
      if (nextClub && nextClub.id !== club?.id) {
        setActiveClub(nextClub);
        setRefreshKey((key) => key + 1);
      }
    },
    [club?.id, clubHeroPageCount, clubHeroWidth, myClubs, setActiveClub],
  );

  const activeClubIdRef = useRef<string | null>(club?.id ?? null);
  const setActiveClubRef = useRef(setActiveClub);
  const clubHeroViewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  useEffect(() => {
    activeClubIdRef.current = club?.id ?? null;
  }, [club?.id]);

  useEffect(() => {
    setActiveClubRef.current = setActiveClub;
  }, [setActiveClub]);

  const handleClubHeroViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: ClubHeroItem; index: number | null; isViewable: boolean }> }) => {
      const visibleItem = viewableItems.find(
        (entry) => entry.isViewable && entry.index !== null,
      );
      if (!visibleItem || visibleItem.index === null) return;

      setClubHeroIndex(visibleItem.index);
      if (visibleItem.item.kind !== "club") return;

      const nextClub = visibleItem.item.club;
      if (nextClub.id !== activeClubIdRef.current) {
        setActiveClubRef.current(nextClub);
        setRefreshKey((key) => key + 1);
      }
    },
  ).current;



  async function handleInviteMember() {
    if (!club) return;
    const link = `${APP_URL}/?join=${club.inviteCode}`;
    const senderName = myName ?? "클럽 회원";
    const message = `[${senderName}]님이 [${club.name}] 골프 클럽에 초대합니다!\n\n${link}`;
    try {
      await Share.share({ title: `${club.name} 골프 클럽 초대`, message });
    } catch {
      Alert.alert("초대코드", club.inviteCode);
    }
  }

  async function handleSaveClubInfo(
    name: string,
    subtitle: string,
    coverImage?: string,
  ) {
    if (!club) return;
    await updateClubSettings(club.id, name, subtitle, coverImage);
    await refreshClubs();
    setRefreshKey((k) => k + 1);
  }

  async function handleCreateClub(name: string, subtitle: string) {
    const nextClub = await createClub(name, subtitle);
    await refreshClubs();
    setActiveClub(nextClub);
    setRefreshKey((k) => k + 1);
  }

  async function handleChangeHandicapBasis(value: HandicapBasis) {
    if (!club?.id) return;
    setHandicapBasis(value);
    await saveHandicapBasis(club.id, value);
  }

  const handicaps = computeHandicaps(rounds, handicapBasis);
  const sortedRounds = [...rounds].sort((a, b) => a.date.localeCompare(b.date));

  // 선수별 평균 타수 (기준 경기 수)
  const avgScoreByPlayer = new Map<string, number>();
  const scoresByPlayer = new Map<
    string,
    Array<{ date: string; score: number }>
  >();
  for (const r of rounds) {
    for (const p of r.players) {
      const arr = scoresByPlayer.get(p.name) ?? [];
      arr.push({ date: r.date, score: playerTotal(p.strokes) });
      scoresByPlayer.set(p.name, arr);
    }
  }
  for (const [name, entries] of scoresByPlayer) {
    const lastN = [...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-handicapBasis);
    avgScoreByPlayer.set(
      name,
      Math.round(lastN.reduce((s, e) => s + e.score, 0) / lastN.length),
    );
  }

  // 핸디캡 랭킹 (낮을수록 잘하는 것)
  const handicapRanking = [...handicaps.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name, h]) => ({
      name,
      handicap: h,
      avgScore: avgScoreByPlayer.get(name) ?? 0,
    }));

  // 우승 집계
  const winCount = new Map<string, number>();
  for (const r of sortedRounds) {
    const w = getWinner(r, handicaps);
    if (w) winCount.set(w, (winCount.get(w) ?? 0) + 1);
  }
  const winRanking = [...winCount.entries()]
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins);

  // 연속 우승
  let maxStreak = 0,
    maxStreakPlayer = "",
    curStreak = 0,
    curPlayer = "";
  for (const r of sortedRounds) {
    const w = getWinner(r, handicaps);
    if (w && w === curPlayer) {
      curStreak++;
    } else {
      if (curStreak > maxStreak) {
        maxStreak = curStreak;
        maxStreakPlayer = curPlayer;
      }
      curPlayer = w ?? "";
      curStreak = w ? 1 : 0;
    }
  }
  if (curStreak > maxStreak) {
    maxStreak = curStreak;
    maxStreakPlayer = curPlayer;
  }
  const streakRanking = [...winCount.keys()].map((name) => ({
    name,
    streak: 0,
  }));

  // 버디 집계
  const birdieCount = new Map<string, number>();
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0;
      p.strokes.forEach((s, i) => {
        if (s - r.pars[i] <= -1) b++;
      });
      birdieCount.set(p.name, (birdieCount.get(p.name) ?? 0) + b);
    }
  const birdieRanking = [...birdieCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 한경기 최다 버디
  const singleBirdieMap = new Map<
    string,
    { count: number; date: string; courseName: string }
  >();
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0;
      p.strokes.forEach((s, i) => {
        if (s - r.pars[i] <= -1) b++;
      });
      const prev = singleBirdieMap.get(p.name);
      if (!prev || b > prev.count)
        singleBirdieMap.set(p.name, {
          count: b,
          date: r.date,
          courseName: r.courseName,
        });
    }
  const singleBirdieRanking = [...singleBirdieMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  // 최근 5경기 메달리스트 / 우승자 (공동 포함)
  const recentMedalRows = rounds.slice(0, 5).map((r) => {
    const best = Math.min(...r.players.map((p) => playerTotal(p.strokes)));
    const medals = r.players
      .filter((p) => playerTotal(p.strokes) === best)
      .map((p) => p.name);
    const label =
      medals.length <= 3
        ? medals.map(shortName).join(", ")
        : `${shortName(medals[0])} 외 ${medals.length - 1}명`;
    return {
      name: label || "-",
      value: `${best}타`,
      sub: `${r.date.slice(5)} ${r.courseName}`,
    };
  });
  const recentWinsRows = rounds.slice(0, 5).map((r) => {
    const pts = r.players.map((p) => {
      const total = playerTotal(p.strokes);
      return { name: p.name, net: total - (handicaps.get(p.name) ?? 0), total };
    });
    const minNet = Math.min(...pts.map((p) => p.net));
    const winners = pts.filter((p) => p.net === minNet);
    const topGross = Math.min(...winners.map((w) => w.total));
    const label =
      winners.length <= 3
        ? winners.map((w) => shortName(w.name)).join(", ")
        : `${shortName(winners[0].name)} 외 ${winners.length - 1}명`;
    return {
      name: label || "-",
      value: `${topGross}타`,
      sub: `${r.date.slice(5)} ${r.courseName}`,
    };
  });

  const rankingConfig: Record<
    RankingType,
    {
      title: string;
      col: string;
      rows: { name: string; value: string; sub?: string }[];
    }
  > = {
    recentMedal: {
      title: "최근 5경기 메달리스트",
      col: "최저타",
      rows: recentMedalRows,
    },
    recentWins: {
      title: "최근 5경기 우승자",
      col: "핸디대비",
      rows: recentWinsRows,
    },
    wins: {
      title: "최다 우승",
      col: "우승 횟수",
      rows: winRanking.map((r) => ({
        name: shortName(r.name),
        value: `${r.wins}회`,
      })),
    },
    streak: {
      title: "최다 연속 우승",
      col: "연속",
      rows:
        maxStreak > 0
          ? [{ name: shortName(maxStreakPlayer), value: `${maxStreak}연승` }]
          : [],
    },
    lowestHandicap: {
      title: `핸디캡 랭킹 (최근 ${handicapBasis}경기)`,
      col: "평균타 (핸디)",
      rows: handicapRanking.map((r) => ({
        name: shortName(r.name),
        value: r.avgScore
          ? `${r.avgScore} (${diffText(r.handicap)})`
          : diffText(r.handicap),
      })),
    },
    birdie: {
      title: "버디왕 (전체)",
      col: "버디 수",
      rows: birdieRanking.map((r) => ({
        name: shortName(r.name),
        value: `${r.count}개`,
      })),
    },
    singleBirdie: {
      title: "버디왕 (1경기)",
      col: "버디 수",
      rows: singleBirdieRanking.map((r) => ({
        name: shortName(r.name),
        value: `${r.count}개`,
        sub: `${r.date.slice(5)} ${r.courseName}`,
      })),
    },
  };

  // 최근 라운드
  const recent3 = rounds.slice(0, 3);

  const topWinner = winRanking[0];
  const latestRound = rounds[0];
  const lowestHandicapEntry = [...handicaps.entries()].sort(
    (a, b) => a[1] - b[1],
  )[0];
  const topBirdie = birdieRanking[0];
  const topSingleBirdie = singleBirdieRanking[0];

  // 공동 수상 포함 텍스트 계산
  const recentMedalText = (() => {
    if (!latestRound) return "-";
    const best = Math.min(
      ...latestRound.players.map((p) => playerTotal(p.strokes)),
    );
    const names = latestRound.players
      .filter((p) => playerTotal(p.strokes) === best)
      .map((p) => p.name);
    return formatWinners(names, `${best}타`);
  })();

  const recentWinnerText = (() => {
    if (!latestRound) return "-";
    const pts = latestRound.players.map((p) => {
      const total = playerTotal(p.strokes);
      return { name: p.name, net: total - (handicaps.get(p.name) ?? 0), total };
    });
    const minNet = Math.min(...pts.map((p) => p.net));
    const winners = pts.filter((p) => p.net === minNet);
    const topGross = Math.min(...winners.map((w) => w.total));
    return formatWinners(
      winners.map((w) => w.name),
      `${topGross}타`,
    );
  })();

  const mostWinsText = (() => {
    if (!topWinner) return "-";
    const tied = winRanking.filter((r) => r.wins === topWinner.wins);
    return formatWinners(
      tied.map((r) => r.name),
      `${topWinner.wins}회`,
    );
  })();

  const lowestHandiText = (() => {
    if (!lowestHandicapEntry) return "-";
    const minH = lowestHandicapEntry[1];
    const tied = [...handicaps.entries()]
      .filter(([, h]) => h === minH)
      .map(([n]) => n);
    return formatWinners(tied, diffText(minH));
  })();

  const topBirdieText = (() => {
    if (!topBirdie || topBirdie.count === 0) return "-";
    const tied = birdieRanking.filter((r) => r.count === topBirdie.count);
    return formatWinners(
      tied.map((r) => r.name),
      `${topBirdie.count}개`,
    );
  })();

  const topSingleBirdieText = (() => {
    if (!topSingleBirdie) return "-";
    const tied = singleBirdieRanking.filter(
      (r) => r.count === topSingleBirdie.count,
    );
    return formatWinners(
      tied.map((r) => r.name),
      `${topSingleBirdie.count}개`,
    );
  })();

  const highlights = [
    {
      icon: "🏆",
      label: "최근 메달리스트",
      value: recentMedalText,
      type: "recentMedal" as RankingType,
    },
    {
      icon: "🥇",
      label: "최근 우승",
      value: recentWinnerText,
      type: "recentWins" as RankingType,
    },
    {
      icon: "🏅",
      label: "최다 우승",
      value: mostWinsText,
      type: "wins" as RankingType,
    },
    {
      icon: "🔥",
      label: "최다 연속 우승",
      value:
        maxStreak > 0
          ? `${shortName(maxStreakPlayer)} (${maxStreak}연승)`
          : "-",
      type: "streak" as RankingType,
    },
    {
      icon: "📉",
      label: "최저 핸디",
      value: lowestHandiText,
      type: "lowestHandicap" as RankingType,
    },
    {
      icon: "🐦",
      label: "버디왕 (전체)",
      value: topBirdieText,
      type: "birdie" as RankingType,
    },
    {
      icon: "⛳",
      label: "버디왕 (1경기)",
      value: topSingleBirdieText,
      type: "singleBirdie" as RankingType,
    },
  ];

  const MEDAL_BG = ["#fffbe8", "#f4f6f8", "#fdf5f0"];
  const MEDAL_COLOR = [C.gold, C.silver, C.bronze];
  const isManagerView = club?.role === "admin";
  const summaryCardActionLabel = isManagerView ? "관리하기" : "전체보기";

  useEffect(() => {
    if (!route.params?.openManageMenu || !isManagerView) return;
    setManageMenuOpen(true);
    nav.dispatch(CommonActions.setParams({ openManageMenu: false }));
  }, [route.params?.openManageMenu, isManagerView, nav]);

  useEffect(() => {
    if (!route.params?.openCreateClub) return;
    setCreateClubOpen(true);
    nav.dispatch(CommonActions.setParams({ openCreateClub: false }));
  }, [route.params?.openCreateClub, nav]);

  const managementMenus = club
    ? [
        {
          key: "roundSchedule",
          title: "라운드 관리",
          subtitle:
            "날짜, 시간, 골프장 정보를 등록하고 예정 라운드를 관리합니다",
          icon: "flag" as const,
          onPress: () =>
            nav.navigate("RoundSchedulePrototype", {
              returnToManageMenu: true,
            }),
        },
        {
          key: "courseImages",
          title: "골프장 사진 관리",
          subtitle: "골프장 계절별 Hero 사진을 등록합니다",
          icon: "camera" as const,
          onPress: () => setCourseImagesOpen(true),
        },
        {
          key: "heroLab",
          title: "Hero Lab",
          subtitle: "골프장 Hero 이미지를 미리보고 홈 화면에 적용합니다",
          icon: "settings" as const,
          onPress: () => nav.navigate("HeroLab"),
        },
      ]
    : [];

  const handleLeaveClub = useCallback(async () => {
    if (!club?.id) {
      throw new Error("클럽 정보를 확인할 수 없습니다.");
    }

    const leavingClubName = club.name;
    await leaveClub(club.id);
    await refreshClubs();
    notifyHomeDashboardChanged();
    setClubInfoOpen(false);
    setRefreshKey((key) => key + 1);

    Alert.alert("탈퇴 완료", `${leavingClubName}에서 탈퇴했습니다.`);
    nav.dispatch(CommonActions.navigate({ name: "Home" }));
  }, [club?.id, club?.name, nav, refreshClubs]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {rankingType && (
        <RankingModal
          config={rankingConfig[rankingType]}
          onClose={() => setRankingType(null)}
        />
      )}
      {clubInfoOpen && club && (
        <ClubInfoModal
          club={club}
          memberCount={members.length}
          admins={adminMembers}
          onClose={() => setClubInfoOpen(false)}
          onSaveClub={handleSaveClubInfo}
          handicapBasis={handicapBasis}
          onChangeHandicapBasis={handleChangeHandicapBasis}
          onMembers={() => {
            setClubInfoOpen(false);
            nav.navigate("Members", { clubId: club.id });
          }}
          onInvite={handleInviteMember}
          onLeaveClub={handleLeaveClub}
        />
      )}
      {createClubOpen && (
        <CreateClubModal
          compact={isCompactScreen}
          windowHeight={windowHeight}
          onClose={() => setCreateClubOpen(false)}
          onCreate={async (name, subtitle) => {
            await handleCreateClub(name, subtitle);
            setCreateClubOpen(false);
          }}
        />
      )}
      {lottoAwardOpen && club && (
        <LottoAwardConfigModal
          config={lottoAwardConfig ?? DEFAULT_LOTTO_AWARD_CONFIG}
          carryoverAmount={currentLottoCarryoverAmount}
          onClose={() => setLottoAwardOpen(false)}
          onSave={async (config) => {
            await saveClubLottoAwardConfig(club.id, config);
            setRefreshKey((key) => key + 1);
            setLottoAwardOpen(false);
          }}
        />
      )}
      {showLottoAwardGuide && (
        <LottoAwardGuideModal
          config={currentLottoAwardConfig}
          carryoverAmount={currentLottoCarryoverAmount}
          onClose={() => setShowLottoAwardGuide(false)}
        />
      )}
      {courseImagesOpen && (
        <CourseSeasonImageModal
          compact={isCompactScreen}
          windowHeight={windowHeight}
          onClose={() => setCourseImagesOpen(false)}
        />
      )}
      {manageMenuOpen && isManagerView && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setManageMenuOpen(false)}
        >
          <TouchableOpacity
            style={s.overlay}
            activeOpacity={1}
            onPress={() => setManageMenuOpen(false)}
          >
            <TouchableOpacity
              style={[
                s.modalCard,
                {
                  width: isCompactScreen ? "94%" : "90%",
                  maxHeight: Math.round(windowHeight * 0.86),
                  padding: isCompactScreen ? 16 : 20,
                },
              ]}
              activeOpacity={1}
              onPress={() => {}}
            >
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>관리 메뉴</Text>
                <TouchableOpacity
                  style={s.closeBtn}
                  onPress={() => setManageMenuOpen(false)}
                >
                  <Text style={s.closeBtnText}>닫기</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={[
                  s.managementModalBody,
                  {
                    gap: isCompactScreen ? 8 : 10,
                    paddingBottom: insets.bottom + 8,
                  },
                ]}
              >
                {managementMenus.map((menu) => (
                  <TouchableOpacity
                    key={menu.key}
                    style={[
                      s.managementModalRow,
                      isCompactScreen && s.managementModalRowCompact,
                      menu.featured && s.managementCardFeatured,
                    ]}
                    onPress={() => {
                      setManageMenuOpen(false);
                      menu.onPress();
                    }}
                    activeOpacity={0.86}
                  >
                    <View
                      style={[
                        s.managementIcon,
                        isCompactScreen && s.managementIconCompact,
                        menu.featured && s.managementIconFeatured,
                      ]}
                    >
                      <Icon
                        name={menu.icon}
                        size={20}
                        color={menu.featured ? C.accentText : C.greenDark}
                        strokeWidth={2}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.managementTitle,
                          isCompactScreen && s.managementTitleCompact,
                        ]}
                      >
                        {menu.title}
                      </Text>
                      <Text
                        style={[
                          s.managementSubtitle,
                          isCompactScreen && s.managementSubtitleCompact,
                        ]}
                      >
                        {menu.subtitle}
                      </Text>
                    </View>
                    <Icon name="chevronRight" size={16} color={C.muted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
      <PwaInstallGuide
        visible={installGuideOpen}
        onClose={() => setInstallGuideOpen(false)}
      />

      {selectedNotice && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedNotice(null)}
        >
          <TouchableOpacity
            style={s.overlay}
            activeOpacity={1}
            onPress={() => setSelectedNotice(null)}
          >
            <TouchableOpacity
              style={s.modalCard}
              activeOpacity={1}
              onPress={() => {}}
            >
              <View style={s.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>{selectedNotice.title}</Text>
                  <Text style={s.noticeDetailDate}>
                    {formatNoticeDate(selectedNotice.createdAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.closeBtn}
                  onPress={() => setSelectedNotice(null)}
                >
                  <Text style={s.closeBtnText}>닫기</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                <Text style={s.noticeDetailBody}>
                  {selectedNotice.body || "내용 없음"}
                </Text>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {showHallCriteria && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setShowHallCriteria(false)}
        >
          <TouchableOpacity
            style={s.overlay}
            activeOpacity={1}
            onPress={() => setShowHallCriteria(false)}
          >
            <TouchableOpacity
              style={s.modalCard}
              activeOpacity={1}
              onPress={() => {}}
            >
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>기네스북 기록 기준</Text>
                <TouchableOpacity
                  style={s.closeBtn}
                  onPress={() => setShowHallCriteria(false)}
                >
                  <Text style={s.closeBtnText}>닫기</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                <View style={s.ruleRow}>
                  <Text style={s.ruleLabel}>우승 기록</Text>
                  <Text style={s.ruleValue}>최다 우승 · 최다 연속 우승</Text>
                </View>
                <View style={s.ruleRow}>
                  <Text style={s.ruleLabel}>스코어 기록</Text>
                  <Text style={s.ruleValue}>
                    최저타 · 최고타 · 버디왕 · 파왕
                  </Text>
                </View>
                <View style={s.ruleRow}>
                  <Text style={s.ruleLabel}>성장 기록</Text>
                  <Text style={s.ruleValue}>
                    최저 핸디 · 전후반/평균타/핸디 개선
                  </Text>
                </View>
                <View style={s.ruleRow}>
                  <Text style={s.ruleLabel}>참가 기록</Text>
                  <Text style={s.ruleValue}>최다 라운드 참가</Text>
                </View>
                <View style={s.ruleRow}>
                  <Text style={s.ruleLabel}>핸디 기준</Text>
                  <Text style={s.ruleValue}>최근 {handicapBasis}경기</Text>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={C.green}
          />
        }
      >
        <View
          style={[s.content, { paddingHorizontal: isCompactScreen ? 12 : 16 }]}
        >
          {club && (
            <>
              <View
                onLayout={(event) => {
                  const nextWidth = Math.round(event.nativeEvent.layout.width);
                  if (nextWidth > 0 && nextWidth !== measuredClubHeroWidth) {
                    setMeasuredClubHeroWidth(nextWidth);
                  }
                }}
                style={[
                  s.clubHeroViewport,
                  {
                    marginHorizontal: isCompactScreen ? -12 : -16,
                    marginTop: -12,
                    height: clubHeroHeight,
                  },
                ]}
              >
                <FlatList
                  ref={clubHeroScrollRef}
                  horizontal
                  pagingEnabled
                  data={clubHeroItems}
                  keyExtractor={(item, index) =>
                    item.kind === "club" ? item.club.id : `create-${index}`
                  }
                  decelerationRate="fast"
                  snapToInterval={clubHeroWidth}
                  getItemLayout={(_, index) => ({
                    length: clubHeroWidth,
                    offset: clubHeroWidth * index,
                    index,
                  })}
                  showsHorizontalScrollIndicator={false}
                  bounces={false}
                  scrollEventThrottle={16}
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  removeClippedSubviews
                  viewabilityConfig={clubHeroViewabilityConfig}
                  onViewableItemsChanged={handleClubHeroViewableItemsChanged}
                  onMomentumScrollEnd={(event) =>
                    handleClubHeroScrollEnd(event.nativeEvent.contentOffset.x)
                  }
                  onScrollEndDrag={(event) => {
                    const velocityX = event.nativeEvent.velocity?.x ?? 0;
                    if (Math.abs(velocityX) < 0.05) {
                      handleClubHeroScrollEnd(event.nativeEvent.contentOffset.x);
                    }
                  }}
                  renderItem={({ item }) => {
                    if (item.kind === "create") {
                      return (
                        <View
                          style={[
                            s.clubHeroCard,
                            s.createClubHeroCard,
                            { width: clubHeroWidth, height: clubHeroHeight },
                          ]}
                        >
                          <View style={s.createClubHeroContent}>
                            <View style={s.createClubHeroIcon}>
                              <Text style={s.createClubHeroPlus}>＋</Text>
                            </View>
                            <Text style={s.createClubHeroTitle}>
                              새 동호회 만들기
                            </Text>
                            <Text style={s.createClubHeroDescription}>
                              새로운 골프 동호회를 만들고 회원을 초대해 보세요.
                            </Text>
                            <TouchableOpacity
                              style={s.createClubHeroButton}
                              onPress={() => setCreateClubOpen(true)}
                              activeOpacity={0.86}
                            >
                              <Text style={s.createClubHeroButtonText}>
                                동호회 만들기
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }

                    const heroClub = item.club;
                    return (
                      <View
                        style={[
                          s.clubHeroCard,
                          { width: clubHeroWidth, height: clubHeroHeight },
                        ]}
                      >
                        <Image
                          source={{ uri: heroClub.coverImage || CLUB_HERO_IMAGE }}
                          style={s.clubHeroImage}
                          resizeMode="cover"
                        />
                        <View style={s.clubHeroScrim} />
                        <View
                          style={[
                            s.clubHeroBody,
                            {
                              left: isCompactScreen ? 16 : 20,
                              right: isCompactScreen ? 16 : 20,
                              bottom: isCompactScreen ? 28 : 32,
                              gap: isCompactScreen ? 8 : 12,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={s.clubHeroLabel}>MY CLUB</Text>
                            <Text
                              style={[
                                s.clubHeroName,
                                { fontSize: isCompactScreen ? 22 : 26 },
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.82}
                            >
                              {heroClub.name}
                            </Text>
                            <Text
                              style={[
                                s.clubHeroMeta,
                                {
                                  fontSize: isCompactScreen ? 12 : 13,
                                  lineHeight: isCompactScreen ? 17 : 19,
                                },
                              ]}
                              numberOfLines={2}
                            >
                              {heroClub.subtitle?.trim()
                                ? heroClub.subtitle
                                : "운영 중인 골프 클럽"}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              s.clubInfoBtn,
                              {
                                paddingHorizontal: isCompactScreen ? 12 : 15,
                                paddingVertical: isCompactScreen ? 8 : 10,
                              },
                            ]}
                            onPress={() => {
                              if (heroClub.id !== club?.id) {
                                setActiveClub(heroClub);
                                setRefreshKey((key) => key + 1);
                              }
                              setClubInfoOpen(true);
                            }}
                            activeOpacity={0.84}
                          >
                            <Text style={s.clubInfoBtnText}>클럽 정보</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                />

                <TopActionButtons topInset={insets.top} floating />
                <View style={s.clubHeroPagination} pointerEvents="none">
                  {Array.from({ length: clubHeroPageCount }).map((_, index) => (
                    <View
                      key={index}
                      style={[
                        s.clubHeroDot,
                        index === clubHeroIndex && s.clubHeroDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={[s.card, s.summaryCard, s.noticeSummaryCard]}>
                <View style={[s.cardTitleRow, s.noticeCardTitleRow]}>
                  <Text style={[s.cardTitle, { marginBottom: 0 }]}>
                    공지사항
                  </Text>
                  <TouchableOpacity
                    onPress={() => nav.navigate("NoticePrototype")}
                    activeOpacity={0.82}
                  >
                    <Text style={s.more}>{summaryCardActionLabel}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={s.noticeRow}
                  onPress={() => setInstallGuideOpen(true)}
                  activeOpacity={0.82}
                >
                  <Text style={s.noticeTitle} numberOfLines={1}>
                    📱 GogoPar 홈 화면에 설치하기
                  </Text>
                  <Text style={s.noticeMeta}>설치안내</Text>
                </TouchableOpacity>
                {recentNotices.map((notice) => (
                  <TouchableOpacity
                    key={notice.id}
                    style={s.noticeRow}
                    onPress={() => setSelectedNotice(notice)}
                    activeOpacity={0.82}
                  >
                    <Text style={s.noticeTitle} numberOfLines={1}>
                      {notice.title}
                    </Text>
                    <Text style={s.noticeMeta}>
                      {formatNoticeDate(notice.createdAt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[s.card, s.summaryCard, s.lottoSummaryCard]}>
                <TouchableOpacity
                  style={s.lottoSummaryTouchable}
                  onPress={() => {
                    if (isManagerView) setLottoAwardOpen(true);
                    else setShowLottoAwardGuide(true);
                  }}
                  activeOpacity={0.82}
                >
                  <View style={s.lottoSummaryTextArea}>
                    <Text style={s.lottoSummaryTitle}>
                      Lotto 6/18 당첨금 안내
                    </Text>
                    <Text style={s.lottoGuideSummary}>
                      현재 누적 당첨금 {formatWon(currentLottoCarryoverAmount)}
                    </Text>
                  </View>
                  <View style={s.lottoSummaryActionArea}>
                    <Text style={s.more}>{summaryCardActionLabel}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.card, s.summaryCard]}
                onPress={() => setShowHallCriteria(true)}
                activeOpacity={0.82}
              >
                <View style={s.cardTitleRow}>
                  <Text style={[s.cardTitle, { marginBottom: 0 }]}>
                    기네스북 기록 기준
                  </Text>
                  <Text style={s.more}>{summaryCardActionLabel}</Text>
                </View>
                <Text style={s.criteriaCollapsedText}>
                  기네스북에 반영되는 기록 기준을 확인합니다.
                </Text>
              </TouchableOpacity>

              {club && (
                <TouchableOpacity
                  style={[s.card, s.summaryCard]}
                  onPress={() =>
                    nav.navigate("FeePrototype", { returnToManageMenu: true })
                  }
                  activeOpacity={0.86}
                >
                  <View style={s.cardTitleRow}>
                    <Text style={[s.cardTitle, { marginBottom: 0 }]}>
                      회비관리 현황
                    </Text>
                    <Text style={s.more}>{summaryCardActionLabel}</Text>
                  </View>
                  <Text style={s.criteriaCollapsedText}>
                    회비 현황과 납부 상태를 확인합니다.
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* 클럽 없음 */}
          {!club && !loading && (
            <View style={s.emptyCard}>
              <Icon name="flag" size={38} color={C.green} strokeWidth={1.6} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: C.text,
                  marginBottom: 6,
                  marginTop: 12,
                }}
              >
                소속 클럽이 없어요
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: C.muted,
                  textAlign: "center",
                  lineHeight: 20,
                }}
              >
                동호회를 만들거나{"\n"}초대 링크로 참여해보세요
              </Text>
              <TouchableOpacity
                style={s.goProfileBtn}
                onPress={() => setCreateClubOpen(true)}
              >
                <Text style={s.goProfileBtnText}>동호회 만들기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.emptySecondaryBtn}
                onPress={() => nav.navigate("Profile")}
              >
                <Text style={s.emptySecondaryText}>프로필 바로가기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function CreateClubModal({
  compact,
  windowHeight,
  onClose,
  onCreate,
}: {
  compact: boolean;
  windowHeight: number;
  onClose: () => void;
  onCreate: (name: string, subtitle: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("입력 확인", "동호회 이름을 입력하세요.");
      return;
    }

    setSaving(true);
    try {
      await onCreate(trimmedName, subtitle.trim());
      Alert.alert("생성 완료", "새 동호회를 만들었습니다.");
    } catch (error) {
      Alert.alert(
        "오류",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={[
            s.modalCard,
            {
              width: compact ? "94%" : "90%",
              maxHeight: Math.round(windowHeight * 0.82),
              padding: compact ? 16 : 20,
            },
          ]}
          activeOpacity={1}
          onPress={() => {}}
        >
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>새 동호회 만들기</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.createClubLabel}>동호회 이름</Text>
          <TextInput
            style={s.clubInfoInput}
            value={name}
            onChangeText={setName}
            placeholder="예: 힐스카이 골프회"
            maxLength={24}
            placeholderTextColor={C.muted}
          />

          <Text style={s.createClubLabel}>소개 문구</Text>
          <TextInput
            style={s.clubInfoInput}
            value={subtitle}
            onChangeText={setSubtitle}
            placeholder="예: 골프의 모든 경험을 하나로."
            maxLength={40}
            placeholderTextColor={C.muted}
          />

          <TouchableOpacity
            style={[s.createClubSubmitBtn, saving && { opacity: 0.55 }]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.86}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.createClubSubmitText}>동호회 만들기</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function ClubInfoModal({
  club,
  memberCount,
  admins,
  onClose,
  onSaveClub,
  handicapBasis,
  onChangeHandicapBasis,
  onMembers,
  onInvite,
  onLeaveClub,
}: {
  club: ClubInfo;
  memberCount: number;
  admins: Array<{ userId: string; name: string; role: string }>;
  onClose: () => void;
  onSaveClub: (
    name: string,
    subtitle: string,
    coverImage?: string,
  ) => Promise<void>;
  handicapBasis: 3 | 5 | 10;
  onChangeHandicapBasis: (value: 3 | 5 | 10) => void | Promise<void>;
  onMembers: () => void;
  onInvite: () => void;
  onLeaveClub: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(club.name);
  const [editSubtitle, setEditSubtitle] = useState(club.subtitle);
  const [editCoverImage, setEditCoverImage] = useState(club.coverImage);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [pendingCoverCrop, setPendingCoverCrop] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [showHandicapDrop, setShowHandicapDrop] = useState(false);
  const [leavingClub, setLeavingClub] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const isAdmin = club.role === "admin";
  const isSoleAdmin = isAdmin && admins.length <= 1;
  const subtitle = club.subtitle?.trim()
    ? club.subtitle
    : "골프의 모든 경험을 하나로.";
  const role = isAdmin ? "관리자" : "일반회원";

  useEffect(() => {
    setEditing(false);
    setEditName(club.name);
    setEditSubtitle(club.subtitle);
    setEditCoverImage(club.coverImage);
    setLeaveError(null);
  }, [club.id, club.name, club.subtitle, club.coverImage]);

  async function handleSave() {
    if (!editName.trim()) {
      Alert.alert("클럽명을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      await onSaveClub(editName.trim(), editSubtitle.trim(), editCoverImage);
      setEditing(false);
    } catch (e: unknown) {
      Alert.alert("오류", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function executeLeaveClub() {
    if (leavingClub) return;

    setLeaveError(null);
    setLeavingClub(true);
    try {
      await onLeaveClub();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "클럽 탈퇴 중 오류가 발생했습니다.";
      setLeaveError(message);
      if (Platform.OS !== "web") {
        Alert.alert("탈퇴 실패", message);
      }
    } finally {
      setLeavingClub(false);
    }
  }

  function handleLeavePress() {
    if (isSoleAdmin) {
      Alert.alert(
        "클럽 탈퇴 불가",
        "현재 이 클럽의 유일한 관리자입니다. 다른 회원을 관리자로 지정한 후 탈퇴해 주세요.",
        [{ text: "확인" }],
      );
      return;
    }

    const message = `${club.name}에서 탈퇴하시겠습니까?\n\n탈퇴 후에는 클럽 공지, 일정, 멤버 정보를 볼 수 없습니다. 과거 라운드 기록은 유지됩니다.`;

    if (Platform.OS === "web") {
      const confirmed =
        typeof globalThis.confirm === "function"
          ? globalThis.confirm(message)
          : false;
      if (confirmed) {
        void executeLeaveClub();
      }
      return;
    }

    Alert.alert("클럽 탈퇴", message, [
      { text: "취소", style: "cancel" },
      {
        text: "탈퇴",
        style: "destructive",
        onPress: () => {
          void executeLeaveClub();
        },
      },
    ]);
  }

  async function handlePickCoverImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("권한 필요", "사진 접근 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingCoverCrop({
      uri: asset.uri,
      width: asset.width || 1600,
      height: asset.height || 900,
    });
  }

  async function handleApplyCoverCrop(crop: ImageCropRect) {
    if (!pendingCoverCrop) return;
    setPendingCoverCrop(null);
    setUploadingCover(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        pendingCoverCrop.uri,
        [{ crop }, { resize: { width: 720 } }],
        {
          compress: 0.45,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      const dataUri = `data:image/jpeg;base64,${compressed.base64}`;
      if (dataUri.length > 220000) {
        Alert.alert("사진이 너무 큽니다", "더 작은 사진을 선택해주세요.");
        return;
      }
      setEditCoverImage(dataUri);
    } catch {
      Alert.alert("오류", "사진 처리에 실패했습니다.");
    } finally {
      setUploadingCover(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      {pendingCoverCrop && (
        <ImageCropModal
          uri={pendingCoverCrop.uri}
          width={pendingCoverCrop.width}
          height={pendingCoverCrop.height}
          aspect={[16, 10.5]}
          title="클럽 대문사진 자르기"
          onCancel={() => setPendingCoverCrop(null)}
          onConfirm={handleApplyCoverCrop}
        />
      )}
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={s.modalCard}
          activeOpacity={1}
          onPress={() => {}}
        >
          <ScrollView
            style={s.clubInfoModalScroll}
            contentContainerStyle={s.clubInfoModalScrollContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              {editing ? (
                <>
                  <TouchableOpacity
                    style={s.clubCoverPicker}
                    onPress={handlePickCoverImage}
                    activeOpacity={0.86}
                  >
                    <Image
                      source={{ uri: editCoverImage || CLUB_HERO_IMAGE }}
                      style={s.clubCoverPreview}
                      resizeMode="cover"
                    />
                    <View style={s.clubCoverOverlay}>
                      {uploadingCover ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={s.clubCoverText}>대문 사진 변경</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TextInput
                    style={s.clubInfoInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="클럽명"
                    maxLength={24}
                    placeholderTextColor={C.muted}
                  />
                  <TextInput
                    style={s.clubInfoInput}
                    value={editSubtitle}
                    onChangeText={setEditSubtitle}
                    placeholder="부제"
                    maxLength={40}
                    placeholderTextColor={C.muted}
                  />
                  {editCoverImage ? (
                    <TouchableOpacity
                      style={s.clubCoverResetBtn}
                      onPress={() => setEditCoverImage("")}
                      activeOpacity={0.82}
                    >
                      <Text style={s.clubCoverResetText}>
                        기본 사진으로 변경
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={s.clubInfoTitle}>{club.name}</Text>
                  <Text style={s.clubInfoSubtitle}>{subtitle}</Text>
                </>
              )}
            </View>
            <View style={s.clubInfoHeaderActions}>
              {isAdmin ? (
                <TouchableOpacity
                  style={[s.clubInfoHeaderSaveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.82}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.clubInfoHeaderSaveText}>저장</Text>
                  )}
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                <Text style={s.closeBtnText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isAdmin && (
            <View style={s.clubEditRow}>
              {editing ? (
                <TouchableOpacity
                  style={s.clubEditBtn}
                  onPress={() => setEditing(false)}
                  activeOpacity={0.82}
                >
                  <Text style={s.clubEditText}>수정 취소</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={s.clubEditBtn}
                  onPress={() => setEditing(true)}
                  activeOpacity={0.82}
                >
                  <Text style={s.clubEditText}>클럽 정보 수정</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={s.clubInfoStatsText}>
            회원 {memberCount}명 · 운영진 {admins.length}명 · 내 역할 {role}
          </Text>

          {isAdmin && (
            <View style={[s.infoSection, { zIndex: 20 }]}>
              <Text style={s.infoSectionTitle}>운영 기준</Text>
              <View style={s.infoDivider} />
              <View style={s.settingLine}>
                <Text style={s.settingLineLabel}>핸디 기준 경기</Text>
                <View>
                  <TouchableOpacity
                    style={s.handicapSelectBtn}
                    onPress={() => setShowHandicapDrop((value) => !value)}
                    activeOpacity={0.82}
                  >
                    <Text style={s.handicapSelectText}>
                      {handicapBasis}경기 ▾
                    </Text>
                  </TouchableOpacity>
                  {showHandicapDrop && (
                    <View style={s.handicapMenu}>
                      {([3, 5, 10] as const).map((value) => (
                        <TouchableOpacity
                          key={value}
                          style={s.handicapMenuItem}
                          onPress={async () => {
                            setShowHandicapDrop(false);
                            await onChangeHandicapBasis(value);
                          }}
                          activeOpacity={0.82}
                        >
                          <Text
                            style={[
                              s.handicapMenuText,
                              handicapBasis === value &&
                                s.handicapMenuTextActive,
                            ]}
                          >
                            {value}경기{handicapBasis === value ? " ✓" : ""}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          <View style={s.infoSection}>
            <Text style={s.infoSectionTitle}>멤버</Text>
            <View style={s.infoDivider} />
            <Text style={s.infoLabel}>운영진</Text>
            {admins.length > 0 ? (
              admins.map((admin) => (
                <View key={admin.userId} style={s.adminRow}>
                  <Text style={s.adminName}>{admin.name}</Text>
                  <Text style={s.adminRole}>관리자</Text>
                </View>
              ))
            ) : (
              <Text style={s.infoMuted}>등록된 운영진이 없습니다.</Text>
            )}
            <View style={s.infoActionRow}>
              <TouchableOpacity
                style={s.infoActionBtn}
                onPress={onMembers}
                activeOpacity={0.82}
              >
                <Text style={s.infoActionText}>전체 멤버 보기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.infoActionBtn}
                onPress={onInvite}
                activeOpacity={0.82}
              >
                <Text style={s.infoActionText}>멤버 초대</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.infoSection}>
            <Text style={s.infoSectionTitle}>회칙</Text>
            <View style={s.infoDivider} />
            <Text style={s.ruleDesc}>
              회원 자격, 회비, 운영진, 탈퇴 기준 등 동호회 운영 기준을
              확인합니다.
            </Text>
            <Text style={s.infoMuted}>최근 수정일: 2026.06.30</Text>
            <TouchableOpacity style={s.infoActionBtn} activeOpacity={0.82}>
              <Text style={s.infoActionText}>회칙 보기</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.infoSection, s.dangerSection]}>
            <Text style={s.dangerSectionTitle}>위험 작업</Text>
            <View style={[s.infoDivider, s.dangerDivider]} />
            <Text style={s.dangerTitle}>클럽 탈퇴</Text>
            <Text style={s.dangerDesc}>
              이 클럽의 공지, 일정과 멤버 정보에 더 이상 접근할 수 없습니다.
              과거 라운드 기록은 유지됩니다.
            </Text>
            {isSoleAdmin ? (
              <Text style={s.dangerWarning}>
                유일한 관리자는 탈퇴할 수 없습니다. 다른 회원을 관리자로 지정해
                주세요.
              </Text>
            ) : null}
            {leaveError ? (
              <Text style={s.dangerError}>{leaveError}</Text>
            ) : null}
            <TouchableOpacity
              style={[
                s.leaveClubBtn,
                (leavingClub || isSoleAdmin) && s.leaveClubBtnDisabled,
              ]}
              onPress={handleLeavePress}
              disabled={leavingClub || isSoleAdmin}
              activeOpacity={0.82}
            >
              {leavingClub ? (
                <ActivityIndicator color="#c93636" size="small" />
              ) : (
                <Text
                  style={[
                    s.leaveClubBtnText,
                    isSoleAdmin && s.leaveClubBtnTextDisabled,
                  ]}
                >
                  클럽 탈퇴
                </Text>
              )}
            </TouchableOpacity>
          </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── 랭킹 모달 ────────────────────────────────────────────────────────────────

function RankingModal({
  config,
  onClose,
}: {
  config: {
    title: string;
    col: string;
    rows: { name: string; value: string; sub?: string }[];
  };
  onClose: () => void;
}) {
  const MEDAL_BG = ["#fffbe8", "#f4f6f8", "#fdf5f0"];
  const MEDAL_COLOR = [C.gold, C.silver, C.bronze];
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={s.modalCard}
          activeOpacity={1}
          onPress={() => {}}
        >
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{config.title}</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 0.6 }]}>순위</Text>
              <Text style={[s.th, { flex: 2.5 }]}>플레이어</Text>
              <Text style={[s.th, { flex: 1.5, textAlign: "right" }]}>
                {config.col}
              </Text>
            </View>
            {config.rows.length === 0 ? (
              <Text style={[s.muted, { padding: 16, textAlign: "center" }]}>
                데이터 없음
              </Text>
            ) : (
              config.rows.map((row, i) => (
                <View
                  key={i}
                  style={[
                    s.tableRow,
                    i < 3 && {
                      backgroundColor: MEDAL_BG[i],
                      borderRadius: 8,
                      marginBottom: 2,
                    },
                  ]}
                >
                  <View style={{ flex: 0.6, alignItems: "center" }}>
                    {i < 3 ? (
                      <EmojiIcon char={["🥇", "🥈", "🥉"][i]} size={17} />
                    ) : (
                      <Text style={[s.td, { fontSize: 13 }]}>{i + 1}</Text>
                    )}
                  </View>
                  <View style={{ flex: 2.5 }}>
                    <Text style={[s.td, { fontWeight: i < 3 ? "700" : "500" }]}>
                      {row.name}
                    </Text>
                    {row.sub && (
                      <Text style={{ fontSize: 11, color: C.muted }}>
                        {row.sub}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      s.td,
                      {
                        flex: 1.5,
                        textAlign: "right",
                        fontWeight: "700",
                        color: i < 3 ? MEDAL_COLOR[i] : C.text,
                      },
                    ]}
                  >
                    {row.value}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function LottoAwardGuideModal({
  config,
  carryoverAmount,
  onClose,
}: {
  config: LottoAwardConfig;
  carryoverAmount: number;
  onClose: () => void;
}) {
  const rows = [
    { label: "3개 적중", value: formatWon(config.prizes["3"]) },
    { label: "4개 적중", value: formatWon(config.prizes["4"]) },
    { label: "5개 적중", value: formatWon(config.prizes["5"]) },
    { label: "6개 적중", value: formatWon(carryoverAmount) },
    {
      label: "미당첨 이월",
      value: config.rollover
        ? `${formatWon(LOTTO_JACKPOT_STEP)} 증가`
        : "미적용",
    },
  ];

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={s.modalCard}
          activeOpacity={1}
          onPress={() => {}}
        >
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Lotto 6/18 당첨금 안내</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.lottoAwardSummary}>
            현재 누적 당첨금 {formatWon(carryoverAmount)}
          </Text>
          <View style={s.lottoGuideModalList}>
            {rows.map((row) => (
              <View key={row.label} style={s.lottoGuideRow}>
                <Text style={s.lottoGuideLabel}>{row.label}</Text>
                <Text style={s.lottoGuideValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function LottoAwardConfigModal({
  config,
  carryoverAmount,
  onClose,
  onSave,
}: {
  config: LottoAwardConfig;
  carryoverAmount: number;
  onClose: () => void;
  onSave: (config: LottoAwardConfig) => Promise<void>;
}) {
  const [prize3, setPrize3] = useState(String(config.prizes["3"] ?? 0));
  const [prize4, setPrize4] = useState(String(config.prizes["4"] ?? 0));
  const [prize5, setPrize5] = useState(String(config.prizes["5"] ?? 0));
  const [prize6, setPrize6] = useState(String(config.prizes["6"] ?? 0));
  const [rollover, setRollover] = useState(config.rollover);
  const [rolloverIncrement, setRolloverIncrement] = useState(
    String(config.rolloverIncrement ?? 0),
  );
  const [saving, setSaving] = useState(false);
  const parseMoney = (value: string) =>
    Number(value.replace(/[^0-9]/g, "")) || 0;
  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        prizes: {
          "3": parseMoney(prize3),
          "4": parseMoney(prize4),
          "5": parseMoney(prize5),
          "6": parseMoney(prize6),
        },
        rollover,
        rolloverIncrement: parseMoney(rolloverIncrement),
        carryoverAmount,
      });
    } catch (error) {
      Alert.alert(
        "저장 실패",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={s.modalCard}
          activeOpacity={1}
          onPress={() => {}}
        >
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Lotto 시상 기준</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.lottoAwardSummary}>
            현재 누적 당첨금 {formatWon(carryoverAmount)}
          </Text>
          {(
            [
              ["3", prize3, setPrize3],
              ["4", prize4, setPrize4],
              ["5", prize5, setPrize5],
              ["6", prize6, setPrize6],
            ] as const
          ).map(([count, value, setter]) => (
            <View key={count} style={s.lottoAwardInputRow}>
              <Text style={s.lottoAwardInputLabel}>{count}개 적중</Text>
              <TextInput
                value={value}
                onChangeText={setter}
                keyboardType="numeric"
                placeholder="0"
                style={s.lottoAwardInput}
              />
              <Text style={s.lottoAwardUnit}>원</Text>
            </View>
          ))}
          <TouchableOpacity
            style={s.lottoRolloverRow}
            onPress={() => setRollover((value) => !value)}
            activeOpacity={0.82}
          >
            <Text style={s.lottoRolloverText}>미당첨 시 이월</Text>
            <View style={[s.lottoSwitch, rollover && s.lottoSwitchOn]}>
              <Text
                style={[s.lottoSwitchText, rollover && s.lottoSwitchTextOn]}
              >
                {rollover ? "ON" : "OFF"}
              </Text>
            </View>
          </TouchableOpacity>
          {rollover && (
            <View style={s.lottoAwardInputRow}>
              <Text style={s.lottoAwardInputLabel}>이월 증가</Text>
              <TextInput
                value={rolloverIncrement}
                onChangeText={setRolloverIncrement}
                keyboardType="numeric"
                placeholder="0"
                style={s.lottoAwardInput}
              />
              <Text style={s.lottoAwardUnit}>원</Text>
            </View>
          )}
          <TouchableOpacity
            style={[s.infoActionBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={C.green} />
            ) : (
              <Text style={s.infoActionText}>저장</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

type SeasonKey = "spring" | "summer" | "autumn" | "winter";
type CourseSeasonImageRow = {
  golf_course_id: string;
  season: SeasonKey;
  image_url: string;
};

const SEASONS: Array<{ key: SeasonKey; label: string; desc: string }> = [
  { key: "spring", label: "봄", desc: "3~5월" },
  { key: "summer", label: "여름", desc: "6~8월" },
  { key: "autumn", label: "가을", desc: "9~11월" },
  { key: "winter", label: "겨울", desc: "12~2월" },
];

async function uploadCourseSeasonImage(
  courseId: string,
  season: SeasonKey,
  uri: string,
) {
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1400 } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
  );
  const response = await fetch(compressed.uri);
  const blob = await response.blob();
  const path = `${courseId}/${season}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("course-images")
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("course-images").getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: saveError } = await supabase
    .from("golf_course_season_images")
    .upsert(
      {
        golf_course_id: courseId,
        season,
        image_url: publicUrl,
        image_source: "supabase_storage",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "golf_course_id,season" },
    );

  if (saveError) throw saveError;
  notifyHomeDashboardChanged();
  return publicUrl;
}

function CourseSeasonImageModal({
  compact,
  windowHeight,
  onClose,
}: {
  compact: boolean;
  windowHeight: number;
  onClose: () => void;
}) {
  const [courseReloadKey, setCourseReloadKey] = useState(0);
  const { data: courses, loading: coursesLoading } = useAsync(
    () => getGolfCourses(),
    [courseReloadKey],
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [courseSeasonAvailability, setCourseSeasonAvailability] = useState<
    Record<string, Partial<Record<SeasonKey, boolean>>>
  >({});
  const [images, setImages] = useState<Record<SeasonKey, string | null>>({
    spring: null,
    summer: null,
    autumn: null,
    winter: null,
  });
  const [loadingImages, setLoadingImages] = useState(false);
  const [savingSeason, setSavingSeason] = useState<SeasonKey | null>(null);
  const courseList = courses ?? [];
  const selectedCourse =
    courseList.find((course) => course.id === selectedCourseId) ??
    courseList[0] ??
    null;
  const normalizedCourseSearch = courseSearch.trim().toLocaleLowerCase("ko-KR");
  const filteredCourseList = normalizedCourseSearch
    ? courseList.filter((course) =>
        `${course.name} ${course.region ?? ""}`
          .toLocaleLowerCase("ko-KR")
          .includes(normalizedCourseSearch),
      )
    : courseList;

  useEffect(() => {
    if (
      courseList[0] &&
      (!selectedCourseId ||
        !courseList.some((course) => course.id === selectedCourseId))
    ) {
      setSelectedCourseId(courseList[0].id);
    }
  }, [courseList, selectedCourseId]);

  useEffect(() => {
    const courseIds = courseList.map((course) => course.id).filter(Boolean);
    if (courseIds.length === 0) {
      setCourseSeasonAvailability({});
      return;
    }

    let mounted = true;
    supabase
      .from("golf_course_season_images")
      .select("golf_course_id, season")
      .in("golf_course_id", courseIds)
      .eq("is_active", true)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) throw error;
        const next: Record<
          string,
          Partial<Record<SeasonKey, boolean>>
        > = {};
        ((data ?? []) as Array<{
          golf_course_id: string;
          season: SeasonKey;
        }>).forEach((row) => {
          next[row.golf_course_id] = {
            ...(next[row.golf_course_id] ?? {}),
            [row.season]: true,
          };
        });
        setCourseSeasonAvailability(next);
      })
      .catch((error) => {
        if (mounted) {
          console.warn("골프장 계절 사진 상태 조회 실패", error);
        }
      });

    return () => {
      mounted = false;
    };
  }, [courseList]);

  useEffect(() => {
    if (!selectedCourse?.id) return;
    let mounted = true;
    setLoadingImages(true);
    supabase
      .from("golf_course_season_images")
      .select("golf_course_id, season, image_url")
      .eq("golf_course_id", selectedCourse.id)
      .eq("is_active", true)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) throw error;
        const next: Record<SeasonKey, string | null> = {
          spring: null,
          summer: null,
          autumn: null,
          winter: null,
        };
        ((data ?? []) as CourseSeasonImageRow[]).forEach((row) => {
          next[row.season] = row.image_url;
        });
        setImages(next);
      })
      .catch((error) => {
        if (mounted)
          Alert.alert(
            "오류",
            error instanceof Error ? error.message : String(error),
          );
      })
      .finally(() => {
        if (mounted) setLoadingImages(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedCourse?.id]);

  async function pickSeasonImage(season: SeasonKey) {
    if (!selectedCourse?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("권한 필요", "사진 접근 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    setSavingSeason(season);
    try {
      const publicUrl = await uploadCourseSeasonImage(
        selectedCourse.id,
        season,
        result.assets[0].uri,
      );
      setImages((prev) => ({ ...prev, [season]: publicUrl }));
      setCourseSeasonAvailability((prev) => ({
        ...prev,
        [selectedCourse.id]: {
          ...(prev[selectedCourse.id] ?? {}),
          [season]: true,
        },
      }));
    } catch (error) {
      Alert.alert(
        "저장 실패",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSavingSeason(null);
    }
  }

  return (
    <>
      <Modal transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity
            style={[
              s.modalCard,
              {
                width: compact ? "94%" : "90%",
                maxHeight: Math.round(windowHeight * 0.86),
                padding: compact ? 16 : 20,
              },
            ]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>골프장 사진 관리</Text>
              <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                <Text style={s.closeBtnText}>닫기</Text>
              </TouchableOpacity>
            </View>

            {coursesLoading ? (
              <ActivityIndicator color={C.green} />
            ) : (
              <ScrollView contentContainerStyle={s.courseImageBody}>
                <Text style={s.courseImageHelp}>
                  라운드 날짜의 계절에 맞는 사진이 홈 히어로에 표시됩니다.
                </Text>
                <View>
                  <Text style={s.courseSelectorLabel}>골프장</Text>
                  <TouchableOpacity
                    style={s.courseSelector}
                    onPress={() => setCoursePickerOpen(true)}
                    activeOpacity={0.84}
                    disabled={courseList.length === 0}
                  >
                    <View style={s.courseSelectorTextWrap}>
                      <Text
                        style={[
                          s.courseSelectorText,
                          !selectedCourse && s.courseSelectorPlaceholder,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedCourse?.name ?? "골프장 선택"}
                      </Text>
                      {selectedCourse?.region ? (
                        <Text style={s.courseSelectorMeta} numberOfLines={1}>
                          {selectedCourse.region}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name="chevronRight" size={18} color={C.muted} />
                  </TouchableOpacity>
                </View>

                {selectedCourse ? (
                  <>
                    <View style={s.selectedCourseBox}>
                      <Text style={s.selectedCourseName}>
                        {selectedCourse.name}
                      </Text>
                      <Text style={s.selectedCourseRegion}>
                        {selectedCourse.region}
                      </Text>
                    </View>
                    {loadingImages ? (
                      <ActivityIndicator color={C.green} />
                    ) : (
                      <View style={s.seasonImageGrid}>
                        {SEASONS.map((season) => {
                          const imageUrl = images[season.key];
                          const saving = savingSeason === season.key;
                          return (
                            <TouchableOpacity
                              key={season.key}
                              style={s.seasonImageCard}
                              activeOpacity={0.86}
                              onPress={() => pickSeasonImage(season.key)}
                              disabled={!!savingSeason}
                            >
                              {imageUrl ? (
                                <Image
                                  source={{ uri: imageUrl }}
                                  style={s.seasonImagePreview}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={s.seasonImageEmpty}>
                                  <Icon
                                    name="camera"
                                    size={24}
                                    color={C.green}
                                  />
                                </View>
                              )}
                              <View style={s.seasonImageFooter}>
                                <View>
                                  <Text style={s.seasonImageTitle}>
                                    {season.label}
                                  </Text>
                                  <Text style={s.seasonImageDesc}>
                                    {season.desc}
                                  </Text>
                                </View>
                                {saving ? (
                                  <ActivityIndicator color={C.green} />
                                ) : (
                                  <Text style={s.seasonImageAction}>
                                    {imageUrl ? "변경" : "등록"}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={s.muted}>등록된 골프장이 없습니다.</Text>
                )}
                <TouchableOpacity
                  style={s.infoActionBtn}
                  onPress={() => setCourseReloadKey((key) => key + 1)}
                  activeOpacity={0.82}
                >
                  <Text style={s.infoActionText}>골프장 목록 새로고침</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={coursePickerOpen}
        onRequestClose={() => {
          setCoursePickerOpen(false);
          setCourseSearch("");
        }}
      >
        <TouchableOpacity
          style={s.coursePickerOverlay}
          activeOpacity={1}
          onPress={() => {
            setCoursePickerOpen(false);
            setCourseSearch("");
          }}
        >
          <TouchableOpacity
            style={s.coursePickerCard}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={s.coursePickerHeader}>
              <Text style={s.coursePickerTitle}>골프장 선택</Text>
              <TouchableOpacity
                style={s.coursePickerCloseBtn}
                onPress={() => {
                  setCoursePickerOpen(false);
                  setCourseSearch("");
                }}
                activeOpacity={0.82}
              >
                <Text style={s.coursePickerCloseText}>닫기</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={s.coursePickerSearchInput}
              value={courseSearch}
              onChangeText={setCourseSearch}
              placeholder="골프장명 또는 지역 검색"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
            />

            <ScrollView
              style={s.coursePickerList}
              keyboardShouldPersistTaps="handled"
            >
              {filteredCourseList.length === 0 ? (
                <Text style={s.coursePickerEmptyText}>
                  검색 결과가 없습니다.
                </Text>
              ) : (
                filteredCourseList.map((course) => {
                  const active = course.id === selectedCourse?.id;
                  return (
                    <TouchableOpacity
                      key={course.id}
                      style={[
                        s.coursePickerRow,
                        active && s.coursePickerRowActive,
                      ]}
                      onPress={() => {
                        setSelectedCourseId(course.id);
                        setCoursePickerOpen(false);
                        setCourseSearch("");
                      }}
                      activeOpacity={0.84}
                    >
                      <View style={s.coursePickerRowTextWrap}>
                        <View style={s.coursePickerRowTopLine}>
                          <Text
                            style={[
                              s.coursePickerRowText,
                              active && s.coursePickerRowTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {course.name}
                          </Text>
                          <View style={s.coursePickerSeasonRow}>
                            {SEASONS.map((season) => {
                              const registered =
                                !!courseSeasonAvailability[course.id]?.[
                                  season.key
                                ];
                              return (
                                <Text
                                  key={season.key}
                                  style={[
                                    s.coursePickerSeasonText,
                                    registered &&
                                      s.coursePickerSeasonTextRegistered,
                                  ]}
                                >
                                  {season.label}
                                </Text>
                              );
                            })}
                          </View>
                        </View>
                        <Text style={s.coursePickerRowMeta}>
                          {course.region}
                        </Text>
                      </View>
                      {active ? (
                        <Icon name="check" size={18} color={C.green} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.greenDark,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  profileInitial: { color: "#fff", fontSize: 16, fontWeight: "900" },

  clubSelector: { backgroundColor: C.greenDark, paddingBottom: 14 },
  clubPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  clubPillActive: { backgroundColor: "#fff" },
  clubPillText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "600",
  },
  clubPillTextActive: { color: C.greenDark },

  content: { paddingVertical: 16, paddingTop: 12 },
  pageSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.text,
    marginBottom: 12,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  clubHeroViewport: {
    overflow: "hidden",
    marginBottom: 7,
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 56,
    backgroundColor: "#10291d",
    shadowColor: "#10291d",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  clubHeroCard: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 56,
    overflow: "hidden",
    backgroundColor: "#10291d",
  },
  clubHeroPagination: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  clubHeroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.48)",
  },
  clubHeroDotActive: {
    width: 16,
    backgroundColor: "#fff",
  },
  createClubHeroCard: {
    backgroundColor: C.greenDark,
  },
  createClubHeroContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  createClubHeroIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    marginBottom: 12,
  },
  createClubHeroPlus: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "300",
    lineHeight: 38,
  },
  createClubHeroTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  createClubHeroDescription: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  createClubHeroButton: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  createClubHeroButtonText: {
    color: C.greenDark,
    fontSize: 13,
    fontWeight: "900",
  },
  clubHeroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  clubHeroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  clubHeroBody: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  clubHeroLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(255,255,255,0.72)",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  clubHeroName: {
    fontSize: 26,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.4,
  },
  clubHeroMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
    marginTop: 7,
    lineHeight: 19,
  },
  clubInfoBtn: {
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  clubInfoBtnText: { fontSize: 13, fontWeight: "900", color: "#fff" },
  managementModalBody: { gap: 10, paddingBottom: 4 },
  managementModalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  managementModalRowCompact: {
    gap: 10,
    padding: 12,
    borderRadius: 14,
  },
  managementCardFeatured: {
    borderColor: "#94bb36",
    backgroundColor: "#f8ffd9",
  },
  managementIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  managementIconCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  managementIconFeatured: {
    backgroundColor: C.accent,
  },
  managementTitle: { fontSize: 18, fontWeight: "900", color: C.text },
  managementSubtitle: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 19,
    marginTop: 10,
  },
  managementTitleCompact: { fontSize: 16 },
  managementSubtitleCompact: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginBottom: 14,
  },
  goProfileBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: C.green,
    borderRadius: 20,
  },
  goProfileBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  emptySecondaryBtn: {
    marginTop: 9,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: C.greenLight,
  },
  emptySecondaryText: { color: C.green, fontWeight: "800", fontSize: 12 },

  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 7,
    shadowColor: "#1a6b44",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryCard: {
    height: 96,
  },
  noticeSummaryCard: {
    height: 118,
    paddingBottom: 20,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  noticeCardTitleRow: {
    marginBottom: 7,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    marginBottom: 14,
  },
  more: { fontSize: 13, color: C.green, fontWeight: "600" },
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  noticeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
    textAlign: "left",
  },
  noticeMeta: { fontSize: 11, color: C.muted, textAlign: "right" },
  noticeEmpty: { paddingTop: 12, fontSize: 13, color: C.muted },
  noticeDetailDate: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: "700",
    color: C.muted,
  },
  noticeDetailBody: { fontSize: 14, lineHeight: 22, color: C.text },
  lottoSummaryCard: {
    justifyContent: "center",
    paddingVertical: 0,
  },
  lottoSummaryTouchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lottoSummaryTextArea: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 14,
  },
  lottoSummaryTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: C.text,
  },
  lottoGuideSummary: {
    marginTop: 7,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
    color: C.green,
    letterSpacing: -0.35,
    fontFamily: Platform.select({
      ios: "AvenirNext-DemiBold",
      android: "sans-serif-medium",
      web: "Pretendard, Arial, sans-serif",
      default: undefined,
    }),
  },
  lottoSummaryActionArea: {
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "flex-end",
    minWidth: 76,
  },
  lottoSummaryAction: {
    fontSize: 15,
    lineHeight: 21,
    color: C.green,
    fontWeight: "900",
    letterSpacing: -0.25,
    fontFamily: Platform.select({
      ios: "AvenirNext-DemiBold",
      android: "sans-serif-medium",
      web: "Pretendard, Arial, sans-serif",
      default: undefined,
    }),
  },
  lottoGuideModalList: { marginTop: 12 },
  lottoGuideRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  lottoGuideLabel: { fontSize: 13, fontWeight: "700", color: C.muted },
  lottoGuideValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
    color: C.text,
    textAlign: "right",
  },
  recordToggleBtn: {
    borderRadius: 999,
    backgroundColor: C.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recordToggleText: { fontSize: 12, fontWeight: "800", color: C.green },
  criteriaCollapsedText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.muted,
    lineHeight: 20,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  ruleLabel: { fontSize: 13, fontWeight: "700", color: C.muted },
  ruleValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
    textAlign: "right",
  },

  // 핸디캡 랭킹
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  rankNum: { width: 32, fontSize: 13, textAlign: "center", color: C.muted },
  rankName: { flex: 1, fontSize: 14, fontWeight: "500", color: C.text },
  rankValue: { fontSize: 16, fontWeight: "800" },

  // 명예의 전당
  hallRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 10,
  },
  hallIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  hallLabel: { flex: 1, fontSize: 13, color: C.muted },
  hallValue: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
    textAlign: "right",
    flexShrink: 1,
  },

  // 최근 라운드
  roundRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  roundLeft: { flex: 1 },
  roundCourse: { fontSize: 14, fontWeight: "700", color: C.text },
  roundMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  roundStat: { fontSize: 12, color: C.muted },

  memberBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  memberBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  clubDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 120,
  },
  clubDropdownText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingRight: 16,
  },
  dropdownCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    minWidth: 200,
    maxWidth: 260,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  dropdownTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownRowDivider: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  dropdownClubName: { fontSize: 14, fontWeight: "700", color: C.text },
  dropdownClubSub: { fontSize: 11, color: C.muted, marginTop: 1 },

  muted: { fontSize: 13, color: C.muted },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    width: "90%",
    minWidth: 320,
    maxWidth: 440,
    maxHeight: "78%",
    alignSelf: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  clubInfoModalScroll: {
    flexShrink: 1,
  },
  clubInfoModalScrollContent: {
    paddingBottom: 8,
  },
  clubInfoHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 10,
  },
  clubInfoHeaderSaveBtn: {
    minWidth: 64,
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.green,
  },
  clubInfoHeaderSaveText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#fff",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    flex: 1,
    marginRight: 8,
  },
  createClubLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: C.muted,
    marginBottom: 6,
  },
  createClubSubmitBtn: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  createClubSubmitText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  clubInfoTitle: { fontSize: 22, fontWeight: "900", color: C.text },
  clubInfoSubtitle: {
    fontSize: 13,
    color: C.muted,
    marginTop: 5,
    lineHeight: 18,
  },
  clubInfoInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: C.text,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  clubCoverPicker: {
    height: 112,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 10,
    backgroundColor: "#eef3ef",
  },
  clubCoverPreview: { width: "100%", height: "100%" },
  clubCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  clubCoverText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  clubCoverResetBtn: {
    alignSelf: "flex-start",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f2f4f6",
    marginBottom: 8,
  },
  clubCoverResetText: { fontSize: 12, fontWeight: "800", color: C.muted },
  clubSwitchScroll: { marginBottom: 12 },
  clubSwitchRow: { gap: 8, paddingRight: 4 },
  clubSwitchChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#f2f4f6",
    borderWidth: 1,
    borderColor: C.border,
  },
  clubSwitchChipActive: { backgroundColor: C.greenLight, borderColor: C.green },
  clubSwitchText: { fontSize: 12, fontWeight: "800", color: C.muted },
  clubSwitchTextActive: { color: C.green },
  clubEditRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  clubEditBtn: {
    borderRadius: 14,
    backgroundColor: C.greenLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 70,
  },
  clubEditText: { fontSize: 12, fontWeight: "800", color: C.green },
  clubInfoStatsText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.muted,
    marginBottom: 14,
  },
  infoSection: { paddingTop: 12, marginTop: 4 },
  infoSectionTitle: { fontSize: 15, fontWeight: "900", color: C.text },
  infoDivider: {
    height: 1,
    backgroundColor: C.border,
    marginTop: 10,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: C.muted,
    marginBottom: 6,
  },
  adminRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  adminName: { fontSize: 14, fontWeight: "800", color: C.text },
  adminRole: { fontSize: 12, fontWeight: "800", color: C.green },
  infoMuted: { fontSize: 12, color: C.muted, lineHeight: 18 },
  infoActionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  infoActionBtn: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: C.greenLight,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 10,
  },
  infoActionText: { fontSize: 13, fontWeight: "800", color: C.green },
  settingLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
    gap: 12,
  },
  settingLineLabel: { fontSize: 13, fontWeight: "800", color: C.text },
  handicapSelectBtn: {
    borderRadius: 999,
    backgroundColor: C.greenLight,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  handicapSelectText: { fontSize: 12, fontWeight: "900", color: C.green },
  handicapMenu: {
    position: "absolute",
    top: 38,
    right: 0,
    width: 92,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 30,
  },
  handicapMenuItem: { paddingVertical: 8, paddingHorizontal: 10 },
  handicapMenuText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.muted,
    textAlign: "center",
  },
  handicapMenuTextActive: { color: C.green },
  ruleDesc: { fontSize: 13, color: C.text, lineHeight: 20, marginBottom: 8 },
  dangerSection: {
    marginTop: 18,
    paddingTop: 14,
    paddingBottom: 4,
  },
  dangerSectionTitle: { fontSize: 15, fontWeight: "900", color: "#b82e2e" },
  dangerDivider: { backgroundColor: "#f0caca" },
  dangerTitle: { fontSize: 14, fontWeight: "900", color: C.text },
  dangerDesc: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
  },
  dangerWarning: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: "#fff1f1",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "800",
    color: "#b82e2e",
  },
  dangerError: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: "#fff1f1",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
    color: "#b82e2e",
  },
  leaveClubBtn: {
    minHeight: 44,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d94a4a",
    backgroundColor: "#fff7f7",
    alignItems: "center",
    justifyContent: "center",
  },
  leaveClubBtnDisabled: {
    borderColor: "#e3d4d4",
    backgroundColor: "#f6f3f3",
    opacity: 0.7,
  },
  leaveClubBtnText: { fontSize: 13, fontWeight: "900", color: "#c93636" },
  leaveClubBtnTextDisabled: { color: "#9f8d8d" },
  lottoAwardSummary: {
    fontSize: 14,
    fontWeight: "900",
    color: C.green,
    marginBottom: 12,
  },
  lottoAwardInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  lottoAwardInputLabel: {
    width: 72,
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
  },
  lottoAwardInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    color: C.text,
    paddingVertical: 10,
    textAlign: "right",
  },
  lottoAwardUnit: { fontSize: 12, fontWeight: "800", color: C.muted },
  lottoRolloverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: "#f2f4f6",
    marginTop: 4,
  },
  lottoRolloverText: { fontSize: 13, fontWeight: "900", color: C.text },
  lottoSwitch: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#d7dcd8",
  },
  lottoSwitchOn: { backgroundColor: C.green },
  lottoSwitchText: { fontSize: 11, fontWeight: "900", color: C.muted },
  lottoSwitchTextOn: { color: "#fff" },
  courseImageBody: { gap: 12, paddingBottom: 8 },
  courseImageHelp: { fontSize: 13, color: C.muted, lineHeight: 19 },
  courseSelectorLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: C.muted,
    marginBottom: 6,
  },
  courseSelector: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  courseSelectorTextWrap: { flex: 1 },
  courseSelectorText: { fontSize: 14, fontWeight: "900", color: C.text },
  courseSelectorPlaceholder: { color: C.muted },
  courseSelectorMeta: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: C.muted,
  },
  coursePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  coursePickerCard: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "78%",
    borderRadius: 20,
    backgroundColor: C.card,
    padding: 18,
  },
  coursePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  coursePickerTitle: { fontSize: 17, fontWeight: "900", color: C.text },
  coursePickerCloseBtn: {
    borderRadius: 999,
    backgroundColor: C.green,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  coursePickerCloseText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  coursePickerSearchInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: C.text,
    marginBottom: 10,
  },
  coursePickerList: { flexGrow: 0 },
  coursePickerRow: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  coursePickerRowActive: {
    backgroundColor: C.greenLight,
    borderRadius: 12,
    borderBottomColor: "transparent",
  },
  coursePickerRowTextWrap: { flex: 1 },
  coursePickerRowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  coursePickerRowText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "900",
    color: C.text,
  },
  coursePickerSeasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 0,
  },
  coursePickerSeasonText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.muted,
  },
  coursePickerSeasonTextRegistered: {
    color: C.green,
  },
  coursePickerRowTextActive: { color: C.green },
  coursePickerRowMeta: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: C.muted,
  },
  coursePickerEmptyText: {
    paddingVertical: 24,
    textAlign: "center",
    fontSize: 13,
    color: C.muted,
  },
  selectedCourseBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#fff",
    padding: 12,
  },
  selectedCourseName: { fontSize: 15, fontWeight: "900", color: C.text },
  selectedCourseRegion: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: C.muted,
  },
  seasonImageGrid: { gap: 10 },
  seasonImageCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  seasonImagePreview: {
    width: "100%",
    height: 128,
    backgroundColor: C.greenLight,
  },
  seasonImageEmpty: {
    height: 128,
    backgroundColor: C.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  seasonImageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
  },
  seasonImageTitle: { fontSize: 14, fontWeight: "900", color: C.text },
  seasonImageDesc: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "800",
    color: C.muted,
  },
  seasonImageAction: { fontSize: 12, fontWeight: "900", color: C.green },
  closeBtn: {
    backgroundColor: C.green,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  closeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: C.border,
    paddingBottom: 7,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  th: { fontSize: 11, color: C.muted, fontWeight: "700" },
  td: { fontSize: 13, color: C.text },
});
