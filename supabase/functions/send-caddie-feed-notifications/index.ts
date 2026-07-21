import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ScheduleRow = {
  id: string;
  club_id: string;
  round_date: string;
  course_id?: string | null;
  course_name?: string | null;
  layout_id?: string | null;
  layout_name?: string | null;
  tee_time?: string | null;
  status?: string | null;
  award_config?: { count?: number; items?: string[] } | null;
};

type GroupRow = {
  id: string;
  schedule_id: string;
  tee_time?: string | null;
  front_layout_name?: string | null;
  back_layout_name?: string | null;
};

type GroupMemberRow = {
  schedule_id: string;
  member_user_id: string;
  member_name: string;
};

type AttendanceRow = {
  schedule_id: string;
  member_user_id: string;
  status: string;
};

type ClubMemberRow = {
  club_id: string;
  user_id: string;
};

type ClubRow = {
  id: string;
  name: string | null;
};

type RoundRow = {
  id: string;
  date: string;
  schedule_id?: string | null;
  is_complete?: boolean | null;
};

type LottoEntryRow = {
  schedule_id: string;
  user_id: string;
};

type LottoDrawRow = {
  schedule_id: string;
  drafter_user_id?: string | null;
  draw_status?: string | null;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  club_id: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  updated_at?: string | null;
  last_seen_at?: string | null;
};

type CaddieFeedNotification = {
  eventId: string;
  type: string;
  title: string;
  body: string;
  priority: number;
  clubId: string;
  scheduleId?: string;
  userIds: string[];
  data: Record<string, unknown>;
};

type WebhookRecord = {
  id?: string | null;
  club_id?: string | null;
  schedule_id?: string | null;
};

type RequestBody = {
  clubId?: string;
  scheduleId?: string;
  scheduleIds?: string[];
  dryRun?: boolean;
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  record?: WebhookRecord | null;
  old_record?: WebhookRecord | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorMessageFromUnknown(value: unknown): string {
  if (!value) return "알 수 없는 오류";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (typeof value === "object") {
    const item = value as { error?: unknown; message?: unknown; msg?: unknown; details?: unknown };
    const nested = item.error ?? item.message ?? item.msg ?? item.details;
    if (nested && nested !== value) return errorMessageFromUnknown(nested);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function getSupabaseSecretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.service_role ?? Object.values(parsed)[0] ?? null;
  } catch {
    return null;
  }
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dday(dateText: string) {
  const today = new Date(`${dayKey()}T00:00:00+09:00`);
  const target = new Date(`${dateText.slice(0, 10)}T00:00:00+09:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function roundStartAt(schedule: ScheduleRow, groups: GroupRow[]) {
  const time = groups.find((group) => group.schedule_id === schedule.id && group.tee_time?.trim())?.tee_time
    ?? schedule.tee_time;
  const match = time?.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const date = new Date(`${schedule.round_date.slice(0, 10)}T${match[1].padStart(2, "0")}:${match[2]}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function bodyText(value: string) {
  return value.replace(/\n+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function titleWithClubName(title: string, clubName?: string | null) {
  const name = clubName?.trim();
  if (!name) return title;
  const prefix = `[${name}]`;
  return title.startsWith(prefix) ? title : `${prefix} ${title}`;
}

function latestSubscriptionTimestamp(row: SubscriptionRow) {
  return row.last_seen_at ?? row.updated_at ?? "";
}

function pickLatestSubscriptionPerUser(rows: SubscriptionRow[]) {
  const latest = new Map<string, SubscriptionRow>();
  for (const row of rows) {
    const current = latest.get(row.user_id);
    if (!current || latestSubscriptionTimestamp(row) > latestSubscriptionTimestamp(current)) {
      latest.set(row.user_id, row);
    }
  }
  return [...latest.values()];
}

function memberIdsForSchedule(schedule: ScheduleRow, members: GroupMemberRow[], attendances: AttendanceRow[]) {
  const grouped = members
    .filter((member) => member.schedule_id === schedule.id)
    .map((member) => member.member_user_id);
  if (grouped.length > 0) return unique(grouped);

  return unique(attendances
    .filter((item) => item.schedule_id === schedule.id && item.status === "attending")
    .map((item) => item.member_user_id));
}

function memberIdsForClub(schedule: ScheduleRow, clubMembers: ClubMemberRow[]) {
  return unique(clubMembers
    .filter((member) => member.club_id === schedule.club_id)
    .map((member) => member.user_id));
}

function extractRequestScope(body: RequestBody) {
  const record = body.record ?? body.old_record ?? {};
  const clubId = body.clubId ?? record.club_id ?? undefined;
  const explicitScheduleIds = [
    body.scheduleId,
    ...(body.scheduleIds ?? []),
  ];
  const recordScheduleId = body.table === "club_round_schedules"
    ? record.id
    : record.schedule_id;
  const scheduleIds = unique([
    ...explicitScheduleIds,
    recordScheduleId ?? undefined,
  ].filter((value): value is string => Boolean(value)));

  return { clubId, scheduleIds };
}

function notification(
  schedule: ScheduleRow,
  userIds: string[],
  params: Omit<CaddieFeedNotification, "clubId" | "scheduleId" | "userIds" | "data"> & { data?: Record<string, unknown> },
): CaddieFeedNotification {
  return {
    ...params,
    clubId: schedule.club_id,
    scheduleId: schedule.id,
    userIds,
    data: {
      type: "caddie",
      feedEventId: params.eventId,
      feedType: params.type,
      clubId: schedule.club_id,
      scheduleId: schedule.id,
      courseId: schedule.course_id,
      ...(params.data ?? {}),
    },
  };
}

function buildFeedNotifications(params: {
  schedules: ScheduleRow[];
  groups: GroupRow[];
  members: GroupMemberRow[];
  attendances: AttendanceRow[];
  clubMembers: ClubMemberRow[];
  rounds: RoundRow[];
  lottoEntries: LottoEntryRow[];
  lottoDraws: LottoDrawRow[];
}) {
  const now = new Date();
  const result: CaddieFeedNotification[] = [];
  const roundsByScheduleId = new Map(params.rounds.map((round) => [round.schedule_id, round]));
  const drawsByScheduleId = new Map(params.lottoDraws.map((draw) => [draw.schedule_id, draw]));
  const purchasedBySchedule = new Map<string, Set<string>>();
  params.lottoEntries.forEach((entry) => {
    const set = purchasedBySchedule.get(entry.schedule_id) ?? new Set<string>();
    set.add(entry.user_id);
    purchasedBySchedule.set(entry.schedule_id, set);
  });

  for (const schedule of params.schedules) {
    const userIds = memberIdsForSchedule(schedule, params.members, params.attendances);
    const clubUserIds = memberIdsForClub(schedule, params.clubMembers);
    const attendanceRequestUserIds = clubUserIds.length > 0 ? clubUserIds : userIds;
    if (attendanceRequestUserIds.length === 0 && userIds.length === 0) continue;

    const roundDay = dday(schedule.round_date);
    const startAt = roundStartAt(schedule, params.groups);
    const minutesToStart = startAt ? Math.round((startAt.getTime() - now.getTime()) / 60000) : null;
    const isToday = roundDay === 0;
    const isTomorrow = roundDay === 1;
    const isSoon = roundDay >= 0 && roundDay <= 3;
    const groupingComplete = schedule.status === "closed" || schedule.status === "finished" || userIds.length > 0;
    const appearsFinished = schedule.status === "finished" || (isToday && minutesToStart !== null && minutesToStart < -300);
    const courseRegistered = !!schedule.course_id && (!!schedule.layout_id || params.groups.some((group) =>
      group.schedule_id === schedule.id && (group.front_layout_name || group.back_layout_name)
    ));
    const beforeTeeOffThirtyMinutes = !isToday || minutesToStart === null || minutesToStart >= 30;
    const withinOneHour = isToday && minutesToStart !== null && minutesToStart >= 0 && minutesToStart <= 60;
    const lottoReminderWindow = withinOneHour && minutesToStart! >= 30;
    const lottoSaleOpen = (isTomorrow || isToday) && (minutesToStart === null || minutesToStart >= 30);
    const round = roundsByScheduleId.get(schedule.id);
    const resultPublished = !!round?.is_complete || schedule.status === "finished";
    const draw = drawsByScheduleId.get(schedule.id);
    const purchased = purchasedBySchedule.get(schedule.id) ?? new Set<string>();
    const courseName = schedule.course_name ?? "라운드";

    if (!groupingComplete && !appearsFinished && attendanceRequestUserIds.length > 0) {
      result.push(notification(schedule, attendanceRequestUserIds, {
        eventId: `stage-02-attendance-${schedule.id}`,
        type: "attendance_request",
        title: "참석 여부를 확인해 주세요",
        body: `${courseName} 라운드 참석 여부를 선택하고 참가자 현황을 확인해 보세요.`,
        priority: 100,
      }));
    }

    if (userIds.length === 0) continue;

    if (groupingComplete && !appearsFinished) {
      result.push(notification(schedule, userIds, {
        eventId: `stage-03-groups-${schedule.id}`,
        type: "grouping",
        title: "조편성이 완료되었습니다",
        body: "함께 플레이할 멤버와 출발 조를 확인해 보세요.",
        priority: 88,
      }));
    }

    if (groupingComplete && courseRegistered && isSoon && beforeTeeOffThirtyMinutes && !appearsFinished) {
      result.push(notification(schedule, userIds, {
        eventId: `stage-04-caddiebook-${schedule.id}`,
        type: "round_preparation",
        title: "캐디북이 준비되었습니다",
        body: "홀별 추천 클럽과 공략 전략을 미리 확인해 보세요.",
        priority: 72,
      }));
    }

    const awardPlanReady = Number(schedule.award_config?.count ?? 0) > 0
      || (schedule.award_config?.items ?? []).some((item) => !!item?.trim());

    if (isSoon && awardPlanReady && !resultPublished) {
      result.push(notification(schedule, userIds, {
        eventId: `stage-05-award-${schedule.id}`,
        type: "award",
        title: "시상계획이 준비되었습니다",
        body: "이번 라운드의 시상 항목과 선정 기준을 확인해 보세요.",
        priority: 84,
      }));
    }

    if (lottoSaleOpen && groupingComplete && !appearsFinished) {
      const notPurchased = userIds.filter((userId) => !purchased.has(userId));
      if (notPurchased.length > 0) {
        result.push(notification(schedule, notPurchased, {
          eventId: `stage-06-lotto-${schedule.id}-open`,
          type: "lotto",
          title: "Lotto 6/18 번호를 선택해 주세요",
          body: "라운드 시작 전 행운의 번호를 선택하고 도전해 보세요.",
          priority: 78,
        }));
      }
      const purchasedUsers = userIds.filter((userId) => purchased.has(userId));
      if (purchasedUsers.length > 0) {
        result.push(notification(schedule, purchasedUsers, {
          eventId: `stage-06-lotto-${schedule.id}-purchased`,
          type: "lotto",
          title: "Lotto 6/18 구매가 완료되었습니다",
          body: "라운드 결과와 추첨 결과를 기대해 주세요.",
          priority: 63,
        }));
      }
    }

    if (lottoReminderWindow && groupingComplete && !appearsFinished) {
      const notPurchased = userIds.filter((userId) => !purchased.has(userId));
      if (notPurchased.length > 0) {
        result.push(notification(schedule, notPurchased, {
          eventId: `stage-07-lotto-reminder-${schedule.id}`,
          type: "lotto",
          title: "Lotto 6/18 구매 마감 임박",
          body: "라운드 시작 30분 전까지 번호를 선택해 주세요.",
          priority: 96,
        }));
      }
    }

    if (withinOneHour && !appearsFinished) {
      result.push(notification(schedule, userIds, {
        eventId: `stage-08-play-${schedule.id}`,
        type: "score_entry",
        title: "오늘의 라운드를 즐겨보세요",
        body: "드라이버 거리와 퍼팅 수를 입력하면 더 자세한 스코어 분석을 볼 수 있어요.",
        priority: 92,
      }));
    }

    if (resultPublished) {
      result.push(notification(schedule, userIds, {
        eventId: `stage-09-result-published-${schedule.id}`,
        type: "round_result",
        title: "라운드 결과가 공지되었습니다",
        body: "기록과 시상 결과를 확인해 보세요.",
        priority: 90,
      }));

      result.push(notification(schedule, userIds, {
        eventId: `stage-10-record-${schedule.id}`,
        type: "round_result",
        title: "새로운 기록이 반영되었습니다",
        body: "갱신된 개인 및 클럽 기록을 확인해 보세요.",
        priority: 86,
      }));
    }

    if (draw?.drafter_user_id && draw.draw_status !== "COMPLETED") {
      result.push(notification(schedule, [draw.drafter_user_id], {
        eventId: `stage-11-drafter-${schedule.id}`,
        type: "lotto",
        title: "로또 추첨자로 선정되었습니다",
        body: "추첨 버튼을 눌러 Lotto 6/18 결과를 확정해 주세요.",
        priority: 98,
      }));
    }

    if (draw?.draw_status === "COMPLETED") {
      result.push(notification(schedule, userIds, {
        eventId: `stage-12-draw-complete-${schedule.id}`,
        type: "lotto",
        title: "Lotto 6/18 추첨이 완료되었습니다",
        body: "스크래치 카드를 긁어 결과를 확인해 보세요.",
        priority: 94,
      }));
    }

    if (isSoon && !appearsFinished) {
      result.push(notification(schedule, userIds, {
        eventId: `weather-${schedule.id}`,
        type: "weather_route",
        title: "라운드 날씨를 확인해 주세요",
        body: "티오프 시간대 날씨와 바람 변화를 확인해 보세요.",
        priority: 55,
      }));
    }
  }

  return result.sort((a, b) => b.priority - a.priority);
}

async function sendOne(params: {
  supabase: ReturnType<typeof createClient>;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  item: CaddieFeedNotification;
  clubName?: string | null;
  dryRun: boolean;
}) {
  const { supabase, item, dryRun } = params;
  const notificationTitle = titleWithClubName(item.title, params.clubName);
  const stalePendingBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: existing, error: logError } = await supabase
    .from("notification_logs")
    .select("user_id, status, created_at")
    .eq("club_id", item.clubId)
    .eq("type", item.type)
    .contains("data", { feedEventId: item.eventId })
    .in("user_id", item.userIds);
  if (logError) throw logError;

  const stalePendingUserIds = (existing ?? [])
    .filter((row: { user_id?: string | null; status?: string | null; created_at?: string | null }) =>
      row.user_id
      && row.status === "pending"
      && row.created_at
      && row.created_at < stalePendingBefore
    )
    .map((row: { user_id?: string | null }) => row.user_id!);

  if (stalePendingUserIds.length > 0) {
    const { error: staleError } = await supabase
      .from("notification_logs")
      .update({
        status: "failed",
        error_message: "오래된 발송 대기 상태를 재시도 대상으로 전환했습니다.",
      })
      .eq("club_id", item.clubId)
      .eq("type", item.type)
      .contains("data", { feedEventId: item.eventId })
      .eq("status", "pending")
      .lt("created_at", stalePendingBefore)
      .in("user_id", stalePendingUserIds);
    if (staleError) throw staleError;
  }

  const alreadyHandledUserIds = new Set(
    (existing ?? [])
      .filter((row: { status?: string | null; created_at?: string | null }) =>
        row.status === "sent"
        || (row.status === "pending" && !!row.created_at && row.created_at >= stalePendingBefore)
      )
      .map((row: { user_id?: string | null }) => row.user_id)
      .filter((userId): userId is string => Boolean(userId)),
  );
  const targetUserIds = item.userIds.filter((userId) => !alreadyHandledUserIds.has(userId));
  if (targetUserIds.length === 0) return { skipped: true, sent: 0, failed: 0 };

  if (dryRun) return { skipped: false, sent: 0, failed: 0 };

  const { data: subscriptions, error } = await supabase
    .from("notification_subscriptions")
    .select("id, user_id, club_id, endpoint, p256dh, auth, updated_at, last_seen_at")
    .eq("club_id", item.clubId)
    .eq("channel", "web")
    .eq("enabled", true)
    .in("user_id", targetUserIds);
  if (error) throw error;

  webpush.setVapidDetails(params.vapidSubject, params.vapidPublicKey, params.vapidPrivateKey);
  const rows = pickLatestSubscriptionPerUser((subscriptions ?? []) as SubscriptionRow[]);
  const payload = JSON.stringify({
    title: notificationTitle,
    body: bodyText(item.body),
    data: item.data,
  });

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const { data: claim, error: claimError } = await supabase
      .from("notification_logs")
      .insert({
        club_id: item.clubId,
        user_id: row.user_id,
        type: item.type,
        title: notificationTitle,
        body: bodyText(item.body),
        data: item.data,
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (claimError) {
      if ((claimError as { code?: string }).code === "23505") continue;
      throw claimError;
    }
    if (!claim?.id) continue;

    if (!row.p256dh || !row.auth) {
      failed += 1;
      await supabase
        .from("notification_logs")
        .update({
          status: "failed",
          error_message: "웹 푸시 구독 키가 없습니다.",
        })
        .eq("id", claim.id);
      continue;
    }
    try {
      await webpush.sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }, payload);
      sent += 1;
      await supabase
        .from("notification_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", claim.id);
    } catch (error) {
      failed += 1;
      const message = errorMessageFromUnknown(error);
      await supabase
        .from("notification_logs")
        .update({
          status: "failed",
          error_message: message,
        })
        .eq("id", claim.id);

      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from("notification_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }
  }

  if (rows.length === 0) return { skipped: true, sent, failed };

  return { skipped: false, sent, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST 요청만 지원합니다." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = getSupabaseSecretKey();
    const vapidPublicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") ?? "mailto:admin@gogopar.app";
    const expectedSecret = Deno.env.get("CADDIE_FEED_NOTIFICATION_SECRET");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase 서버 환경변수가 없습니다.");
    if (!vapidPublicKey || !vapidPrivateKey) throw new Error("웹 푸시 VAPID 키가 등록되지 않았습니다.");
    if (!expectedSecret) throw new Error("자동 캐디 알림 비밀키가 등록되지 않았습니다.");
    if (req.headers.get("x-auto-notification-secret") !== expectedSecret) {
      return jsonResponse({ error: "자동 캐디 알림 호출 권한이 없습니다." }, 401);
    }

    const body = await req.json().catch(() => ({})) as RequestBody;
    const scope = extractRequestScope(body);
    const dryRun = body.dryRun === true;
    const today = dayKey();
    const scanUntil = dayKey(addDays(new Date(), 30));
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let scheduleQuery = supabase
      .from("club_round_schedules")
      .select("id, club_id, round_date, course_id, course_name, layout_id, layout_name, tee_time, status, award_config")
      .gte("round_date", today)
      .in("status", ["planned", "recruiting", "closed", "finished"]);
    if (scope.scheduleIds.length === 0) scheduleQuery = scheduleQuery.lte("round_date", scanUntil);
    if (scope.clubId) scheduleQuery = scheduleQuery.eq("club_id", scope.clubId);
    if (scope.scheduleIds.length > 0) scheduleQuery = scheduleQuery.in("id", scope.scheduleIds);

    const { data: schedules, error: scheduleError } = await scheduleQuery;
    if (scheduleError) throw scheduleError;
    const scheduleRows = (schedules ?? []) as ScheduleRow[];
    const scheduleIds = scheduleRows.map((item) => item.id);
    const clubIds = unique(scheduleRows.map((item) => item.club_id));
    if (scheduleIds.length === 0) return jsonResponse({ candidates: 0, sent: 0, failed: 0, skipped: 0, dryRun });

    const [
      groupResult,
      memberResult,
      attendanceResult,
      clubMemberResult,
      clubResult,
      roundResult,
      lottoEntryResult,
      lottoDrawResult,
    ] = await Promise.all([
      supabase.from("club_round_groups").select("id, schedule_id, tee_time, front_layout_name, back_layout_name").in("schedule_id", scheduleIds),
      supabase.from("club_round_group_members").select("schedule_id, member_user_id, member_name").in("schedule_id", scheduleIds),
      supabase.from("club_round_attendances").select("schedule_id, member_user_id, status").in("schedule_id", scheduleIds),
      supabase.from("club_members").select("club_id, user_id").in("club_id", clubIds),
      supabase.from("clubs").select("id, name").in("id", clubIds),
      supabase.from("rounds").select("id, date, schedule_id, is_complete").in("schedule_id", scheduleIds),
      supabase.from("round_lotto_entries").select("schedule_id, user_id").in("schedule_id", scheduleIds),
      supabase.from("round_lotto_draws").select("schedule_id, drafter_user_id, draw_status").in("schedule_id", scheduleIds),
    ]);
    if (groupResult.error) throw groupResult.error;
    if (memberResult.error) throw memberResult.error;
    if (attendanceResult.error) throw attendanceResult.error;
    if (clubMemberResult.error) throw clubMemberResult.error;
    if (clubResult.error) throw clubResult.error;
    if (roundResult.error) throw roundResult.error;
    if (lottoEntryResult.error) throw lottoEntryResult.error;
    if (lottoDrawResult.error) throw lottoDrawResult.error;
    const clubNameById = new Map(
      ((clubResult.data ?? []) as ClubRow[]).map((club) => [club.id, club.name]),
    );

    const candidates = buildFeedNotifications({
      schedules: scheduleRows,
      groups: (groupResult.data ?? []) as GroupRow[],
      members: (memberResult.data ?? []) as GroupMemberRow[],
      attendances: (attendanceResult.data ?? []) as AttendanceRow[],
      clubMembers: (clubMemberResult.data ?? []) as ClubMemberRow[],
      rounds: (roundResult.data ?? []) as RoundRow[],
      lottoEntries: (lottoEntryResult.data ?? []) as LottoEntryRow[],
      lottoDraws: (lottoDrawResult.data ?? []) as LottoDrawRow[],
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const item of candidates) {
      const result = await sendOne({
        supabase,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject,
        item,
        clubName: clubNameById.get(item.clubId),
        dryRun,
      });
      sent += result.sent;
      failed += result.failed;
      if (result.skipped) skipped += 1;
    }

    return jsonResponse({ candidates: candidates.length, sent, failed, skipped, dryRun });
  } catch (error) {
    return jsonResponse({ error: errorMessageFromUnknown(error) }, 500);
  }
});
