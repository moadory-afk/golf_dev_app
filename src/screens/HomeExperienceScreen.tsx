import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { GPButton, GPCard } from "../design";
import { useSkin } from "../skins";
import { useClub } from "../lib/ClubContext";
import { useUserProfile } from "../lib/UserProfileContext";
import type { RootStackParamList } from "../navigation/types";
import {
  PremiumGogoCaddieCard,
  PremiumHomeHeroSection,
  PremiumHomeMotion,
  PremiumRecentStatsSection,
  PremiumRecordExtrasSection,
  type PremiumRecentStatItem,
} from "../features/home/components";
import { useHomeDashboard } from "../features/home/hooks/useHomeDashboard";
import type {
  HomeHeroRound,
  HomeUpcomingRound,
} from "../features/home/types/home";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  COURSE_HERO_STORAGE_KEY,
  getCourseHeroAssetByKey,
  getCourseHeroImageSource,
} from "../data/courseHeroImages";
import {
  HomeLayoutRenderer,
  premiumGolfHomeLayout,
} from "../features/home/layout";
import { getRoundAttendanceMap, getRoundSchedules, updateRoundAttendance, type RoundAttendanceLabel, type ScheduledRound } from "../lib/roundSchedule";
import {
  DEFAULT_LOTTO_AWARD_CONFIG,
  computeHandicaps,
  getClubAwardConfig,
  getClubAwardSnapshots,
  getClubLottoAwardConfig,
  getClubMembers,
  getCourseLayouts,
  getHandicapsForRound,
  getRoundLottoDraw,
  getRoundLottoDrawsByScheduleIds,
  getRoundLottoEntries,
  getRoundLottoEntriesByScheduleIds,
  getRoundLottoEntry,
  getRoundSummaries,
  saveRoundLottoEntry,
  saveRoundLottoDrawResult,
  playerTotal,
  totalPar,
  type ClubAwardConfig,
  type ClubAwardSnapshot,
  type CourseLayout,
  type LottoAwardConfig,
  type RoundLottoDraw,
  type RoundLottoDrawScore,
  type RoundLottoEntry,
  type SavedRound,
} from "../lib/store";
import { AWARD_CATEGORIES, fillToCount } from "../lib/awardConfig";
import { computeClubAwardResults } from "../lib/awardResults";
import { subscribeHomeRecordsChanged } from "../lib/homeRecordEvents";
import type { HomeFeedAction, HomeFeedEvent } from "../features/home/engine";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type LottoSelection = { par3: number[]; par4: number[]; par5: number[] };
type PersonalCourseSegment = { label: string; layoutId?: string; start: number; end: number };
type AwardDetailRow = ClubAwardSnapshot & { roundDate: string; courseName: string };
const LOTTO_JACKPOT_BASE = 50000;
const LOTTO_JACKPOT_STEP = 10000;
const HOME_RECORD_CACHE_VERSION = 1;

function caddieBookParams(round: HomeUpcomingRound | null) {
  if (!round) return undefined;
  return {
    courseId: round.courseId,
    layoutId: round.layoutId,
    courseName: round.courseName,
    layoutName: round.layoutName,
    scheduleId: round.id,
  };
}

function caddieBookHeroParams(round: HomeHeroRound) {
  return {
    courseId: round.courseId,
    layoutId: round.layoutId,
    courseName: round.courseName,
    layoutName: round.layoutName,
    scheduleId: round.id,
  };
}

function groupLines(round?: ScheduledRound | null) {
  if (!round) return [];
  return round.groups
    .filter((group) => group.members.length > 0)
    .map((group) => ({
      id: group.id,
      title: `${group.name}${group.time ? ` · ${group.time}` : ""}`,
      members:
        group.members.map((member) => member.name).join(" · ") ||
        "편성 멤버 없음",
      course: [group.frontLayoutName, group.backLayoutName]
        .filter(Boolean)
        .join(" / "),
    }));
}

function emptyLottoSelection(): LottoSelection {
  return { par3: [], par4: [], par5: [] };
}

function groupForScheduledRound(round: ScheduledRound, userId?: string | null, name?: string | null) {
  return round.groups.find((item) =>
    item.members.some((member) => member.userId === userId || member.name === name)
  ) ?? round.groups.find((item) => item.members.length > 0) ?? round.groups[0];
}

function courseSegmentsForScheduledRound(
  round: ScheduledRound,
  layouts: CourseLayout[],
  userId?: string | null,
  name?: string | null,
): PersonalCourseSegment[] {
  const group = groupForScheduledRound(round, userId, name);
  const candidates = [
    { id: group?.frontLayoutId, name: group?.frontLayoutName ?? "전반" },
    { id: group?.backLayoutId, name: group?.backLayoutName ?? "후반" },
    { id: round.layoutId, name: round.layoutName ?? "추가" },
  ].filter((item, index) => item.id || (item.name && index < 2))
    .filter((item, index, list) => list.findIndex((target) => target.id === item.id && target.name === item.name) === index);

  if (candidates.length === 0) {
    return [
      { label: "전반", start: 0, end: 8 },
      { label: "후반", start: 9, end: 17 },
    ];
  }

  let cursor = 0;
  const segments: PersonalCourseSegment[] = [];
  for (const candidate of candidates) {
    if (cursor >= 18) break;
    const layout = layouts.find((item) => item.id === candidate.id);
    const length = Math.max(1, Math.min(layout?.holes ?? layout?.pars.length ?? 9, 18 - cursor));
    segments.push({
      label: layout?.name ?? candidate.name,
      layoutId: candidate.id,
      start: cursor,
      end: cursor + length - 1,
    });
    cursor += length;
  }
  return segments;
}

function parsForScheduledRound(
  round: ScheduledRound,
  layouts: CourseLayout[],
  userId?: string | null,
  name?: string | null,
) {
  const segments = courseSegmentsForScheduledRound(round, layouts, userId, name);
  const pars = segments.flatMap((segment) => {
    const layout = layouts.find((item) => item.id === segment.layoutId);
    const length = segment.end - segment.start + 1;
    return Array.from({ length }, (_, index) => layout?.pars[index] ?? 4);
  }).slice(0, 18);
  return pars.length === 18 ? pars : [...pars, ...Array.from({ length: 18 - pars.length }, () => 4)];
}

function isAssignedToRound(round: ScheduledRound | null, userId?: string | null, name?: string | null) {
  if (!round || !userId) return false;
  return round.groups.some((group) =>
    group.members.some((member) => member.userId === userId || member.name === name)
  );
}

function resolveFeedNavigation(
  nav: Nav,
  actionType: string,
  round: HomeUpcomingRound | null,
) {
  if (actionType === "open_caddie_map") {
    const params = caddieBookParams(round);
    if (params) return nav.navigate("CaddieBook", params);
    return nav.navigate("RoundSchedulePrototype", { openCreate: true });
  }
  if (actionType === "open_attendance" && round)
    return nav.navigate("RoundSchedulePrototype", { editScheduleId: round.id, modalOnly: true });
  if (actionType === "open_award" && round)
    return nav.navigate("RoundSchedulePrototype", { editScheduleId: round.id, modalOnly: true });
  if (actionType === "open_analysis")
    return nav.navigate("Main", { screen: "History" });
  if (actionType === "open_groups" || actionType === "open_lotto" || actionType === "open_round_info")
    return nav.navigate("RoundSchedulePrototype");
  if (actionType === "open_notice") return nav.navigate("NoticePrototype");
  if (actionType === "open_score_entry") return nav.navigate("ScoreCapture");
  if (actionType === "open_result")
    return nav.navigate("Main", { screen: "History" });
  return nav.navigate("RoundSchedulePrototype", { openCreate: true });
}

type HomeRecordDetailMode = "handicap" | "average" | "recent" | "best" | "matchup" | "records" | "awards";

function applyStatNavigation(
  stats: PremiumRecentStatItem[],
  onOpenDetail: (mode: HomeRecordDetailMode) => void,
): PremiumRecentStatItem[] {
  const modeByKey: Record<string, HomeRecordDetailMode> = {
    handicap: "handicap",
    average: "average",
    recent: "recent",
    best: "best",
  };

  return stats.map((item) => ({
    ...item,
    onPress: () => onOpenDetail(modeByKey[item.key] ?? "recent"),
  }));
}

const RECORD_STAT_PLACEHOLDERS: PremiumRecentStatItem[] = [
  { key: "handicap", icon: "", label: "핸디캡", value: "-", caption: "불러오는 중", tone: "primary" },
  { key: "average", icon: "", label: "평균", value: "-", caption: "불러오는 중", tone: "info" },
  { key: "recent", icon: "", label: "최근", value: "-", caption: "불러오는 중", tone: "success" },
  { key: "best", icon: "", label: "베스트", value: "-", caption: "불러오는 중", tone: "gold" },
];

const RECORD_EXTRA_PLACEHOLDERS = [
  { key: "matchup", title: "상대 전적", subtitle: "불러오는 중" },
  { key: "records", title: "보유 기록", subtitle: "불러오는 중" },
  { key: "awards", title: "수상현황", subtitle: "불러오는 중" },
  { key: "empty", title: "", subtitle: "" },
];

type HomeRecordCache = {
  version: number;
  rounds: SavedRound[];
  awardRows: AwardDetailRow[];
};

function homeRecordCacheKey(clubId: string, userId?: string | null) {
  return `home-record-cards:${clubId}:${userId || "guest"}`;
}

function diffText(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value > 0 ? `+${value}` : `${value}`;
}

function normalizePersonName(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, "");
}

function formatWon(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString("ko-KR")}원`;
}

function formatGolfScore(score: number | undefined, par: number | undefined) {
  if (typeof score !== "number" || typeof par !== "number") return "미입력";

  const diff = score - par;
  if (diff <= -3) return "알바트로스";
  if (diff === -2) return "이글";
  if (diff === -1) return "버디";
  if (diff === 0) return "파";
  if (diff === 1) return "보기";
  if (diff === 2) return "더블보기";
  if (diff === 3) return "트리플보기";
  return `+${diff}`;
}

function compactGolfScoreLabel(label: string) {
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
  if (typeof myScore !== "number" || typeof par !== "number" || !drawScore) return false;

  const myLabel = compactGolfScoreLabel(formatGolfScore(myScore, par));
  const drawLabel = compactGolfScoreLabel(
    drawScore.label ?? formatGolfScore(drawScore.score, drawScore.par ?? par),
  );

  return myLabel === drawLabel;
}

async function calculateLottoJackpotAmount(
  rounds: SavedRound[],
  members: Array<{ userId: string; name: string; role: string }>,
) {
  const memberNameById = new Map(members.map((member) => [member.userId, member.name]));
  const scheduleIds = rounds.map((round) => round.scheduleId).filter((id): id is string => !!id);
  const [draws, entries] = await Promise.all([
    getRoundLottoDrawsByScheduleIds(scheduleIds).catch(() => []),
    getRoundLottoEntriesByScheduleIds(scheduleIds).catch(() => []),
  ]);
  const drawByScheduleId = new Map(draws.map((draw) => [draw.scheduleId, draw]));
  const entriesByScheduleId = entries.reduce<Record<string, typeof entries>>((acc, entry) => {
    if (!acc[entry.scheduleId]) acc[entry.scheduleId] = [];
    acc[entry.scheduleId].push(entry);
    return acc;
  }, {});
  const completedLottoRounds = rounds
    .filter((round) => {
      const draw = round.scheduleId ? drawByScheduleId.get(round.scheduleId) : null;
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
      const player = item.round.players.find((roundPlayer) => roundPlayer.name === playerName);
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

    return hasFirstPrizeWinner ? LOTTO_JACKPOT_BASE : amount + LOTTO_JACKPOT_STEP;
  }, LOTTO_JACKPOT_BASE);
}

function weightedLottoScore(par: number) {
  const rand = Math.random();
  const weights =
    par <= 3
      ? [
          { limit: 0.15, diff: -1, label: "버디" },
          { limit: 0.72, diff: 0, label: "파" },
          { limit: 0.92, diff: 1, label: "보기" },
          { limit: 1, diff: 2, label: "더블+" },
        ]
      : [
          { limit: 0.1, diff: -1, label: "버디" },
          { limit: 0.6, diff: 0, label: "파" },
          { limit: 0.85, diff: 1, label: "보기" },
          { limit: 0.95, diff: 2, label: "더블" },
          { limit: 1, diff: par, label: "양파+" },
        ];
  const result = weights.find((item) => rand <= item.limit) ?? weights[weights.length - 1];
  return { score: Math.max(1, par + result.diff), label: result.label };
}

function generateLottoDrawScores(pars: number[]): Record<string, RoundLottoDrawScore> {
  return Object.fromEntries(
    pars.slice(0, 18).map((par, index) => {
      const hole = index + 1;
      const result = weightedLottoScore(par);
      return [String(hole), { hole, par, score: result.score, label: result.label }];
    }),
  );
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isRoundDateAvailable(date?: string | null) {
  if (!date) return false;
  return date <= todayIsoDate();
}

function formatShortDate(date?: string) {
  if (!date) return "-";
  return date.length >= 10 ? date.slice(5, 10) : date;
}

function findPlayer(round: SavedRound, userName?: string | null) {
  const target = (userName ?? "").trim();
  if (!target) return null;
  const normalized = target.replace(/\s+/g, "");
  return (
    round.players.find((player) => player.name === target) ??
    round.players.find((player) => player.name.replace(/\s+/g, "") === normalized) ??
    null
  );
}

function getPersonalRoundRows(rounds: SavedRound[], userName?: string | null) {
  return rounds
    .map((round) => {
      const player = findPlayer(round, userName);
      if (!player) return null;
      const total = playerTotal(player.strokes);
      const par = totalPar(round.pars);
      const diff = total - par;
      const birdies = player.strokes.reduce((count, score, index) => count + (score - (round.pars[index] ?? 0) <= -1 ? 1 : 0), 0);
      const pars = player.strokes.reduce((count, score, index) => count + (score - (round.pars[index] ?? 0) === 0 ? 1 : 0), 0);
      return {
        id: round.id,
        date: round.date,
        courseName: round.courseName,
        total,
        par,
        diff,
        birdies,
        pars,
      };
    })
    .filter((row): row is NonNullable<typeof row> => !!row)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function handicapDiffSumByOpponent(rounds: SavedRound[], userName?: string | null) {
  const name = userName ?? "";
  if (!name) return null;
  const handicaps = computeHandicaps(rounds, 5);
  const myHandicap = handicaps.get(name) ?? 0;
  const opponents = new Set<string>();

  rounds.forEach((round) => {
    const me = findPlayer(round, name);
    if (!me) return;
    round.players.forEach((player) => {
      if (player.name !== me.name) opponents.add(player.name);
    });
  });

  if (opponents.size === 0) return null;
  return [...opponents].reduce((sum, opponent) => sum + (myHandicap - (handicaps.get(opponent) ?? 0)), 0);
}

function regularWinnerForRound(round: SavedRound, handicaps: Map<string, number>) {
  const best = Math.min(...round.players.map((player) => playerTotal(player.strokes)));
  const medalWinner = round.players.find((player) => playerTotal(player.strokes) === best)?.name;
  const ranked = round.players
    .map((player) => ({
      name: player.name,
      net: playerTotal(player.strokes) - (handicaps.get(player.name) ?? 0),
    }))
    .sort((a, b) => a.net - b.net);
  if (ranked[0]?.name === medalWinner) return ranked[1]?.name ?? null;
  return ranked[0]?.name ?? null;
}

function guinnessRecordsForUser(rounds: SavedRound[], userName?: string | null) {
  const target = normalizePersonName(userName);
  if (!target || rounds.length === 0) return [];

  const avgOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const rows: Array<{ label: string; value: string; courseName?: string; date?: string }> = [];
  const sortedRounds = [...rounds].sort((a, b) => a.date.localeCompare(b.date));
  const handicaps = computeHandicaps(rounds, 5);

  const addTop = <T,>(
    label: string,
    ranking: T[],
    valueOf: (row: T) => number,
    nameOf: (row: T) => string,
    unit: string,
    extra?: (row: T) => { courseName?: string; date?: string },
  ) => {
    if (ranking.length === 0) return;
    const topValue = valueOf(ranking[0]);
    const myRow = ranking
      .filter((row) => valueOf(row) === topValue)
      .find((row) => normalizePersonName(nameOf(row)) === target);
    if (!myRow) return;
    rows.push({ label, value: `${topValue}${unit}`, ...(extra?.(myRow) ?? {}) });
  };

  const winCount = new Map<string, number>();
  for (const round of sortedRounds) {
    const winner = regularWinnerForRound(round, getHandicapsForRound(round, rounds));
    if (winner) winCount.set(winner, (winCount.get(winner) ?? 0) + 1);
  }
  addTop("최다 우승", [...winCount.entries()].map(([name, wins]) => ({ name, wins })).sort((a, b) => b.wins - a.wins), (row) => row.wins, (row) => row.name, "회");

  let maxStreak = 0;
  let maxStreakPlayer = "";
  let curStreak = 0;
  let curPlayer = "";
  for (const round of sortedRounds) {
    const winner = regularWinnerForRound(round, getHandicapsForRound(round, rounds));
    if (winner && winner === curPlayer) curStreak += 1;
    else {
      if (curStreak > maxStreak) {
        maxStreak = curStreak;
        maxStreakPlayer = curPlayer;
      }
      curPlayer = winner ?? "";
      curStreak = winner ? 1 : 0;
    }
  }
  if (curStreak > maxStreak) {
    maxStreak = curStreak;
    maxStreakPlayer = curPlayer;
  }
  if (maxStreak > 0 && normalizePersonName(maxStreakPlayer) === target) rows.push({ label: "최다 연속 우승", value: `${maxStreak}연승` });

  const birdieCount = new Map<string, number>();
  const singleBirdieMap = new Map<string, { name: string; count: number; date: string; courseName: string }>();
  const singleParMap = new Map<string, { name: string; count: number; date: string; courseName: string }>();
  const scoreRecords: { name: string; total: number; date: string; courseName: string }[] = [];
  const playerRounds = new Map<string, { date: string; total: number; diff: number }[]>();
  const frontBackRanking: { name: string; improvement: number; date: string; courseName: string }[] = [];

  for (const round of rounds) {
    const coursePar = totalPar(round.pars);
    for (const player of round.players) {
      const total = playerTotal(player.strokes);
      let birdies = 0;
      let pars = 0;
      player.strokes.forEach((score, index) => {
        const diff = score - (round.pars[index] ?? 0);
        if (diff <= -1) birdies += 1;
        if (diff === 0) pars += 1;
      });

      birdieCount.set(player.name, (birdieCount.get(player.name) ?? 0) + birdies);
      const prevBirdie = singleBirdieMap.get(player.name);
      if (!prevBirdie || birdies > prevBirdie.count) singleBirdieMap.set(player.name, { name: player.name, count: birdies, date: round.date, courseName: round.courseName });
      const prevPar = singleParMap.get(player.name);
      if (!prevPar || pars > prevPar.count) singleParMap.set(player.name, { name: player.name, count: pars, date: round.date, courseName: round.courseName });

      scoreRecords.push({ name: player.name, total, date: round.date, courseName: round.courseName });
      const list = playerRounds.get(player.name) ?? [];
      list.push({ date: round.date, total, diff: total - coursePar });
      playerRounds.set(player.name, list);

      const front = playerTotal(player.strokes.slice(0, 9));
      const back = playerTotal(player.strokes.slice(9, 18));
      frontBackRanking.push({ name: player.name, improvement: front - back, date: round.date, courseName: round.courseName });
    }
  }

  addTop("최저 핸디", [...handicaps.entries()].map(([name, handicap]) => ({ name, handicap })).sort((a, b) => a.handicap - b.handicap), (row) => row.handicap, (row) => row.name, "");
  addTop("버디왕(전체)", [...birdieCount.entries()].map(([name, count]) => ({ name, count })).filter((row) => row.count > 0).sort((a, b) => b.count - a.count), (row) => row.count, (row) => row.name, "개");
  addTop("버디왕(1경기)", [...singleBirdieMap.values()].filter((row) => row.count > 0).sort((a, b) => b.count - a.count), (row) => row.count, (row) => row.name, "개", (row) => ({ date: row.date, courseName: row.courseName }));
  addTop("파왕(1경기)", [...singleParMap.values()].filter((row) => row.count > 0).sort((a, b) => b.count - a.count), (row) => row.count, (row) => row.name, "개", (row) => ({ date: row.date, courseName: row.courseName }));
  addTop("최다 라운드 참가", [...playerRounds.entries()].map(([name, list]) => ({ name, count: list.length })).sort((a, b) => b.count - a.count), (row) => row.count, (row) => row.name, "회");
  addTop("최저타", [...scoreRecords].sort((a, b) => a.total - b.total), (row) => row.total, (row) => row.name, "타", (row) => ({ date: row.date, courseName: row.courseName }));
  addTop("최고타", [...scoreRecords].sort((a, b) => b.total - a.total), (row) => row.total, (row) => row.name, "타", (row) => ({ date: row.date, courseName: row.courseName }));
  addTop("전후반 개선", frontBackRanking.filter((row) => row.improvement > 0).sort((a, b) => b.improvement - a.improvement), (row) => row.improvement, (row) => row.name, "타", (row) => ({ date: row.date, courseName: row.courseName }));

  const avgImproveRanking = [...playerRounds.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length < 10) return null;
      return { name, improvement: Math.round(avgOf(sorted.slice(-10, -3).map((round) => round.total))) - Math.round(avgOf(sorted.slice(-3).map((round) => round.total))) };
    })
    .filter((row): row is { name: string; improvement: number } => !!row && row.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement);
  addTop("평균타 개선", avgImproveRanking, (row) => row.improvement, (row) => row.name, "타");

  const handicapImproveRanking = [...playerRounds.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length < 10) return null;
      return { name, improvement: Math.ceil(avgOf(sorted.slice(0, 5).map((round) => round.diff))) - Math.ceil(avgOf(sorted.slice(-5).map((round) => round.diff))) };
    })
    .filter((row): row is { name: string; improvement: number } => !!row && row.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement);
  addTop("핸디 개선", handicapImproveRanking, (row) => row.improvement, (row) => row.name, "타");

  return rows;
}

function awardRowsForUser(awards: AwardDetailRow[], userName?: string | null) {
  const target = normalizePersonName(userName);
  if (!target) return [];
  return awards.filter((award) => normalizePersonName(award.winner) === target);
}

async function getHomeAwardRows(clubId: string, rounds: SavedRound[]): Promise<AwardDetailRow[]> {
  const [clubAwardConfig, schedules] = await Promise.all([
    getClubAwardConfig(clubId).catch(() => null),
    getRoundSchedules(clubId).catch(() => [] as ScheduledRound[]),
  ]);
  const scheduleAwardConfigById = new Map(schedules.map((schedule) => [schedule.id, schedule.awardConfig ?? null]));

  const rows = await Promise.all(
    rounds.map(async (round) => {
      const snapshots = await getClubAwardSnapshots(round.id).catch(() => []);
      const awards = snapshots.length > 0
        ? snapshots
        : (() => {
            const awardConfig = (round.scheduleId ? scheduleAwardConfigById.get(round.scheduleId) : null) ?? clubAwardConfig;
            if (!awardConfig) return [];
            return computeClubAwardResults(
              fillToCount(awardConfig.items, awardConfig.count),
              round,
              getHandicapsForRound(round, rounds),
              totalPar(round.pars),
            ).map((award, index) => ({
              id: `${round.id}-${award.awardKey}`,
              awardKey: award.awardKey,
              icon: award.icon,
              label: award.label,
              winner: award.winner,
              detail: award.detail,
              sortOrder: index,
            }));
          })();

      return awards.map((award) => ({
        ...award,
        roundDate: round.date,
        courseName: round.courseName,
      }));
    }),
  );

  return rows.flat();
}

function handicapBeforeHome(name: string, rounds: SavedRound[], beforeDate: string, basis = 5): number {
  const prior = rounds
    .filter((round) => round.date < beforeDate && !!findPlayer(round, name))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-basis);

  if (!prior.length) return 0;

  return Math.ceil(
    prior.reduce((sum, round) => {
      const player = findPlayer(round, name);
      if (!player) return sum;
      return sum + playerTotal(player.strokes) - totalPar(round.pars);
    }, 0) / prior.length,
  );
}

function HomeErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { palette } = useSkin();

  return (
    <GPCard style={styles.errorCard}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={[styles.errorTitle, { color: palette.text }]}>
        홈 데이터를 불러오지 못했습니다
      </Text>
      <Text style={[styles.errorMessage, { color: palette.muted }]}>
        {message}
      </Text>
      <GPButton
        label="다시 시도"
        variant="soft"
        onPress={onRetry}
        style={styles.errorButton}
      />
    </GPCard>
  );
}

export default function HomeExperienceScreen() {
  const { palette } = useSkin();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { activeClub: club, clubsLoaded } = useClub();
  const { name: myName, nickname, userId, homeLatitude, homeLongitude, departureBufferMinutes } = useUserProfile();
  const displayName = nickname || myName || "골퍼";
  const { dashboard, loading, error, refresh } = useHomeDashboard({
    clubId: club?.id,
    userName: myName,
    userId,
    homeLatitude,
    homeLongitude,
    departureBufferMinutes,
  });
  const [selectedHeroKey, setSelectedHeroKey] = useState<string | null>(null);
  const [activeRoundIndex, setActiveRoundIndex] = useState(0);
  const [roundPopupMode, setRoundPopupMode] = useState<
    "groups" | "lotto" | "award" | null
  >(null);
  const [popupRound, setPopupRound] = useState<ScheduledRound | null>(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupMembers, setPopupMembers] = useState<Array<{ userId: string; name: string; role: string }>>([]);
  const [popupLottoPars, setPopupLottoPars] = useState<number[]>([]);
  const [popupLottoSelection, setPopupLottoSelection] = useState<LottoSelection>(emptyLottoSelection);
  const [popupLottoEntries, setPopupLottoEntries] = useState<RoundLottoEntry[]>([]);
  const [popupLottoDraw, setPopupLottoDraw] = useState<RoundLottoDraw | null>(null);
  const [popupLottoConfig, setPopupLottoConfig] = useState<LottoAwardConfig>(DEFAULT_LOTTO_AWARD_CONFIG);
  const [popupLottoJackpot, setPopupLottoJackpot] = useState(LOTTO_JACKPOT_BASE);
  const [popupMyLottoStrokes, setPopupMyLottoStrokes] = useState<number[] | null>(null);
  const [popupLottoSaving, setPopupLottoSaving] = useState(false);
  const [popupDrawSaving, setPopupDrawSaving] = useState(false);
  const [popupAwardConfig, setPopupAwardConfig] = useState<ClubAwardConfig | null>(null);
  const [attendanceOverviewVisible, setAttendanceOverviewVisible] = useState(false);
  const [attendanceOverviewLoading, setAttendanceOverviewLoading] = useState(false);
  const [attendanceOverviewRows, setAttendanceOverviewRows] = useState<Array<{ userId: string; name: string; status: RoundAttendanceLabel }>>([]);
  const [attendanceOverviewRound, setAttendanceOverviewRound] = useState<HomeUpcomingRound | null>(null);
  const [recordDetailMode, setRecordDetailMode] = useState<HomeRecordDetailMode | null>(null);
  const [recordDetailRounds, setRecordDetailRounds] = useState<SavedRound[]>([]);
  const [recordAwardRows, setRecordAwardRows] = useState<AwardDetailRow[]>([]);
  const [recordCardsReady, setRecordCardsReady] = useState(false);
  const [recordDetailLoading, setRecordDetailLoading] = useState(false);
  const focusedClubIdRef = useRef<string | null | undefined>(undefined);
  const recordRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRecordCards = useCallback(async (options?: { force?: boolean }) => {
    if (!club?.id) {
      setRecordDetailRounds([]);
      setRecordAwardRows([]);
      setRecordCardsReady(true);
      return;
    }

    const cacheKey = homeRecordCacheKey(club.id, userId);
    if (!options?.force) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as HomeRecordCache;
          if (parsed.version === HOME_RECORD_CACHE_VERSION) {
            setRecordDetailRounds(parsed.rounds ?? []);
            setRecordAwardRows(parsed.awardRows ?? []);
            setRecordCardsReady(true);
            return;
          }
        }
      } catch {
        // cache miss
      }
    }

    setRecordCardsReady(false);
    try {
      const rounds = await getRoundSummaries(club.id);
      const awardRows = await getHomeAwardRows(club.id, rounds);
      setRecordDetailRounds(rounds);
      setRecordAwardRows(awardRows);
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ version: HOME_RECORD_CACHE_VERSION, rounds, awardRows }),
      );
    } catch {
      setRecordDetailRounds([]);
      setRecordAwardRows([]);
    } finally {
      setRecordCardsReady(true);
    }
  }, [club?.id, userId]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const currentClubId = club?.id ?? null;

      // 최초 진입과 클럽 변경 시 데이터 로딩은 각 hook/effect에 맡긴다.
      // 같은 클럽의 홈으로 다시 돌아온 경우에만 화면 데이터를 새로고침한다.
      if (focusedClubIdRef.current === currentClubId) {
        void loadRecordCards();
      } else {
        focusedClubIdRef.current = currentClubId;
      }

      AsyncStorage.getItem(COURSE_HERO_STORAGE_KEY)
        .then((value) => {
          if (mounted) setSelectedHeroKey(value);
        })
        .catch(() => {
          if (mounted) setSelectedHeroKey(null);
        });
      return () => {
        mounted = false;
      };
    }, [club?.id, loadRecordCards, refresh]),
  );

  const activeRound = dashboard.hero.rounds[activeRoundIndex] ?? null;
  const isCreateRoundCardActive =
    club?.role === "admin" &&
    dashboard.hero.rounds.length > 0 &&
    activeRoundIndex === dashboard.hero.rounds.length;
  const createRoundFeed = useMemo(() => ({
    id: "admin-create-round",
    type: "empty" as const,
    priority: 10,
    icon: "➕",
    label: "AI 캐디",
    title: "🏌️ AI 캐디",
    message: "새로운 라운드를 등록해 보세요.\n\n일정과 골프장 정보를 입력하면\n캐디가 준비를 시작합니다.",
    ctaLabel: "라운드 등록",
    actionType: "create_round" as const,
    tone: "green" as const,
  }), []);
  const activeRoundFeeds = activeRound
    ? (dashboard.feedEventsByRoundId[activeRound.id] ?? [])
    : isCreateRoundCardActive
      ? [createRoundFeed]
      : dashboard.feedEvents;
  const activeFeed = activeRoundFeeds[0] ?? dashboard.feed;
  const activeRoundLabel = activeRound
    ? `${activeRound.courseName} · ${activeRound.dday} · ${activeRound.teeTime}`
    : null;

  useEffect(() => {
    const maxRoundIndex = Math.max(
      0,
      dashboard.hero.rounds.length - 1 +
        (club?.role === "admin" && dashboard.hero.rounds.length > 0 ? 1 : 0),
    );
    setActiveRoundIndex((current) => Math.min(current, maxRoundIndex));
  }, [club?.role, dashboard.hero.rounds.length]);

  const activeHeroImageSource = selectedHeroKey
    ? getCourseHeroAssetByKey(selectedHeroKey).source
    : getCourseHeroImageSource(
        activeRound?.courseName ?? dashboard.hero.courseName,
      );

  const openRoundPopup = useCallback(
    async (round: HomeUpcomingRound, mode: "groups" | "lotto" | "award") => {
      setRoundPopupMode(mode);
      setPopupRound(null);
      setPopupMembers([]);
      setPopupLottoPars([]);
      setPopupLottoSelection(emptyLottoSelection());
      setPopupLottoEntries([]);
      setPopupLottoDraw(null);
      setPopupLottoConfig(DEFAULT_LOTTO_AWARD_CONFIG);
      setPopupLottoJackpot(LOTTO_JACKPOT_BASE);
      setPopupMyLottoStrokes(null);
      setPopupLottoSaving(false);
      setPopupAwardConfig(null);
      setPopupDrawSaving(false);
      if (!club?.id) return;
      setPopupLoading(true);
      try {
        const [schedules, members] = await Promise.all([
          getRoundSchedules(club.id),
          getClubMembers(club.id),
        ]);
        const selectedRound = schedules.find((item) => item.id === round.id) ?? null;
        setPopupRound(selectedRound);
        setPopupMembers(members);

        if (mode === "lotto") {
          const layouts = selectedRound?.courseId ? await getCourseLayouts(selectedRound.courseId) : [];
          setPopupLottoPars(selectedRound ? parsForScheduledRound(selectedRound, layouts, userId, myName) : Array.from({ length: 18 }, () => 4));
          const [saved, entries, draw, lottoConfig, savedRounds] = await Promise.all([
            userId ? getRoundLottoEntry(round.id, userId) : Promise.resolve(null),
            getRoundLottoEntries(round.id),
            getRoundLottoDraw(round.id),
            getClubLottoAwardConfig(club.id),
            getRoundSummaries(club.id),
          ]);
          const roundRecord = savedRounds.find((item) => item.scheduleId === round.id);
          const myPlayer = roundRecord ? findPlayer(roundRecord, myName) : null;
          const jackpot = await calculateLottoJackpotAmount(savedRounds, members);
          setPopupLottoSelection(saved?.selectedHoles ?? emptyLottoSelection());
          setPopupLottoEntries(entries);
          setPopupLottoDraw(draw);
          setPopupLottoConfig(lottoConfig);
          setPopupLottoJackpot(jackpot);
          setPopupMyLottoStrokes(myPlayer?.strokes ?? null);
        }

        if (mode === "award") {
          const clubAwardConfig = await getClubAwardConfig(club.id);
          setPopupAwardConfig(selectedRound?.awardConfig ?? clubAwardConfig);
        }
      } catch {
        setPopupRound(null);
        setPopupMembers([]);
        setPopupLottoPars([]);
        setPopupLottoSelection(emptyLottoSelection());
        setPopupLottoEntries([]);
        setPopupLottoDraw(null);
        setPopupLottoJackpot(LOTTO_JACKPOT_BASE);
        setPopupMyLottoStrokes(null);
        setPopupAwardConfig(null);
      } finally {
        setPopupLoading(false);
      }
    },
    [club?.id, myName, userId],
  );

  const handleCaddieFeedAction = useCallback(
    async (feed: HomeFeedEvent, action?: HomeFeedAction) => {
      const round = feed.scheduleId
        ? dashboard.hero.rounds.find((item) => item.id === feed.scheduleId) ?? activeRound
        : activeRound;
      const actionType = action?.actionType ?? feed.actionType;

      if (actionType === "set_attendance" && round && action?.attendanceStatus) {
        if (!club?.id || !userId) {
          Alert.alert("로그인 확인", "참석 여부를 저장하려면 다시 로그인해 주세요.");
          return;
        }
        try {
          await updateRoundAttendance(
            club.id,
            round.id,
            userId,
            action.attendanceStatus as RoundAttendanceLabel,
          );
          Alert.alert("참석 여부 저장", `${action.attendanceStatus}으로 저장했습니다.`);
          refresh();
        } catch (error) {
          Alert.alert("저장 실패", error instanceof Error ? error.message : String(error));
        }
        return;
      }
      if (actionType === "open_attendance" && round) {
        if (!club?.id) return;
        setAttendanceOverviewVisible(true);
        setAttendanceOverviewLoading(true);
        setAttendanceOverviewRound(round);
        try {
          const [members, attendanceMap] = await Promise.all([
            getClubMembers(club.id),
            getRoundAttendanceMap(club.id, round.id),
          ]);
          setAttendanceOverviewRows(
            members.map((member) => ({
              userId: member.userId,
              name: member.name,
              status: attendanceMap[member.userId] ?? "미정",
            })),
          );
        } catch (error) {
          setAttendanceOverviewRows([]);
          Alert.alert("조회 실패", error instanceof Error ? error.message : String(error));
        } finally {
          setAttendanceOverviewLoading(false);
        }
        return;
      }
      if (actionType === "open_groups" && round) {
        openRoundPopup(round, "groups");
        return;
      }
      if (actionType === "open_award" && round) {
        openRoundPopup(round, "award");
        return;
      }
      if (actionType === "open_lotto" && round) {
        openRoundPopup(round, "lotto");
        return;
      }
      resolveFeedNavigation(nav, actionType, round);
    },
    [activeRound, club?.id, dashboard.hero.rounds, nav, openRoundPopup, refresh, userId],
  );

  const togglePopupLottoHole = useCallback((parKey: keyof LottoSelection, hole: number) => {
    const limits: Record<keyof LottoSelection, number> = { par3: 1, par4: 3, par5: 2 };
    setPopupLottoSelection((current) => {
      const selected = current[parKey];
      if (selected.includes(hole)) {
        return { ...current, [parKey]: selected.filter((item) => item !== hole) };
      }
      if (selected.length >= limits[parKey]) return current;
      return { ...current, [parKey]: [...selected, hole].sort((a, b) => a - b) };
    });
  }, []);

  const popupLottoReady =
    popupLottoSelection.par3.length === 1 &&
    popupLottoSelection.par4.length === 3 &&
    popupLottoSelection.par5.length === 2;

  const savePopupLottoEntry = useCallback(async () => {
    if (!club?.id || !userId || !popupRound || !popupLottoReady) return;
    if (!isAssignedToRound(popupRound, userId, myName)) return;

    setPopupLottoSaving(true);
    try {
      await saveRoundLottoEntry({
        clubId: club.id,
        scheduleId: popupRound.id,
        userId,
        selectedHoles: popupLottoSelection,
      });
      setPopupLottoEntries((current) => [
        ...current.filter((entry) => entry.userId !== userId),
        { clubId: club.id, scheduleId: popupRound.id, userId, selectedHoles: popupLottoSelection },
      ]);
      Alert.alert("구매 완료", "Lotto 6/18 구매가 완료되었습니다.");
    } catch (error) {
      Alert.alert("오류", error instanceof Error ? error.message : String(error));
    } finally {
      setPopupLottoSaving(false);
    }
  }, [club?.id, myName, popupLottoReady, popupLottoSelection, popupRound, userId]);


  const runPopupLottoDraw = useCallback(async () => {
    if (!club?.id || !userId || !popupRound) return;
    if (popupLottoDraw?.drafterUserId !== userId || popupLottoDraw.drawStatus === "COMPLETED") return;
    if (!isRoundDateAvailable(popupRound.date)) {
      Alert.alert("추첨 대기", "로또 추첨은 라운드 당일부터 진행할 수 있습니다.");
      return;
    }

    setPopupDrawSaving(true);
    try {
      const savedRounds = await getRoundSummaries(club.id);
      const roundRecord = savedRounds.find((item) => item.scheduleId === popupRound.id);
      const pars = roundRecord?.pars?.length === 18 ? roundRecord.pars : Array.from({ length: 18 }, () => 4);
      const drawnScores = generateLottoDrawScores(pars);
      await saveRoundLottoDrawResult(club.id, popupRound.id, drawnScores);
      const nextDraw = await getRoundLottoDraw(popupRound.id);
      setPopupLottoDraw(nextDraw);
      Alert.alert("추첨 완료", "로또 추첨 결과를 저장했습니다.");
    } catch (error) {
      Alert.alert("오류", error instanceof Error ? error.message : String(error));
    } finally {
      setPopupDrawSaving(false);
    }
  }, [club?.id, popupLottoDraw, popupRound, userId]);

  const openRecordDetail = useCallback(
    async (mode: HomeRecordDetailMode) => {
      setRecordDetailMode(mode);
      if (!club?.id) {
        setRecordDetailRounds([]);
        return;
      }

      setRecordDetailLoading(true);
      try {
        const rounds = await getRoundSummaries(club.id);
        setRecordDetailRounds(rounds);
        if (mode === "awards") setRecordAwardRows(await getHomeAwardRows(club.id, rounds));
      } catch {
        setRecordDetailRounds([]);
        if (mode === "awards") setRecordAwardRows([]);
      } finally {
        setRecordDetailLoading(false);
      }
    },
    [club?.id],
  );

  useEffect(() => {
    loadRecordCards();
  }, [loadRecordCards]);

  useEffect(() => {
    if (!club?.id) return;

    const unsubscribe = subscribeHomeRecordsChanged((changedClubId) => {
      if (changedClubId && changedClubId !== club.id) return;
      if (recordRefreshTimerRef.current) clearTimeout(recordRefreshTimerRef.current);
      recordRefreshTimerRef.current = setTimeout(() => {
        recordRefreshTimerRef.current = null;
        void loadRecordCards({ force: true });
      }, 400);
    });

    return () => {
      unsubscribe();
      if (recordRefreshTimerRef.current) {
        clearTimeout(recordRefreshTimerRef.current);
        recordRefreshTimerRef.current = null;
      }
    };
  }, [club?.id, loadRecordCards]);

  const recentStats = useMemo(
    () => applyStatNavigation(dashboard.stats.items, openRecordDetail),
    [dashboard.stats.items, openRecordDetail],
  );

  const visibleRecentStats = recordCardsReady && recentStats.length > 0
    ? recentStats
    : RECORD_STAT_PLACEHOLDERS;

  const recordExtraCards = useMemo(() => {
    const matchupDiffSum = handicapDiffSumByOpponent(recordDetailRounds, myName);
    const guinnessRecords = guinnessRecordsForUser(recordDetailRounds, myName);
    const awardCount = awardRowsForUser(recordAwardRows, myName).length;

    return [
      {
        key: "matchup",
        title: "상대 전적",
        subtitle: matchupDiffSum === null ? "기록 없음" : `핸디차 합 ${diffText(matchupDiffSum)}`,
        icon: "⚔️",
        onPress: () => openRecordDetail("matchup"),
      },
      {
        key: "records",
        title: "보유 기록",
        subtitle: `${guinnessRecords.length}개`,
        icon: "🏆",
        onPress: () => openRecordDetail("records"),
      },
      {
        key: "awards",
        title: "수상현황",
        subtitle: `${awardCount}회`,
        icon: "📊",
        onPress: () => openRecordDetail("awards"),
      },
      {
        key: "empty",
        title: "",
        subtitle: "",
        icon: "",
      },
    ];
  }, [myName, openRecordDetail, recordAwardRows, recordDetailRounds]);

  const visibleRecordExtraCards = recordCardsReady ? recordExtraCards : RECORD_EXTRA_PLACEHOLDERS;


  if (clubsLoaded && !club) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: palette.bg, paddingTop: insets.top + 24 },
        ]}
      >
        <Text style={styles.emptyRoundIcon}>⛳</Text>
        <Text style={[styles.emptyRoundTitle, { color: palette.text }]}>
          소속 클럽이 필요합니다
        </Text>
        <Text style={[styles.emptyRoundText, { color: palette.muted }]}>
          GogoPar 홈을 사용하려면 클럽을 만들거나 참여해 주세요.
        </Text>
        <GPButton
          label="클럽으로 이동"
          onPress={() => nav.navigate("Main", { screen: "Club" })}
          style={styles.clubButton}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
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
        <HomeLayoutRenderer
          layout={premiumGolfHomeLayout}
          slots={{
            hero: (
              <PremiumHomeMotion index={0}>
                <PremiumHomeHeroSection
                  greeting=""
                  userName={displayName}
                  clubName={club?.name || "GogoPar Club"}
                  rounds={dashboard.hero.rounds}
                  fallbackCourseName={dashboard.hero.courseName}
                  fallbackAddress={dashboard.hero.address}
                  fallbackWeatherText={dashboard.hero.weatherText}
                  fallbackTemperature={dashboard.hero.temperature}
                  fallbackDday={dashboard.hero.dday}
                  fallbackRoundDate={dashboard.hero.roundDate}
                  fallbackTeeTime={dashboard.hero.teeTime}
                  isAdmin={club?.role === "admin"}
                  onCreateRound={() =>
                    nav.navigate("RoundSchedulePrototype", { openCreate: true })
                  }
                  onCaddieBookPress={(round) =>
                    nav.navigate("CaddieBook", caddieBookHeroParams(round))
                  }
                  onGroupsPress={(round) => openRoundPopup(round, "groups")}
                  onLottoPress={(round) => openRoundPopup(round, "lotto")}
                  onAwardPress={(round) => openRoundPopup(round, "award")}
                  onEditRoundPress={(round) =>
                    nav.navigate("RoundSchedulePrototype", {
                      editScheduleId: round.id,
                      modalOnly: true,
                    })
                  }
                  heroImageSource={activeHeroImageSource}
                  topInset={insets.top}
                  activeIndex={activeRoundIndex}
                  onActiveIndexChange={(index) => {
                    setActiveRoundIndex(index);
                  }}
                />
              </PremiumHomeMotion>
            ),
            error: error ? (
              <PremiumHomeMotion index={1}>
                <HomeErrorCard message={error} onRetry={refresh} />
              </PremiumHomeMotion>
            ) : null,
            concierge: (
              <PremiumHomeMotion index={2}>
                <PremiumGogoCaddieCard
                  userName={displayName}
                  courseName={activeRound?.courseName ?? dashboard.aiCaddie.courseName}
                  teeTime={activeRound?.teeTime ?? dashboard.aiCaddie.teeTime}
                  averageScore={dashboard.aiCaddie.averageScore}
                  hasUpcomingRound={!!activeRound}
                  feed={activeFeed}
                  feeds={activeRoundFeeds}
                  roundLabel={activeRoundLabel}
                  userId={userId}
                  onFeedAction={handleCaddieFeedAction}
                  onPress={() => handleCaddieFeedAction(activeFeed)}
                />
              </PremiumHomeMotion>
            ),
            stats: (
              <PremiumHomeMotion index={3}>
                <PremiumRecentStatsSection stats={visibleRecentStats} />
              </PremiumHomeMotion>
            ),
            recordExtras: (
              <PremiumHomeMotion index={3}>
                <PremiumRecordExtrasSection cards={visibleRecordExtraCards} />
              </PremiumHomeMotion>
            ),
          }}
        />
      </ScrollView>

      <AttendanceOverviewModal
        visible={attendanceOverviewVisible}
        loading={attendanceOverviewLoading}
        round={attendanceOverviewRound}
        rows={attendanceOverviewRows}
        onClose={() => setAttendanceOverviewVisible(false)}
      />

      {roundPopupMode !== null ? (
        <RoundInfoModal
          visible
          mode={roundPopupMode}
          round={popupRound}
          loading={popupLoading}
          members={popupMembers}
          lottoEntries={popupLottoEntries}
          lottoPars={popupLottoPars}
          lottoSelection={popupLottoSelection}
          lottoDraw={popupLottoDraw}
          lottoConfig={popupLottoConfig}
          lottoJackpot={popupLottoJackpot}
          myLottoStrokes={popupMyLottoStrokes}
          awardConfig={popupAwardConfig}
          myUserId={userId}
          isAdmin={club?.role === "admin"}
          canPurchaseLotto={isAssignedToRound(popupRound, userId, myName)}
          lottoReady={popupLottoReady}
          lottoSaving={popupLottoSaving}
          drawSaving={popupDrawSaving}
          onToggleLottoHole={togglePopupLottoHole}
          onSaveLottoEntry={savePopupLottoEntry}
          onDraw={runPopupLottoDraw}
          onClose={() => setRoundPopupMode(null)}
          onManage={() => {
            const editScheduleId = popupRound?.id;
            setRoundPopupMode(null);
            nav.navigate(
              "RoundSchedulePrototype",
              editScheduleId ? { editScheduleId, modalOnly: true } : undefined,
            );
          }}
        />
      ) : null}

      {recordDetailMode !== null ? (
        <HomeRecordDetailModal
          visible
          mode={recordDetailMode}
          rounds={recordDetailRounds}
          awards={recordAwardRows}
          userName={myName}
          loading={recordDetailLoading}
          onClose={() => setRecordDetailMode(null)}
        />
      ) : null}
    </View>
  );
}

function HomeRecordDetailModal({
  visible,
  mode,
  rounds,
  awards,
  userName,
  loading,
  onClose,
}: {
  visible: boolean;
  mode: HomeRecordDetailMode | null;
  rounds: SavedRound[];
  awards: AwardDetailRow[];
  userName?: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  const { palette } = useSkin();
  const personalRows = getPersonalRoundRows(rounds, userName);
  const latestRows = personalRows.slice(0, 5);
  const basisRows = [...personalRows].sort((a, b) => a.date.localeCompare(b.date)).slice(-5);
  const average = personalRows.length
    ? Math.round(personalRows.reduce((sum, row) => sum + row.total, 0) / personalRows.length)
    : null;
  const handicaps = computeHandicaps(rounds, 5);
  const myHandicap = userName ? handicaps.get(userName) ?? 0 : 0;
  const guinnessRows = guinnessRecordsForUser(rounds, userName);
  const myAwardRows = awardRowsForUser(awards, userName).sort((a, b) => b.roundDate.localeCompare(a.roundDate));

  const renderRows = (rows: typeof personalRows, diffFromAverage = false) => (
    <View style={styles.detailTable}>
      <View style={styles.detailTableHeader}>
        <Text style={[styles.detailTh, { flex: 0.9, color: palette.muted }]}>날짜</Text>
        <Text style={[styles.detailTh, { flex: 2.3, color: palette.muted }]}>코스</Text>
        <Text style={[styles.detailTh, { flex: 0.9, color: palette.muted, textAlign: "right" }]}>스코어</Text>
        <Text style={[styles.detailTh, { flex: 0.9, color: palette.muted, textAlign: "right" }]}>파대비</Text>
      </View>
      {rows.length ? rows.map((row) => {
        const diff = diffFromAverage && average !== null ? row.total - average : row.diff;
        return (
          <View key={`${row.id}-${mode}`} style={[styles.detailTableRow, { borderColor: palette.border }]}>
            <Text style={[styles.detailTd, { flex: 0.9, color: palette.text }]}>{formatShortDate(row.date)}</Text>
            <Text style={[styles.detailTd, { flex: 2.3, color: palette.text }]} numberOfLines={1}>{row.courseName}</Text>
            <Text style={[styles.detailTdStrong, { flex: 0.9, color: palette.text, textAlign: "right" }]}>{row.total}</Text>
            <Text style={[styles.detailTdStrong, { flex: 0.9, color: diff <= 0 ? palette.green : "#E68A2E", textAlign: "right" }]}>{diffText(diff)}</Text>
          </View>
        );
      }) : (
        <Text style={[styles.detailEmpty, { color: palette.muted }]}>표시할 기록이 없습니다.</Text>
      )}
    </View>
  );

  const renderHandicap = () => (
    <>
      <Text style={[styles.detailSectionTitle, { color: palette.text }]}>↗ 핸디캡 추이 (5경기 슬라이딩)</Text>
      <View style={[styles.handicapTrendBox, { backgroundColor: "rgba(31,160,92,0.10)", borderColor: palette.border }]}> 
        {basisRows.length ? basisRows.map((row, index) => (
          <View key={row.id} style={styles.handicapTrendItem}>
            <Text style={[styles.handicapTrendValue, { color: palette.muted }]}>{diffText(row.diff)}</Text>
            <View style={[styles.handicapTrendLine, { backgroundColor: index === basisRows.length - 1 ? palette.green : "rgba(25,156,89,0.18)" }]} />
          </View>
        )) : <Text style={[styles.detailEmpty, { color: palette.muted }]}>핸디캡 추이 데이터가 없습니다.</Text>}
        {!!basisRows.length && <Text style={[styles.handicapTrendCaption, { color: palette.muted }]}>← 과거   최근 →</Text>}
      </View>
      {renderRows([...basisRows].reverse())}
    </>
  );

  const renderMatchup = () => {
    const records = new Map<string, { played: number; wins: number; draws: number; losses: number; handicap: number; diff: number }>();
    const name = userName ?? "";
    for (const round of rounds) {
      const me = findPlayer(round, name);
      if (!me) continue;
      const myH = handicapBeforeHome(name, rounds, round.date, 5);
      const myNet = playerTotal(me.strokes) - myH;
      for (const opponent of round.players) {
        if (opponent.name === me.name) continue;
        const oppH = handicapBeforeHome(opponent.name, rounds, round.date, 5);
        const oppNet = playerTotal(opponent.strokes) - oppH;
        const current = records.get(opponent.name) ?? { played: 0, wins: 0, draws: 0, losses: 0, handicap: handicaps.get(opponent.name) ?? 0, diff: myHandicap - (handicaps.get(opponent.name) ?? 0) };
        current.played += 1;
        if (myNet < oppNet) current.wins += 1;
        else if (myNet > oppNet) current.losses += 1;
        else current.draws += 1;
        records.set(opponent.name, current);
      }
    }
    const rows = [...records.entries()].sort((a, b) => b[1].played - a[1].played);

    return (
      <View style={styles.h2hTable}>
        <View style={styles.h2hHeader}>
          {['상대', '경기', '승', '무', '패', '승률', '핸디', '핸디차'].map((label) => (
            <Text key={label} style={[styles.h2hTh, { color: palette.muted }]}>{label}</Text>
          ))}
        </View>
        {rows.length ? rows.map(([opponent, record]) => {
          const rate = record.played ? Math.round((record.wins / record.played) * 100) : 0;
          return (
            <View key={opponent} style={[styles.h2hRow, { borderColor: palette.border }]}>
              <Text style={[styles.h2hTdName, { color: palette.text }]} numberOfLines={1}>{opponent}</Text>
              <Text style={[styles.h2hTd, { color: palette.text }]}>{record.played}</Text>
              <Text style={[styles.h2hTd, { color: "#2F80ED" }]}>{record.wins}</Text>
              <Text style={[styles.h2hTd, { color: palette.text }]}>{record.draws}</Text>
              <Text style={[styles.h2hTd, { color: "#E8594F" }]}>{record.losses}</Text>
              <Text style={[styles.h2hTdStrong, { color: palette.text }]}>{rate}%</Text>
              <Text style={[styles.h2hTd, { color: palette.text }]}>{diffText(record.handicap)}</Text>
              <Text style={[styles.h2hTdStrong, { color: record.diff > 0 ? "#E8594F" : palette.green }]}>{diffText(record.diff)}</Text>
            </View>
          );
        }) : <Text style={[styles.detailEmpty, { color: palette.muted }]}>상대 전적 데이터가 없습니다.</Text>}
      </View>
    );
  };

  const renderRecords = () => {
    return (
      <View style={styles.recordsGrid}>
        {guinnessRows.length ? guinnessRows.map((record) => (
          <View key={`${record.label}-${record.date}`} style={[styles.recordBadgeCard, { backgroundColor: "rgba(31,160,92,0.10)", borderColor: palette.border }]}> 
            <Text style={[styles.recordBadgeLabel, { color: palette.muted }]}>{record.label}</Text>
            <Text style={[styles.recordBadgeValue, { color: palette.text }]}>{record.value}</Text>
            <Text style={[styles.recordBadgeSub, { color: palette.muted }]} numberOfLines={1}>{formatShortDate(record.date)} · {record.courseName}</Text>
          </View>
        )) : <Text style={[styles.detailEmpty, { color: palette.muted }]}>보유 중인 기네스북 기록이 없습니다.</Text>}
      </View>
    );
  };

  const renderAwards = () => (
    <View style={styles.detailTable}>
      {myAwardRows.length ? myAwardRows.map((award) => (
        <View key={`${award.id}-${award.roundDate}`} style={[styles.detailTableRow, { borderColor: palette.border }]}>
          <Text style={[styles.detailTd, { flex: 0.8, color: palette.text }]}>{formatShortDate(award.roundDate)}</Text>
          <Text style={[styles.detailTd, { flex: 1.4, color: palette.text }]} numberOfLines={1}>{award.label}</Text>
          <Text style={[styles.detailTdStrong, { flex: 1.1, color: palette.green, textAlign: "right" }]} numberOfLines={1}>{award.detail}</Text>
        </View>
      )) : (
        <Text style={[styles.detailEmpty, { color: palette.muted }]}>아직 수상 기록이 없습니다.</Text>
      )}
    </View>
  );

  const titleByMode: Record<HomeRecordDetailMode, string> = {
    handicap: "핸디캡 근거 (최근 5경기)",
    average: average === null ? "전체 라운드 기록" : `전체 라운드 기록 (평균 ${average}타)`,
    awards: `수상현황 (${myAwardRows.length}회)`,
    recent: "최근 라운드 기록",
    best: "베스트 스코어 순위",
    matchup: `역대 전적 (핸디 ${diffText(myHandicap)})`,
    records: "보유 기록",
  };

  const content = () => {
    if (loading) return <Text style={[styles.detailEmpty, { color: palette.muted }]}>불러오는 중입니다.</Text>;
    if (!mode) return null;
    if (mode === "handicap") return renderHandicap();
    if (mode === "matchup") return renderMatchup();
    if (mode === "records") return renderRecords();
    if (mode === "awards") return renderAwards();
    if (mode === "average") return renderRows(personalRows, true);
    if (mode === "best") return renderRows([...personalRows].sort((a, b) => a.total - b.total));
    return renderRows(latestRows);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.detailModalBackdrop}>
        <View style={[styles.detailModalCard, { backgroundColor: palette.card }]}> 
          <View style={styles.detailModalHeader}>
            <Text style={[styles.detailModalTitle, { color: palette.text }]}>{mode ? titleByMode[mode] : "기록 상세"}</Text>
            <TouchableOpacity activeOpacity={0.86} onPress={onClose} style={[styles.detailCloseButton, { backgroundColor: palette.green }]}> 
              <Text style={styles.detailCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {content()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AttendanceOverviewModal({
  visible,
  loading,
  round,
  rows,
  onClose,
}: {
  visible: boolean;
  loading: boolean;
  round: HomeUpcomingRound | null;
  rows: Array<{ userId: string; name: string; status: RoundAttendanceLabel }>;
  onClose: () => void;
}) {
  const { palette } = useSkin();
  const groups: Array<{ title: string; status: RoundAttendanceLabel }> = [
    { title: "참가자", status: "참석" },
    { title: "미참가자", status: "불참" },
    { title: "미정", status: "미정" },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>참가자 현황</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose} activeOpacity={0.8}>
              <Text style={styles.modalCloseText}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSubTitle, { color: palette.muted }]} numberOfLines={2}>
            {round ? `${round.courseName} · ${round.dateLabel}` : "라운드 참석 현황"}
          </Text>
          {loading ? (
            <ActivityIndicator color={palette.green} style={{ marginVertical: 28 }} />
          ) : (
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {groups.map((group) => {
                const names = rows.filter((row) => row.status === group.status).map((row) => row.name);
                return (
                  <View key={group.status} style={[styles.popupSection, { borderColor: palette.border }]}>
                    <Text style={[styles.popupSectionTitle, { color: palette.text }]}>
                      {group.title} : {names.length}명
                    </Text>
                    <Text style={[styles.groupMembers, { color: names.length ? palette.text : palette.muted }]}>
                      {names.length ? names.join(" · ") : "해당 회원이 없습니다."}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function RoundInfoModal({
  visible,
  mode,
  round,
  loading,
  members,
  lottoEntries,
  lottoPars,
  lottoSelection,
  lottoDraw,
  lottoConfig,
  lottoJackpot,
  myLottoStrokes,
  awardConfig,
  myUserId,
  isAdmin,
  canPurchaseLotto,
  lottoReady,
  lottoSaving,
  drawSaving,
  onToggleLottoHole,
  onSaveLottoEntry,
  onDraw,
  onClose,
  onManage,
}: {
  visible: boolean;
  mode: "groups" | "lotto" | "award" | null;
  round: ScheduledRound | null;
  loading: boolean;
  members: Array<{ userId: string; name: string; role: string }>;
  lottoEntries: RoundLottoEntry[];
  lottoPars: number[];
  lottoSelection: LottoSelection;
  lottoDraw: RoundLottoDraw | null;
  lottoConfig: LottoAwardConfig;
  lottoJackpot: number;
  myLottoStrokes: number[] | null;
  awardConfig: ClubAwardConfig | null;
  myUserId?: string | null;
  isAdmin: boolean;
  canPurchaseLotto: boolean;
  lottoReady: boolean;
  lottoSaving: boolean;
  drawSaving: boolean;
  onToggleLottoHole: (parKey: keyof LottoSelection, hole: number) => void;
  onSaveLottoEntry: () => void;
  onDraw: () => void;
  onClose: () => void;
  onManage: () => void;
}) {
  const { palette } = useSkin();
  const [revealedLottoHoles, setRevealedLottoHoles] = useState<number[]>([]);
  const groups = groupLines(round);
  const isGroups = mode === "groups";
  const isLotto = mode === "lotto";
  const isAward = mode === "award";
  const memberNameById = useMemo(
    () => new Map(members.map((member) => [member.userId, member.name])),
    [members],
  );
  const myLottoEntry = myUserId ? lottoEntries.find((entry) => entry.userId === myUserId) : null;
  const myPurchasedHoles = myLottoEntry
    ? [
        ...myLottoEntry.selectedHoles.par3,
        ...myLottoEntry.selectedHoles.par4,
        ...myLottoEntry.selectedHoles.par5,
      ].sort((a, b) => a - b)
    : [];
  const lottoHoleGroups: Array<{ key: keyof LottoSelection; label: string; limit: number; holes: number[] }> = [
    { key: "par3", label: "파 3", limit: 1, holes: lottoPars.map((par, index) => par === 3 ? index + 1 : null).filter((hole): hole is number => !!hole) },
    { key: "par4", label: "파 4", limit: 3, holes: lottoPars.map((par, index) => par === 4 ? index + 1 : null).filter((hole): hole is number => !!hole) },
    { key: "par5", label: "파 5", limit: 2, holes: lottoPars.map((par, index) => par === 5 ? index + 1 : null).filter((hole): hole is number => !!hole) },
  ];
  const lottoPurchaseRows = lottoEntries.map((entry) => {
    const holes = [
      ...entry.selectedHoles.par3,
      ...entry.selectedHoles.par4,
      ...entry.selectedHoles.par5,
    ].sort((a, b) => a - b);
    const drawnScores = lottoDraw?.drawnScores;
    const hits =
      lottoDraw?.drawStatus === "COMPLETED" && drawnScores
        ? holes.filter((hole) => !!drawnScores[String(hole)]).length
        : 0;

    return {
      id: entry.userId,
      name: memberNameById.get(entry.userId) ?? "회원",
      holes,
      hits,
    };
  });
  const awardItems = useMemo(() => {
    if (!awardConfig) return [];
    const defs = AWARD_CATEGORIES.flatMap((category) => category.items);
    return fillToCount(awardConfig.items, awardConfig.count)
      .map((id) => defs.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => !!item);
  }, [awardConfig]);

  const canDrawLotto =
    isLotto &&
    !!myUserId &&
    lottoDraw?.drafterUserId === myUserId &&
    lottoDraw.drawStatus !== "COMPLETED" &&
    isRoundDateAvailable(round?.date);
  const myLottoResultRows = myPurchasedHoles.map((hole) => ({
    hole,
    par: lottoPars[hole - 1],
    myScore: myLottoStrokes?.[hole - 1],
    drawScore: lottoDraw?.drawnScores?.[String(hole)] ?? null,
  }));

  const myLottoHitCount = myLottoResultRows.filter((item) =>
    isLottoScoreHit(item.myScore, item.par, item.drawScore)
  ).length;
  const myLottoResultText =
    myLottoHitCount === 6
      ? `6개 적중 ${formatWon(lottoJackpot)}`
      : myLottoHitCount === 4
        ? `4개 적중 ${formatWon(lottoConfig.prizes["4"] ?? 10000)}`
        : myLottoHitCount === 3
          ? `3개 적중 ${formatWon(lottoConfig.prizes["3"] ?? 5000)}`
          : "낙첨";
  const allLottoCardsRevealed =
    myLottoResultRows.length === 6 &&
    myLottoResultRows.every((item) => revealedLottoHoles.includes(item.hole));

  useEffect(() => {
    setRevealedLottoHoles([]);
  }, [visible, round?.id, lottoDraw?.drawStatus]);

  const modalTitle = isGroups
    ? "조편성 결과"
    : isAward
      ? "시상계획"
      : "Lotto 6/18";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              {modalTitle}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalClose}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          <Text
            style={[styles.modalSubTitle, { color: palette.muted }]}
            numberOfLines={2}
          >
            {round
              ? `${round.courseName ?? "골프장 미정"} · ${round.date} ${round.time || ""}`
              : "선택된 라운드 정보를 불러옵니다"}
          </Text>

          {loading ? (
            <Text style={[styles.modalEmpty, { color: palette.muted }]}>
              불러오는 중입니다.
            </Text>
          ) : isGroups ? (
            groups.length > 0 ? (
              groups.map((group) => (
                <View
                  key={group.id}
                  style={[styles.groupRow, { borderColor: palette.border }]}
                >
                  <Text style={[styles.groupTitle, { color: palette.text }]}>
                    {group.title}
                  </Text>
                  {!!group.course && (
                    <Text
                      style={[styles.groupCourse, { color: palette.muted }]}
                    >
                      {group.course}
                    </Text>
                  )}
                  <Text style={[styles.groupMembers, { color: palette.text }]}>
                    {group.members}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.modalEmpty, { color: palette.muted }]}>
                아직 실제 조편성 결과가 없습니다.
              </Text>
            )
          ) : isLotto ? (
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={[styles.popupSection, { borderColor: palette.border }]}>
                <Text style={[styles.popupSectionTitle, { color: palette.text }]}>
                  내 Lotto 구매
                </Text>
                <Text style={[styles.lottoJackpotText, { color: palette.green }]}>
                  1등 당첨금 {formatWon(lottoJackpot)}
                </Text>
                {myLottoEntry && myPurchasedHoles.length === 6 ? (
                  <View style={styles.myLottoPurchasedBox}>
                    <Text style={[styles.myLottoPurchasedText, { color: palette.green }]}>
                      구매 완료
                    </Text>
                    <Text style={[styles.lottoHoles, { color: palette.text }]} numberOfLines={1}>
                      {myPurchasedHoles.join(", ")}
                    </Text>
                  </View>
                ) : canPurchaseLotto ? (
                  <>
                    <Text style={[styles.lottoGuideText, { color: palette.muted }]}>
                      파3홀 1개, 파4홀 3개, 파5홀 2개를 선택하세요.
                    </Text>
                    {lottoHoleGroups.map((group) => (
                      <View key={group.key} style={styles.lottoHoleGroup}>
                        <View style={styles.lottoHoleGroupHeader}>
                          <Text style={[styles.lottoHoleGroupTitle, { color: palette.text }]}>{group.label}</Text>
                          <Text style={[styles.lottoHoleGroupLimit, { color: palette.muted }]}>{lottoSelection[group.key].length}/{group.limit}</Text>
                        </View>
                        <View style={styles.lottoHoleGrid}>
                          {group.holes.map((hole) => {
                            const selected = lottoSelection[group.key].includes(hole);
                            return (
                              <TouchableOpacity
                                key={hole}
                                activeOpacity={0.82}
                                onPress={() => onToggleLottoHole(group.key, hole)}
                                style={[
                                  styles.lottoHoleButton,
                                  { borderColor: selected ? palette.green : palette.border, backgroundColor: selected ? "rgba(31,160,92,0.10)" : "rgba(0,0,0,0.03)" },
                                ]}
                              >
                                <Text style={[styles.lottoHoleButtonText, { color: selected ? palette.green : palette.muted }]}>{hole}H</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={onSaveLottoEntry}
                      disabled={!lottoReady || lottoSaving}
                      style={[styles.lottoSaveButton, { backgroundColor: palette.green }, (!lottoReady || lottoSaving) && { opacity: 0.45 }]}
                    >
                      {lottoSaving ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.lottoSaveButtonText}>구매 완료</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={[styles.modalEmptySmall, { color: palette.muted }]}>
                    조편성에 포함된 회원만 구매할 수 있습니다.
                  </Text>
                )}
              </View>

              <View style={[styles.popupSection, { borderColor: palette.border }]}>
                <View style={styles.popupSectionHeader}>
                  <View />
                  {canDrawLotto ? (
                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={onDraw}
                      disabled={drawSaving}
                      style={[styles.lottoDrawStartButton, { backgroundColor: palette.green }, drawSaving && { opacity: 0.55 }]}
                    >
                      {drawSaving ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.lottoDrawStartText}>로또 추첨</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>

                {lottoDraw?.drawStatus === "COMPLETED" && lottoDraw.drawnScores ? (
                  <>
                    {allLottoCardsRevealed ? (
                      <View style={styles.lottoPrizeRow}>
                        <Text style={[styles.lottoResultSummary, { color: palette.green }]}>
                          결과 :{" "}
                          <Text
                            style={{
                              color: myLottoHitCount >= 3 ? palette.green : "#E8594F",
                            }}
                          >
                            {myLottoResultText}
                          </Text>
                        </Text>
                      </View>
                    ) : null}
                    {myLottoEntry && myLottoResultRows.length === 6 ? (
                      <>
                        <View style={styles.myLottoScratchGrid}>
                          {myLottoResultRows.map((item) => (
                            <ScratchLottoResultCard
                              key={`${item.hole}-${item.drawScore?.score ?? "pending"}`}
                              hole={item.hole}
                              par={item.par}
                              myScore={item.myScore}
                              drawScore={item.drawScore}
                              onReveal={() =>
                                setRevealedLottoHoles((current) =>
                                  current.includes(item.hole)
                                    ? current
                                    : [...current, item.hole]
                                )
                              }
                            />
                          ))}
                        </View>
                        <Text style={[styles.lottoScratchHint, { color: palette.muted }]}>
                          회색 영역을 손으로 문지르면 추첨결과가 표시됩니다.
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.modalEmptySmall, { color: palette.muted }]}>
                        내 구매 내역이 있어야 결과를 확인할 수 있습니다.
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={[styles.modalEmptySmall, { color: palette.muted }]}>
                    {lottoDraw?.drafterUserId
                      ? canDrawLotto
                        ? "추첨 버튼을 눌러 결과를 생성하세요."
                        : "라운드 당일부터 추첨할 수 있습니다."
                      : "추첨자가 아직 지정되지 않았습니다."}
                  </Text>
                )}
              </View>
            </ScrollView>
          ) : isAward ? (
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {awardItems.length > 0 ? (
                awardItems.map((item) => (
                  <View key={item.id} style={[styles.awardPlanRow, { borderColor: palette.border }]}>
                    <Text style={styles.awardPlanIcon}>{item.icon}</Text>
                    <View style={styles.awardPlanTextWrap}>
                      <Text style={[styles.awardPlanTitle, { color: palette.text }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.awardPlanDesc, { color: palette.muted }]} numberOfLines={2}>
                        {item.desc}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.modalEmpty, { color: palette.muted }]}>
                  이 라운드에 등록된 시상계획이 없습니다.
                </Text>
              )}
            </ScrollView>
          ) : null}

          {isGroups && isAdmin ? (
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={onManage}
              style={[styles.modalAction, { backgroundColor: palette.green }]}
            >
              <Text style={styles.modalActionText}>조편성 관리로 이동</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function ScratchLottoResultCard({
  hole,
  par,
  myScore,
  drawScore,
  onReveal,
}: {
  hole: number;
  par?: number;
  myScore?: number;
  drawScore: RoundLottoDrawScore | null;
  onReveal: () => void;
}) {
  const { palette } = useSkin();
  const [revealed, setRevealed] = useState(false);
  const scratchCount = useRef(0);
  const revealCard = () => {
    setRevealed((current) => {
      if (!current) onReveal();
      return true;
    });
  };
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        scratchCount.current += 1;
        if (scratchCount.current >= 2) revealCard();
      },
      onPanResponderMove: () => {
        scratchCount.current += 1;
        if (scratchCount.current >= 5) revealCard();
      },
    }),
  ).current;
  const isHit = isLottoScoreHit(myScore, par, drawScore);
  const drawLabel = drawScore
    ? compactGolfScoreLabel(drawScore.label ?? formatGolfScore(drawScore.score, drawScore.par ?? par))
    : "-";

  return (
    <View style={[styles.scratchCard, { borderColor: palette.border }]}>
      <View style={styles.scratchScoreRow}>
        <Text style={[styles.scratchMyScore, { color: palette.text }]}>
          {`${hole}H : ${compactGolfScoreLabel(formatGolfScore(myScore, par))}`}
        </Text>
      </View>

      <View style={styles.scratchResultBox}>
        <Text style={[styles.scratchDrawScore, { color: palette.text }]}>
          {drawLabel}
        </Text>

        {revealed && drawScore ? (
          isHit ? (
            <View pointerEvents="none" style={styles.scratchHitCircle} />
          ) : (
            <Text pointerEvents="none" style={styles.scratchMissMark}>×</Text>
          )
        ) : null}

        {!revealed ? (
          <View {...panResponder.panHandlers} style={styles.scratchCover}>
            <Text style={styles.scratchCoverText}>문질러 확인</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 0, paddingTop: 0 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  clubButton: { marginTop: 16 },
  emptyRoundIcon: { fontSize: 34, marginBottom: 10 },
  emptyRoundTitle: {
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyRoundText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
  },
  clubPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    paddingTop: 76,
    paddingHorizontal: 18,
  },
  clubPickerCard: { borderRadius: 24, padding: 16 },
  clubPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  clubPickerTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  clubPickerRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 13,
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  clubPickerIcon: { fontSize: 19, lineHeight: 22 },
  clubPickerTextWrap: { flex: 1, minWidth: 0 },
  clubPickerName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  clubPickerSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    marginTop: 1,
  },
  clubPickerSelected: { fontSize: 11, lineHeight: 15, fontWeight: "900" },
  clubManageButton: {
    minHeight: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  clubManageButtonText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: { width: "100%", maxWidth: 420, borderRadius: 24, padding: 18 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: { fontSize: 24, lineHeight: 28, fontWeight: "900" },
  modalSubTitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  modalEmpty: {
    paddingVertical: 28,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
  },
  groupRow: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12 },
  groupTitle: { fontSize: 15, lineHeight: 20, fontWeight: "900" },
  groupCourse: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  groupMembers: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
  },
  modalScroll: {
    maxHeight: 360,
    marginTop: 8,
  },
  popupSection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  popupSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  popupSectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    marginBottom: 10,
  },
  lottoJackpotText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    marginBottom: 10,
  },
  modalEmptySmall: {
    paddingVertical: 12,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  myLottoPurchasedBox: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  myLottoPurchasedText: {
    width: 72,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  lottoGuideText: {
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
  },
  lottoHoleGroup: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    paddingTop: 10,
    marginTop: 10,
  },
  lottoHoleGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  lottoHoleGroupTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  lottoHoleGroupLimit: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
  },
  lottoHoleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  lottoHoleButton: {
    minWidth: 48,
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
  },
  lottoHoleButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  lottoSaveButton: {
    minHeight: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  lottoSaveButtonText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  lottoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 32,
  },
  lottoName: {
    width: 72,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  lottoHoles: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  lottoPrizeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  lottoPrizeText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
  },
  lottoPrizeAmount: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  lottoResultSummary: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  lottoDrawStartButton: {
    minWidth: 82,
    minHeight: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  lottoDrawStartText: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  myLottoScratchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  scratchCard: {
    flexBasis: "30%",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 154,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.025)",
  },
  scratchHole: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  scratchScoreRow: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  scratchScoreLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
  },
  scratchMyScore: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  scratchResultBox: {
    position: "relative",
    minHeight: 76,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  scratchDrawScore: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  scratchHitCircle: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 5,
    borderColor: "#E53935",
    transform: [{ rotate: "-8deg" }],
  },
  scratchMissMark: {
    position: "absolute",
    color: "#E53935",
    fontSize: 58,
    lineHeight: 62,
    fontWeight: "900",
    transform: [{ rotate: "-8deg" }],
  },
  scratchCover: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#AAB0AA",
  },
  scratchCoverText: {
    color: "#fff",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
  },
  lottoScratchHint: {
    marginTop: 9,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  lottoDrawResultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 10,
  },
  lottoDrawResultCell: {
    width: 54,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  lottoDrawResultHole: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
  },
  lottoDrawResultScore: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  lottoDrawResultPar: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
  },
  lottoResultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
  },
  lottoResultText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
  },
  awardPlanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  awardPlanIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  awardPlanTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  awardPlanTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  awardPlanDesc: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 1,
  },
  modalAction: {
    minHeight: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  modalActionText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },

  detailModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11,24,18,0.64)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  detailModalCard: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "84%",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  detailModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  detailModalTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  detailCloseButton: {
    minWidth: 62,
    minHeight: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  detailCloseText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  detailSectionTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    marginBottom: 12,
  },
  handicapTrendBox: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    marginBottom: 18,
  },
  handicapTrendItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  handicapTrendValue: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    marginBottom: 5,
  },
  handicapTrendLine: {
    width: "100%",
    height: 10,
    borderRadius: 5,
  },
  handicapTrendCaption: {
    position: "absolute",
    right: 10,
    bottom: -20,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
  },
  detailTable: {
    marginTop: 10,
  },
  detailTableHeader: {
    flexDirection: "row",
    paddingBottom: 8,
  },
  detailTableRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    borderTopWidth: 1,
  },
  detailTh: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
  },
  detailTd: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  detailTdStrong: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  detailEmpty: {
    paddingVertical: 28,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  h2hTable: {
    minWidth: 360,
  },
  h2hHeader: {
    flexDirection: "row",
    paddingBottom: 8,
  },
  h2hRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    borderTopWidth: 1,
  },
  h2hTh: {
    width: 42,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  h2hTdName: {
    width: 42,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  h2hTd: {
    width: 42,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  h2hTdStrong: {
    width: 42,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  recordsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  recordBadgeCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    justifyContent: "center",
  },
  recordBadgeLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
  },
  recordBadgeValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 2,
  },
  recordBadgeSub: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  errorCard: { alignItems: "center", padding: 18, marginBottom: 4 },
  errorIcon: { fontSize: 28, marginBottom: 8 },
  errorTitle: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "center",
  },
  errorButton: { marginTop: 14 },
});
