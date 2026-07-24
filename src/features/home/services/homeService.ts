import {
  createEmptyHomeDashboard,
  mapHomeDashboard,
} from "../mappers/homeMapper";
import type {
  HomeDashboard,
  HomeHeroRound,
  HomeUpcomingRound,
} from "../types/home";
import { getHomeAICaddiePreview } from "../../caddie/services/caddieService";
import {
  buildWeatherByCourseId,
  fetchWeatherByScheduleId,
  fetchHomeRoundStateData,
  getHomeDashboardRawData,
  type HomeDashboardRawData,
} from "../api/homeRepository";
import { buildRoundFeedEvents, selectPrimaryHomeFeedEvent } from "../engine/homeFeedEngine";
import {
  formatRecommendedDepartureTime,
  formatTravelMinutes,
  getProviderDrivingTravelTimeMinutes,
} from "../../../lib/travelTime";

type HomeCoordinate = {
  latitude?: number | null;
  longitude?: number | null;
};

export type HomeDashboardBaseResult = {
  dashboard: HomeDashboard;
  raw: HomeDashboardRawData | null;
};

type TravelRoundUpdate = Pick<
  HomeHeroRound,
  "id" | "routeTimeText" | "routeTimeByProvider" | "departureTimeText"
>;

type AiCaddieUpdate = Partial<HomeDashboard["aiCaddie"]>;

export async function getHomeDashboardBase(
  clubId?: string | null,
  userName?: string | null,
  userId?: string | null,
  options: { forceRefresh?: boolean } = {},
): Promise<HomeDashboardBaseResult> {
  if (!clubId) return { dashboard: createEmptyHomeDashboard(), raw: null };

  const raw = await getHomeDashboardRawData(clubId, userId, options);
  return {
    dashboard: mapHomeDashboard(raw, userName, userId),
    raw,
  };
}


export async function refreshHomeRoundState(
  raw: HomeDashboardRawData,
  clubId: string,
  userName?: string | null,
  userId?: string | null,
): Promise<HomeDashboardBaseResult> {
  const state = await fetchHomeRoundStateData(
    clubId,
    raw.schedules.map((schedule) => schedule.id),
    userId,
  );
  const nextRaw: HomeDashboardRawData = { ...raw, ...state };
  return { dashboard: mapHomeDashboard(nextRaw, userName, userId), raw: nextRaw };
}

export async function getHomeWeatherDashboard(
  raw: HomeDashboardRawData,
  userName?: string | null,
  userId?: string | null,
): Promise<HomeDashboard> {
  // 홈 최초 진입에서는 가장 가까운 일정의 날씨만 우선 조회한다.
  // 나머지 일정은 기본 카드 정보를 먼저 표시해 초기 네트워크 부하를 줄인다.
  const initialWeatherSchedules = raw.schedules.slice(0, 1);
  const weatherByScheduleId = await fetchWeatherByScheduleId(
    initialWeatherSchedules,
    raw.courses,
  );
  const weatherRaw: HomeDashboardRawData = {
    ...raw,
    weatherByScheduleId,
    weatherByCourseId: buildWeatherByCourseId(
      raw.schedules,
      weatherByScheduleId,
    ),
  };

  return mapHomeDashboard(weatherRaw, userName, userId);
}

export function mergeHomeWeather(
  current: HomeDashboard,
  weatherDashboard: HomeDashboard,
): HomeDashboard {
  const weatherRoundById = new Map(
    weatherDashboard.hero.rounds.map((round) => [round.id, round]),
  );
  const rounds = current.hero.rounds.map((round) => {
    const weatherRound = weatherRoundById.get(round.id);
    if (!weatherRound) return round;
    return {
      ...round,
      weatherText: weatherRound.weatherText,
      temperature: weatherRound.temperature,
      windText: weatherRound.windText,
      fiveHourWeatherSummary: weatherRound.fiveHourWeatherSummary,
      fiveHourWeatherDetail: weatherRound.fiveHourWeatherDetail,
      fiveHourWeatherHours: weatherRound.fiveHourWeatherHours,
      openWeatherHours: weatherRound.openWeatherHours,
      kmaIssuedAt: weatherRound.kmaIssuedAt,
    };
  });

  const firstRound = rounds[0];
  const upcomingRound: HomeUpcomingRound | null =
    current.upcomingRound && firstRound?.id === current.upcomingRound.id
      ? {
          ...current.upcomingRound,
          weatherText: firstRound.weatherText,
          temperature: firstRound.temperature,
          windText: firstRound.windText,
          fiveHourWeatherSummary: firstRound.fiveHourWeatherSummary,
          fiveHourWeatherDetail: firstRound.fiveHourWeatherDetail,
          fiveHourWeatherHours: firstRound.fiveHourWeatherHours,
          openWeatherHours: firstRound.openWeatherHours,
          kmaIssuedAt: firstRound.kmaIssuedAt,
        }
      : current.upcomingRound;

  const feedEventsByRoundId = rounds.reduce<Record<string, ReturnType<typeof buildRoundFeedEvents>>>((acc, round) => {
    acc[round.id] = buildRoundFeedEvents(round, current.stats.recentRounds);
    return acc;
  }, {});
  const feedEvents = upcomingRound
    ? (feedEventsByRoundId[upcomingRound.id] ?? buildRoundFeedEvents(upcomingRound, current.stats.recentRounds))
    : current.feedEvents;

  return {
    ...current,
    hero: {
      ...current.hero,
      weatherText: firstRound?.weatherText ?? current.hero.weatherText,
      temperature: firstRound?.temperature ?? current.hero.temperature,
      rounds,
    },
    upcomingRound,
    feedEventsByRoundId,
    feedEvents,
    feed: selectPrimaryHomeFeedEvent(feedEvents),
  };
}

export async function getHomeTravelUpdates(
  raw: HomeDashboardRawData,
  dashboard: HomeDashboard,
  home?: HomeCoordinate | null,
  departureBufferMinutes = 40,
): Promise<TravelRoundUpdate[]> {
  if (typeof home?.latitude !== "number" || typeof home.longitude !== "number")
    return [];

  const roundById = new Map(
    dashboard.hero.rounds.map((round) => [round.id, round]),
  );
  const courseById = new Map(raw.courses.map((course) => [course.id, course]));

  return Promise.all(
    raw.schedules.map(async (schedule) => {
      const course = schedule.course_id
        ? courseById.get(schedule.course_id)
        : undefined;
      const providerMinutes = await getProviderDrivingTravelTimeMinutes(home, {
        latitude: course?.clubhouse_latitude ?? course?.latitude,
        longitude: course?.clubhouse_longitude ?? course?.longitude,
      }).catch(() => null);
      const primaryMinutes = providerMinutes?.kakao
        ?? providerMinutes?.tmap
        ?? providerMinutes?.naver
        ?? null;

      if (!primaryMinutes) {
        return {
          id: schedule.id,
          routeTimeText: "이동시간 준비중",
          routeTimeByProvider: {
            kakao: "예상 준비중",
            tmap: "예상 준비중",
            naver: "예상 준비중",
          },
          departureTimeText: "출발 추천 준비중",
        };
      }

      return {
        id: schedule.id,
        routeTimeText: formatTravelMinutes(primaryMinutes),
        routeTimeByProvider: {
          kakao: providerMinutes?.kakao ? `예상 ${formatTravelMinutes(providerMinutes.kakao).replace(/\s*소요$/, "")}` : "예상 준비중",
          tmap: providerMinutes?.tmap ? `예상 ${formatTravelMinutes(providerMinutes.tmap).replace(/\s*소요$/, "")}` : "예상 준비중",
          naver: providerMinutes?.naver ? `예상 ${formatTravelMinutes(providerMinutes.naver).replace(/\s*소요$/, "")}` : "예상 준비중",
        },
        departureTimeText: formatRecommendedDepartureTime(
          schedule.round_date,
          roundById.get(schedule.id)?.teeTime ?? schedule.tee_time ?? undefined,
          primaryMinutes,
          departureBufferMinutes,
        ),
      };
    }),
  );
}

export function mergeHomeTravel(
  current: HomeDashboard,
  updates: TravelRoundUpdate[],
): HomeDashboard {
  if (!updates.length) return current;
  const updateById = new Map(updates.map((update) => [update.id, update]));
  const rounds = current.hero.rounds.map((round) => {
    const update = updateById.get(round.id);
    return update ? { ...round, ...update } : round;
  });

  return {
    ...current,
    hero: {
      ...current.hero,
      rounds,
    },
  };
}

export async function getHomeAiCaddieUpdate(
  dashboard: HomeDashboard,
  userId?: string | null,
): Promise<AiCaddieUpdate | null> {
  const upcomingRound = dashboard.upcomingRound;
  const aiPreview = await getHomeAICaddiePreview({
    userId,
    courseId: upcomingRound?.courseId,
    layoutId: upcomingRound?.layoutId,
    holeNo: 1,
    courseName: upcomingRound?.courseName,
    teeTime: upcomingRound?.teeTime,
    dday: upcomingRound?.dday,
    fallbackAverageScore: dashboard.stats.averageScore,
  });

  if (!aiPreview) return null;

  return {
    title: aiPreview.title,
    message: aiPreview.message,
    primaryChip: aiPreview.primaryChip,
    secondaryChip: aiPreview.secondaryChip,
    hasLiveAdvice: aiPreview.hasLiveAdvice,
    recommendedClub: aiPreview.recommendedClub,
    riskLabel: aiPreview.riskLabel,
  };
}

export function mergeHomeAiCaddie(
  current: HomeDashboard,
  update: AiCaddieUpdate | null,
): HomeDashboard {
  if (!update) return current;
  return {
    ...current,
    aiCaddie: {
      ...current.aiCaddie,
      ...update,
    },
  };
}

// 기존 호출부와의 호환성을 유지한다. 신규 홈 hook은 getHomeDashboardBase와 보강 함수를 사용한다.
export async function getHomeDashboard(
  clubId?: string | null,
  userName?: string | null,
  userId?: string | null,
  home?: HomeCoordinate | null,
  departureBufferMinutes = 40,
): Promise<HomeDashboard> {
  const { dashboard, raw } = await getHomeDashboardBase(
    clubId,
    userName,
    userId,
  );
  if (!raw) return dashboard;

  const [weatherDashboard, travelUpdates, aiUpdate] = await Promise.all([
    getHomeWeatherDashboard(raw, userName, userId).catch(() => null),
    getHomeTravelUpdates(raw, dashboard, home, departureBufferMinutes).catch(
      () => [],
    ),
    getHomeAiCaddieUpdate(dashboard, userId).catch(() => null),
  ]);

  let nextDashboard = dashboard;
  if (weatherDashboard)
    nextDashboard = mergeHomeWeather(nextDashboard, weatherDashboard);
  nextDashboard = mergeHomeTravel(nextDashboard, travelUpdates);
  return mergeHomeAiCaddie(nextDashboard, aiUpdate);
}
