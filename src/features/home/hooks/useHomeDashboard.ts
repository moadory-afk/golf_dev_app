import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getHomeAiCaddieUpdate,
  getHomeDashboardBase,
  getHomeTravelUpdates,
  getHomeWeatherDashboard,
  mergeHomeAiCaddie,
  mergeHomeTravel,
  mergeHomeWeather,
} from "../services/homeService";
import { createEmptyHomeDashboard } from "../mappers/homeMapper";
import type { HomeDashboard, HomeDashboardState } from "../types/home";
import { supabase } from "../../../lib/supabase";
import { subscribeHomeDashboardChanged } from "../../../lib/homeDashboardEvents";

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
    }, 400);
  }, [refresh]);

  useEffect(() => {
    if (!clubId) return;

    // 한 번의 일정 저장 과정에서 일정/조/조원 이벤트가 연속 발생하므로
    // 현재 클럽 이벤트만 구독하고 400ms 동안 하나의 새로고침으로 합친다.
    const channel = supabase
      .channel(`home-dashboard:${clubId}`)
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
        queueRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_round_group_members",
          filter: `club_id=eq.${clubId}`,
        },
        queueRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [clubId, queueRefresh]);

  useEffect(() => {
    return subscribeHomeDashboardChanged((changedClubId) => {
      if (!changedClubId || changedClubId === clubId) queueRefresh();
    });
  }, [clubId, queueRefresh]);

  return useMemo(
    () => ({ dashboard, loading, error, refresh }),
    [dashboard, loading, error, refresh],
  );
}
