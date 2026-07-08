import { useCallback, useMemo, useState } from "react";
import {
  Modal,
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
import { getRoundSchedules, type ScheduledRound } from "../lib/roundSchedule";
import { computeHandicaps, getRounds, playerTotal, totalPar, type SavedRound } from "../lib/store";

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
  if (actionType === "open_groups" || actionType === "open_lotto")
    return nav.navigate("RoundSchedulePrototype");
  if (actionType === "open_notice") return nav.navigate("NoticePrototype");
  if (actionType === "open_result")
    return nav.navigate("Main", { screen: "History" });
  return nav.navigate("RoundSchedulePrototype", { openCreate: true });
}

type HomeRecordDetailMode = "handicap" | "average" | "recent" | "best" | "matchup" | "records";

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

function diffText(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value > 0 ? `+${value}` : `${value}`;
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
  const { name: myName, nickname, userId } = useUserProfile();
  const displayName = nickname || myName || "골퍼";
  const { dashboard, loading, error, refresh } = useHomeDashboard({
    clubId: club?.id,
    userName: myName,
    userId,
  });
  const [selectedHeroKey, setSelectedHeroKey] = useState<string | null>(null);
  const [roundPopupMode, setRoundPopupMode] = useState<
    "groups" | "lotto" | null
  >(null);
  const [popupRound, setPopupRound] = useState<ScheduledRound | null>(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [recordDetailMode, setRecordDetailMode] = useState<HomeRecordDetailMode | null>(null);
  const [recordDetailRounds, setRecordDetailRounds] = useState<SavedRound[]>([]);
  const [recordDetailLoading, setRecordDetailLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
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
    }, []),
  );

  const activeHeroImageSource = selectedHeroKey
    ? getCourseHeroAssetByKey(selectedHeroKey).source
    : getCourseHeroImageSource(
        dashboard.hero.rounds[0]?.courseName ?? dashboard.hero.courseName,
      );

  const openRoundPopup = useCallback(
    async (round: HomeHeroRound, mode: "groups" | "lotto") => {
      setRoundPopupMode(mode);
      setPopupRound(null);
      if (!club?.id) return;
      setPopupLoading(true);
      try {
        const schedules = await getRoundSchedules(club.id);
        setPopupRound(schedules.find((item) => item.id === round.id) ?? null);
      } catch {
        setPopupRound(null);
      } finally {
        setPopupLoading(false);
      }
    },
    [club?.id],
  );

  const openRecordDetail = useCallback(
    async (mode: HomeRecordDetailMode) => {
      setRecordDetailMode(mode);
      if (!club?.id) {
        setRecordDetailRounds([]);
        return;
      }

      setRecordDetailLoading(true);
      try {
        const rounds = await getRounds(club.id);
        setRecordDetailRounds(rounds);
      } catch {
        setRecordDetailRounds([]);
      } finally {
        setRecordDetailLoading(false);
      }
    },
    [club?.id],
  );

  const recentStats = useMemo(
    () => applyStatNavigation(dashboard.stats.items, openRecordDetail),
    [dashboard.stats.items, openRecordDetail],
  );

  const recordExtraCards = useMemo(() => {
    const statValue = (key: string) =>
      dashboard.stats.items.find((item) => item.key === key)?.value || "-";

    const best = statValue("best");
    const average = statValue("average");
    const recent = statValue("recent");
    const roundCount = dashboard.stats.recentRounds.length;

    return [
      {
        key: "matchup",
        title: "상대 전적",
        subtitle: `${roundCount}경기 기준`,
        icon: "⚔️",
        onPress: () => openRecordDetail("matchup"),
      },
      {
        key: "records",
        title: "보유 기록",
        subtitle: best === "-" ? "기록 없음" : `베스트 ${best}`,
        icon: "🏆",
        onPress: () => openRecordDetail("records"),
      },
      {
        key: "average",
        title: "평균 기록",
        subtitle: average === "-" ? "기록 없음" : `${average}`,
        icon: "📊",
        onPress: () => openRecordDetail("average"),
      },
      {
        key: "recent",
        title: "최근 기록",
        subtitle: recent === "-" ? "기록 없음" : `${recent}`,
        icon: "📝",
        onPress: () => openRecordDetail("recent"),
      },
    ];
  }, [dashboard.stats.items, dashboard.stats.recentRounds.length, nav, openRecordDetail]);


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
                  onAwardPress={() =>
                    nav.navigate("Main", {
                      screen: "Club",
                      params: { openManageMenu: true },
                    })
                  }
                  onEditRoundPress={(round) =>
                    nav.navigate("RoundSchedulePrototype", {
                      editScheduleId: round.id,
                      modalOnly: true,
                    })
                  }
                  heroImageSource={activeHeroImageSource}
                  topInset={insets.top}
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
                  courseName={dashboard.aiCaddie.courseName}
                  teeTime={dashboard.aiCaddie.teeTime}
                  averageScore={dashboard.aiCaddie.averageScore}
                  hasUpcomingRound={dashboard.aiCaddie.hasUpcomingRound}
                  feed={dashboard.feed}
                  onPress={() =>
                    resolveFeedNavigation(
                      nav,
                      dashboard.feed.actionType,
                      dashboard.upcomingRound,
                    )
                  }
                />
              </PremiumHomeMotion>
            ),
            stats:
              recentStats.length > 0 ? (
                <PremiumHomeMotion index={3}>
                  <PremiumRecentStatsSection stats={recentStats} />
                </PremiumHomeMotion>
              ) : null,
            recordExtras: (
              <PremiumHomeMotion index={4}>
                <PremiumRecordExtrasSection cards={recordExtraCards} />
              </PremiumHomeMotion>
            ),
          }}
        />
      </ScrollView>

      <RoundInfoModal
        visible={roundPopupMode !== null}
        mode={roundPopupMode}
        round={popupRound}
        loading={popupLoading}
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

      <HomeRecordDetailModal
        visible={recordDetailMode !== null}
        mode={recordDetailMode}
        rounds={recordDetailRounds}
        userName={myName}
        loading={recordDetailLoading}
        onClose={() => setRecordDetailMode(null)}
      />
    </View>
  );
}

function HomeRecordDetailModal({
  visible,
  mode,
  rounds,
  userName,
  loading,
  onClose,
}: {
  visible: boolean;
  mode: HomeRecordDetailMode | null;
  rounds: SavedRound[];
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
  const best = personalRows.length ? [...personalRows].sort((a, b) => a.total - b.total)[0] : null;
  const handicaps = computeHandicaps(rounds, 5);
  const myHandicap = userName ? handicaps.get(userName) ?? 0 : 0;

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
    const totalBirdies = personalRows.reduce((sum, row) => sum + row.birdies, 0);
    const totalPars = personalRows.reduce((sum, row) => sum + row.pars, 0);
    const cards = [
      { label: "라운드", value: `${personalRows.length}회`, sub: "기록 라운드" },
      { label: "베스트", value: best ? `${best.total}타` : "-", sub: best?.courseName ?? "기록 없음" },
      { label: "버디", value: `${totalBirdies}개`, sub: "누적" },
      { label: "파", value: `${totalPars}개`, sub: "누적" },
    ];
    return (
      <View style={styles.recordsGrid}>
        {cards.map((card) => (
          <View key={card.label} style={[styles.recordBadgeCard, { backgroundColor: "rgba(31,160,92,0.10)", borderColor: palette.border }]}> 
            <Text style={[styles.recordBadgeLabel, { color: palette.muted }]}>{card.label}</Text>
            <Text style={[styles.recordBadgeValue, { color: palette.text }]}>{card.value}</Text>
            <Text style={[styles.recordBadgeSub, { color: palette.muted }]} numberOfLines={1}>{card.sub}</Text>
          </View>
        ))}
      </View>
    );
  };

  const titleByMode: Record<HomeRecordDetailMode, string> = {
    handicap: "핸디캡 근거 (최근 5경기)",
    average: average === null ? "전체 라운드 기록" : `전체 라운드 기록 (평균 ${average}타)`,
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

function RoundInfoModal({
  visible,
  mode,
  round,
  loading,
  onClose,
  onManage,
}: {
  visible: boolean;
  mode: "groups" | "lotto" | null;
  round: ScheduledRound | null;
  loading: boolean;
  onClose: () => void;
  onManage: () => void;
}) {
  const { palette } = useSkin();
  const groups = groupLines(round);
  const isGroups = mode === "groups";

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
              {isGroups ? "조편성 결과" : "Lotto 구매 및 결과"}
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
          ) : (
            <View style={[styles.groupRow, { borderColor: palette.border }]}>
              <Text style={[styles.groupTitle, { color: palette.text }]}>
                Lotto 6/18
              </Text>
              <Text style={[styles.groupCourse, { color: palette.muted }]}>
                선택된 라운드 기준으로 구매와 결과 확인을 진행합니다.
              </Text>
              <Text style={[styles.groupMembers, { color: palette.text }]}>
                구매/결과 상세 관리는 아래 버튼에서 이어서 확인하세요.
              </Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={onManage}
            style={[styles.modalAction, { backgroundColor: palette.green }]}
          >
            <Text style={styles.modalActionText}>
              {isGroups ? "조편성 관리로 이동" : "Lotto 구매/결과 확인"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    width: "48%",
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
