import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getHomeAiCaddieUpdate,
  getHomeDashboardBase,
  getHomeTravelUpdates,
  getHomeWeatherDashboard,
  mergeHomeAiCaddie,
  mergeHomeTravel,
  mergeHomeWeather,
  refreshHomeRoundState,
} from "../services/homeService";
import { createEmptyHomeDashboard } from "../mappers/homeMapper";
import type { HomeDashboard, HomeDashboardState } from "../types/home";
import { supabase } from "../../../lib/supabase";
import { subscribeHomeDashboardChanged } from "../../../lib/homeDashboardEvents";

let homeDashboardChannelSequence = 0;

function createHomeDashboardChannelId() {
  homeDashboardChannelSequence += 1;
  return `${Date.now().toString(36)}-${homeDashboardChannelSequence.toString(36)}`;
}

type UseHomeDashboardParams = {
  clubId?: string | null;
  userName?: string | null;
  userId?: string | null;
  homeLatitude?: number | null;
  homeLongitude?: number | null;
  departureBufferMinutes?: number;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "홈 데이터를 불러오지 못했습니다.";
}

const ROUND_ENRICHMENT_KEYS = [
  "weatherText",
  "temperature",
  "windText",
  "fiveHourWeatherSummary",
  "fiveHourWeatherDetail",
  "fiveHourWeatherHours",
  "openWeatherHours",
  "kmaIssuedAt",
  "routeTimeText",
  "routeTimeByProvider",
  "departureTimeText",
] as const;

function preserveRoundEnrichment(current: HomeDashboard, next: HomeDashboard): HomeDashboard {
  const currentById = new Map(current.hero.rounds.map((round) => [round.id, round]));
  const rounds = next.hero.rounds.map((round) => {
    const previous = currentById.get(round.id);
    if (!previous) return round;
    const enrichment = ROUND_ENRICHMENT_KEYS.reduce<Record<string, unknown>>((acc, key) => {
      const value = previous[key];
      if (value !== undefined && value !== null) acc[key] = value;
      return acc;
    }, {});
    return { ...round, ...enrichment };
  });
  const upcomingRound = next.upcomingRound
    ? rounds.find((round) => round.id === next.upcomingRound?.id) ?? next.upcomingRound
    : null;
  return {
    ...next,
    hero: {
      ...next.hero,
      rounds,
      weatherText: rounds[0]?.weatherText ?? next.hero.weatherText,
      temperature: rounds[0]?.temperature ?? next.hero.temperature,
    },
    upcomingRound,
  };
}

export function useHomeDashboard({
  clubId,
  userName,
  userId,
  homeLatitude,
  homeLongitude,
  departureBufferMinutes,
}: UseHomeDashboardParams): HomeDashboardState {
  const [dashboard, setDashboard] = useState<HomeDashboard>(() =>
    createEmptyHomeDashboard(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partialRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawRef = useRef<Awaited<ReturnType<typeof getHomeDashboardBase>>["raw"]>(null);
  const partialRefreshRunningRef = useRef(false);
  const partialRefreshQueuedRef = useRef(false);
  const realtimeChannelIdRef = useRef<string | null>(null);

  if (!realtimeChannelIdRef.current) {
    realtimeChannelIdRef.current = createHomeDashboardChannelId();
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    getHomeDashboardBase(clubId, userName, userId, {
      forceRefresh: refreshKey > 0,
    })
      .then(({ dashboard: baseDashboard, raw }) => {
        if (!mounted) return;

        // 일정·기록 등 기본 데이터가 준비되는 즉시 홈을 먼저 표시한다.
        rawRef.current = raw;
        setDashboard(baseDashboard);
        setLoading(false);

        if (!raw) return;

        // 날씨, 이동시간, AI 캐디는 서로 기다리지 않고 독립적으로 보강한다.
        void getHomeWeatherDashboard(raw, userName, userId)
          .then((weatherDashboard) => {
            if (mounted)
              setDashboard((current) =>
                mergeHomeWeather(current, weatherDashboard),
              );
          })
          .catch(() => undefined);

        void getHomeTravelUpdates(
          raw,
          baseDashboard,
          { latitude: homeLatitude, longitude: homeLongitude },
          departureBufferMinutes,
        )
          .then((updates) => {
            if (mounted)
              setDashboard((current) => mergeHomeTravel(current, updates));
          })
          .catch(() => undefined);

        void getHomeAiCaddieUpdate(baseDashboard, userId)
          .then((update) => {
            if (mounted)
              setDashboard((current) => mergeHomeAiCaddie(current, update));
          })
          .catch(() => undefined);
      })
      .catch((nextError) => {
        if (!mounted) return;
        setError(errorMessage(nextError));
        setDashboard(createEmptyHomeDashboard());
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    clubId,
    userName,
    userId,
    homeLatitude,
    homeLongitude,
    departureBufferMinutes,
    refreshKey,
  ]);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const queueRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      refresh();
    }, 700);
  }, [refresh]);

  const runPartialRefresh = useCallback(async () => {
    const raw = rawRef.current;
    if (!clubId || !raw) {
      refresh();
      return;
    }
    if (partialRefreshRunningRef.current) {
      partialRefreshQueuedRef.current = true;
      return;
    }

    partialRefreshRunningRef.current = true;
    try {
      const result = await refreshHomeRoundState(raw, clubId, userName, userId);
      rawRef.current = result.raw;
      setDashboard((current) => preserveRoundEnrichment(current, result.dashboard));
    } catch {
      // 부분 갱신 실패 시 다음 명시적 새로고침에서 전체 데이터를 복구한다.
    } finally {
      partialRefreshRunningRef.current = false;
      if (partialRefreshQueuedRef.current) {
        partialRefreshQueuedRef.current = false;
        void runPartialRefresh();
      }
    }
  }, [clubId, refresh, userId, userName]);

  const queuePartialRefresh = useCallback(() => {
    if (partialRefreshTimerRef.current) clearTimeout(partialRefreshTimerRef.current);
    partialRefreshTimerRef.current = setTimeout(() => {
      partialRefreshTimerRef.current = null;
      void runPartialRefresh();
    }, 500);
  }, [runPartialRefresh]);

  useEffect(() => {
    if (!clubId) return;

    // 한 번의 일정 저장 과정에서 일정/조/조원 이벤트가 연속 발생하므로
    // 현재 클럽 이벤트만 구독하고 400ms 동안 하나의 새로고침으로 합친다.
    const channel = supabase
      .channel(`home-dashboard:${clubId}:${realtimeChannelIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_round_schedules",
          filter: `club_id=eq.${clubId}`,
        },
        queueRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_round_groups",
          filter: `club_id=eq.${clubId}`,
        },
        queuePartialRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_round_group_members",
          filter: `club_id=eq.${clubId}`,
        },
        queuePartialRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_round_attendances",
          filter: `club_id=eq.${clubId}`,
        },
        queuePartialRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (partialRefreshTimerRef.current) {
        clearTimeout(partialRefreshTimerRef.current);
        partialRefreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [clubId, queuePartialRefresh, queueRefresh]);

  useEffect(() => {
    return subscribeHomeDashboardChanged((changedClubId) => {
      if (!changedClubId || changedClubId === clubId) queueRefresh();
    });
  }, [clubId, queuePartialRefresh, queueRefresh]);

  return useMemo(
    () => ({ dashboard, loading, error, refresh }),
    [dashboard, loading, error, refresh],
  );
}
