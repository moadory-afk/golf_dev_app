import { supabase } from "../../../lib/supabase";
import type { PlayerScore, SavedRound } from "../../../lib/store";
import {
  getOpenWeatherForRound,
  type RoundWeather,
} from "../../../lib/weather";
import { getCachedAsync } from "../../../lib/asyncCache";
import type { HomeAttendanceStatus, HomeRoundStatus, HomeWeatherHour } from "../types/home";

type HomeRoundSummaryRow = {
  id: string;
  date: string;
  course_name: string;
  pars?: number[] | null;
  players?: PlayerScore[] | null;
  is_complete?: boolean | null;
  schedule_id?: string | null;
};

function mapHomeRoundSummary(row: HomeRoundSummaryRow): SavedRound {
  return {
    id: row.id,
    date: row.date,
    courseName: row.course_name,
    pars: row.pars ?? [],
    shinperioHoles: [],
    players: row.players ?? [],
    photoData: [],
    isComplete: row.is_complete ?? false,
    scheduleId: row.schedule_id ?? undefined,
  };
}

/**
 * Home 통계에 필요한 최소 필드만 조회한다.
 * photo_data, settlement, handicaps, hole_labels 등 상세 화면 전용 대용량 필드는 제외한다.
 * 홈 첫 화면에서 쓰는 최근 통계 범위만 가져와 클럽 기록이 쌓여도 진입 속도가 급격히 느려지지 않게 한다.
 */
const HOME_ROUND_SUMMARY_LIMIT = 40;

async function getHomeRoundSummaries(clubId: string): Promise<SavedRound[]> {
  const { data, error } = await supabase
    .from("rounds")
    .select("id, date, course_name, pars, players, is_complete, schedule_id")
    .eq("club_id", clubId)
    .order("date", { ascending: false })
    .limit(HOME_ROUND_SUMMARY_LIMIT);

  if (error) throw error;
  return ((data ?? []) as HomeRoundSummaryRow[]).map(mapHomeRoundSummary);
}

export type HomeScheduleRow = {
  id: string;
  round_date: string;
  course_id?: string | null;
  course_name?: string | null;
  layout_id?: string | null;
  layout_name?: string | null;
  tee_time?: string | null;
  note?: string | null;
  status?: HomeRoundStatus | null;
  created_at?: string | null;
  updated_at?: string | null;
  award_config?: { count?: number; items?: string[] } | null;
};

export type HomeScheduleGroupRow = {
  id: string;
  schedule_id: string;
  group_no: number;
  group_name?: string | null;
  tee_time?: string | null;
  front_layout_name?: string | null;
  back_layout_name?: string | null;
};

export type HomeScheduleGroupMemberRow = {
  group_id: string;
  schedule_id: string;
  member_user_id: string;
  member_name: string;
};


export type HomeAttendanceRow = {
  schedule_id: string;
  member_user_id: string;
  status: string;
};

function mapAttendanceStatus(status?: string | null): HomeAttendanceStatus {
  if (status === "attending") return "참석";
  if (status === "absent") return "불참";
  return "미정";
}

export type HomeCourseRow = {
  id: string;
  name: string;
  region: string;
  latitude?: number | null;
  longitude?: number | null;
  hero_image_url?: string | null;
  hero_image_source?: string | null;
};

export type HomeLayoutRow = {
  id: string;
  golf_course_id: string;
  name: string;
};

export type HomeCourseSeasonImageRow = {
  golf_course_id: string;
  season: "spring" | "summer" | "autumn" | "winter";
  image_url: string;
  image_source?: string | null;
  is_active?: boolean | null;
};

export type HomeWeatherSnapshot = {
  temperature: string;
  weatherText: string;
  windText: string;
  fiveHourSummary?: string;
  fiveHourDetail?: string;
  fiveHourHours?: HomeWeatherHour[];
  openWeatherHours?: HomeWeatherHour[];
  kmaIssuedAt?: string;
  fetchedAt?: string;
};

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => !!value)),
  );
}

export type HomeDashboardRawData = {
  schedules: HomeScheduleRow[];
  groups: HomeScheduleGroupRow[];
  members: HomeScheduleGroupMemberRow[];
  attendances: Array<{ scheduleId: string; userId: string; status: HomeAttendanceStatus }>;
  courses: HomeCourseRow[];
  courseSeasonImages: HomeCourseSeasonImageRow[];
  layouts: HomeLayoutRow[];
  rounds: SavedRound[];
  weatherByCourseId: Record<string, HomeWeatherSnapshot>;
  weatherByScheduleId: Record<string, HomeWeatherSnapshot>;
  lottoEntries: Array<{ scheduleId: string; userId: string }>;
  lottoDraws: Array<{ scheduleId: string; drafterUserId: string | null; drawStatus: 'PENDING' | 'COMPLETED' }>;
  currentUserId?: string | null;
};

function weatherSnapshotFromRoundWeather(
  weather: RoundWeather | null,
): HomeWeatherSnapshot | null {
  if (!weather) return null;

  return {
    temperature: `${Math.round(weather.tempC)}°`,
    weatherText: weather.condition || "날씨 준비중",
    windText:
      typeof weather.windMs === "number"
        ? `${Math.round(weather.windMs)}m/s`
        : "풍속 준비중",
    fiveHourSummary: weather.fiveHourSummary,
    fiveHourDetail: weather.fiveHourDetail,
    fiveHourHours: weather.hourlyForecast?.map((item) => ({
      time: item.time,
      icon: item.icon,
      condition: item.condition,
      tempC: item.tempC,
      pop: item.pop,
      windMs: item.windMs,
    })),
    openWeatherHours: weather.openWeatherHourlyForecast?.map((item) => ({
      time: item.time,
      icon: item.icon,
      condition: item.condition,
      tempC: item.tempC,
      pop: item.pop,
      windMs: item.windMs,
    })),
    kmaIssuedAt: weather.kmaIssuedAt,
    fetchedAt: weather.fetchedAt,
  };
}

async function fetchWeatherForSchedule(
  schedule: HomeScheduleRow,
  course: HomeCourseRow,
): Promise<HomeWeatherSnapshot | null> {
  try {
    const weather = await getOpenWeatherForRound({
      roundId: schedule.id,
      courseName: course.name,
      region: course.region,
      latitude: course.latitude,
      longitude: course.longitude,
      date: schedule.round_date,
      time: schedule.tee_time ?? undefined,
    });

    return weatherSnapshotFromRoundWeather(weather);
  } catch {
    return null;
  }
}

export async function fetchWeatherByScheduleId(
  schedules: HomeScheduleRow[],
  courses: HomeCourseRow[],
) {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const entries = await Promise.all(
    schedules.map(async (schedule) => {
      const course = schedule.course_id
        ? courseById.get(schedule.course_id)
        : undefined;
      if (!course) return [schedule.id, null] as const;
      return [
        schedule.id,
        await fetchWeatherForSchedule(schedule, course),
      ] as const;
    }),
  );

  return entries.reduce<Record<string, HomeWeatherSnapshot>>(
    (acc, [scheduleId, weather]) => {
      if (weather) acc[scheduleId] = weather;
      return acc;
    },
    {},
  );
}

export function buildWeatherByCourseId(
  schedules: HomeScheduleRow[],
  weatherByScheduleId: Record<string, HomeWeatherSnapshot>,
) {
  return schedules.reduce<Record<string, HomeWeatherSnapshot>>(
    (acc, schedule) => {
      const courseId = schedule.course_id;
      const weather = weatherByScheduleId[schedule.id];
      if (courseId && weather && !acc[courseId]) acc[courseId] = weather;
      return acc;
    },
    {},
  );
}

async function fetchHomeCourses(courseIds: string[]) {
  if (!courseIds.length) return { data: [] as HomeCourseRow[], error: null };

  const extendedResult = await supabase
    .from("golf_courses")
    .select(
      "id, name, region, latitude, longitude, hero_image_url, hero_image_source",
    )
    .in("id", courseIds);

  if (!extendedResult.error) return extendedResult;

  // 좌표 컬럼 마이그레이션 전 환경에서도 Home 전체가 깨지지 않도록 기존 컬럼만 fallback 조회한다.
  return supabase
    .from("golf_courses")
    .select("id, name, region")
    .in("id", courseIds);
}

async function fetchCourseSeasonImages(courseIds: string[]) {
  if (!courseIds.length)
    return { data: [] as HomeCourseSeasonImageRow[], error: null };

  return supabase
    .from("golf_course_season_images")
    .select("golf_course_id, season, image_url, image_source, is_active")
    .in("golf_course_id", courseIds)
    .eq("is_active", true);
}

const HOME_RAW_CACHE_TTL_MS = 60_000;

async function fetchHomeDashboardRawData(
  clubId: string,
  userId?: string | null,
): Promise<HomeDashboardRawData> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: schedules, error: scheduleError } = await supabase
    .from("club_round_schedules")
    .select(
      "id, round_date, course_id, course_name, layout_id, layout_name, tee_time, note, status, award_config, created_at, updated_at",
    )
    .eq("club_id", clubId)
    .gte("round_date", today)
    .in("status", ["planned", "recruiting", "closed", "finished"])
    .order("round_date", { ascending: true })
    .order("tee_time", { ascending: true })
    .limit(5);

  if (scheduleError) throw scheduleError;

  const scheduleRows = (schedules ?? []) as HomeScheduleRow[];
  const scheduleIds = scheduleRows.map((schedule) => schedule.id);
  const courseIds = uniqueValues(
    scheduleRows.map((schedule) => schedule.course_id),
  );
  const layoutIds = uniqueValues(
    scheduleRows.map((schedule) => schedule.layout_id),
  );

  const [
    groupResult,
    memberResult,
    attendanceResult,
    courseResult,
    seasonImageResult,
    layoutResult,
    rounds,
    lottoEntryResult,
    lottoDrawResult,
  ] = await Promise.all([
    scheduleIds.length
      ? supabase
          .from("club_round_groups")
          .select(
            "id, schedule_id, group_no, group_name, tee_time, front_layout_name, back_layout_name",
          )
          .in("schedule_id", scheduleIds)
          .order("group_no", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    scheduleIds.length
      ? supabase
          .from("club_round_group_members")
          .select("group_id, schedule_id, member_user_id, member_name")
          .in("schedule_id", scheduleIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    scheduleIds.length
      ? supabase
          .from("club_round_attendances")
          .select("schedule_id, member_user_id, status")
          .in("schedule_id", scheduleIds)
      : Promise.resolve({ data: [], error: null }),
    fetchHomeCourses(courseIds),
    fetchCourseSeasonImages(courseIds),
    layoutIds.length
      ? supabase
          .from("course_layouts")
          .select("id, golf_course_id, name")
          .in("id", layoutIds)
      : Promise.resolve({ data: [], error: null }),
    getHomeRoundSummaries(clubId),
    scheduleIds.length && userId
      ? supabase.from("round_lotto_entries").select("schedule_id, user_id").in("schedule_id", scheduleIds).eq("user_id", userId)
      : Promise.resolve({ data: [], error: null }),
    scheduleIds.length
      ? supabase.from("round_lotto_draws").select("schedule_id, drafter_user_id, draw_status").in("schedule_id", scheduleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (groupResult.error) throw groupResult.error;
  if (memberResult.error) throw memberResult.error;
  if (attendanceResult.error) throw attendanceResult.error;
  if (courseResult.error) throw courseResult.error;
  if (seasonImageResult.error) throw seasonImageResult.error;
  if (layoutResult.error) throw layoutResult.error;
  if (lottoEntryResult.error) throw lottoEntryResult.error;
  if (lottoDrawResult.error) throw lottoDrawResult.error;

  const courseRows = (courseResult.data ?? []) as HomeCourseRow[];

  return {
    schedules: scheduleRows,
    groups: (groupResult.data ?? []) as HomeScheduleGroupRow[],
    members: (memberResult.data ?? []) as HomeScheduleGroupMemberRow[],
    attendances: ((attendanceResult.data ?? []) as HomeAttendanceRow[]).map((row) => ({
      scheduleId: row.schedule_id,
      userId: row.member_user_id,
      status: mapAttendanceStatus(row.status),
    })),
    courses: courseRows,
    courseSeasonImages: (seasonImageResult.data ??
      []) as HomeCourseSeasonImageRow[],
    layouts: (layoutResult.data ?? []) as HomeLayoutRow[],
    rounds,
    // 날씨는 홈 기본 화면을 먼저 표시한 뒤 useHomeDashboard에서 비동기로 보강한다.
    weatherByCourseId: {},
    weatherByScheduleId: {},
    lottoEntries: ((lottoEntryResult.data ?? []) as Array<{ schedule_id: string; user_id: string }>).map((row) => ({ scheduleId: row.schedule_id, userId: row.user_id })),
    lottoDraws: ((lottoDrawResult.data ?? []) as Array<{ schedule_id: string; drafter_user_id?: string | null; draw_status?: string | null }>).map((row) => ({ scheduleId: row.schedule_id, drafterUserId: row.drafter_user_id ?? null, drawStatus: row.draw_status === "COMPLETED" ? "COMPLETED" : "PENDING" })),
    currentUserId: userId ?? null,
  };
}


export type HomeRoundStateData = Pick<
  HomeDashboardRawData,
  "groups" | "members" | "attendances" | "lottoEntries" | "lottoDraws"
>;

/**
 * 실시간 참석/조 편성 변경 시 홈 전체 원본을 다시 읽지 않고
 * 현재 표시 중인 일정의 동적 상태만 갱신한다.
 */
export async function fetchHomeRoundStateData(
  clubId: string,
  scheduleIds: string[],
  userId?: string | null,
): Promise<HomeRoundStateData> {
  if (!scheduleIds.length) {
    return { groups: [], members: [], attendances: [], lottoEntries: [], lottoDraws: [] };
  }

  const [groupResult, memberResult, attendanceResult, lottoEntryResult, lottoDrawResult] =
    await Promise.all([
      supabase
        .from("club_round_groups")
        .select("id, schedule_id, group_no, group_name, tee_time, front_layout_name, back_layout_name")
        .eq("club_id", clubId)
        .in("schedule_id", scheduleIds)
        .order("group_no", { ascending: true }),
      supabase
        .from("club_round_group_members")
        .select("group_id, schedule_id, member_user_id, member_name")
        .eq("club_id", clubId)
        .in("schedule_id", scheduleIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("club_round_attendances")
        .select("schedule_id, member_user_id, status")
        .eq("club_id", clubId)
        .in("schedule_id", scheduleIds),
      userId
        ? supabase
            .from("round_lotto_entries")
            .select("schedule_id, user_id")
            .in("schedule_id", scheduleIds)
            .eq("user_id", userId)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("round_lotto_draws")
        .select("schedule_id, drafter_user_id, draw_status")
        .in("schedule_id", scheduleIds),
    ]);

  if (groupResult.error) throw groupResult.error;
  if (memberResult.error) throw memberResult.error;
  if (attendanceResult.error) throw attendanceResult.error;
  if (lottoEntryResult.error) throw lottoEntryResult.error;
  if (lottoDrawResult.error) throw lottoDrawResult.error;

  return {
    groups: (groupResult.data ?? []) as HomeScheduleGroupRow[],
    members: (memberResult.data ?? []) as HomeScheduleGroupMemberRow[],
    attendances: ((attendanceResult.data ?? []) as HomeAttendanceRow[]).map((row) => ({
      scheduleId: row.schedule_id,
      userId: row.member_user_id,
      status: mapAttendanceStatus(row.status),
    })),
    lottoEntries: ((lottoEntryResult.data ?? []) as Array<{ schedule_id: string; user_id: string }>).map(
      (row) => ({ scheduleId: row.schedule_id, userId: row.user_id }),
    ),
    lottoDraws: ((lottoDrawResult.data ?? []) as Array<{
      schedule_id: string;
      drafter_user_id?: string | null;
      draw_status?: string | null;
    }>).map((row) => ({
      scheduleId: row.schedule_id,
      drafterUserId: row.drafter_user_id ?? null,
      drawStatus: row.draw_status === "COMPLETED" ? "COMPLETED" : "PENDING",
    })),
  };
}

export function getHomeDashboardRawData(
  clubId: string,
  userId?: string | null,
  options: { forceRefresh?: boolean } = {},
): Promise<HomeDashboardRawData> {
  return getCachedAsync(
    `home-raw:${clubId}:${userId ?? "anonymous"}`,
    HOME_RAW_CACHE_TTL_MS,
    () => fetchHomeDashboardRawData(clubId, userId),
    { forceRefresh: options.forceRefresh },
  );
}
