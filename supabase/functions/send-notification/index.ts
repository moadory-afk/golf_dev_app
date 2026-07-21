import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NotificationRequest = {
  clubId?: string;
  userIds?: string[];
  type?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type NotificationSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  updated_at?: string | null;
  last_seen_at?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function compactBody(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
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

function titleWithClubName(title: string, clubName?: string | null) {
  const name = clubName?.trim();
  if (!name) return title;
  const prefix = `[${name}]`;
  return title.startsWith(prefix) ? title : `${prefix} ${title}`;
}

function latestSubscriptionTimestamp(row: NotificationSubscriptionRow) {
  return row.last_seen_at ?? row.updated_at ?? "";
}

function pickLatestSubscriptionPerUser(rows: NotificationSubscriptionRow[]) {
  const latest = new Map<string, NotificationSubscriptionRow>();
  for (const row of rows) {
    const current = latest.get(row.user_id);
    if (!current || latestSubscriptionTimestamp(row) > latestSubscriptionTimestamp(current)) {
      latest.set(row.user_id, row);
    }
  }
  return [...latest.values()];
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST 요청만 지원합니다." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = getSupabaseSecretKey();
    const vapidPublicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") ?? "mailto:admin@gogopar.app";

    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase 서버 환경변수가 없습니다.");
    if (!vapidPublicKey || !vapidPrivateKey) throw new Error("웹 푸시 VAPID 키가 등록되지 않았습니다.");

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return jsonResponse({ error: "로그인이 필요합니다." }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData.user) return jsonResponse({ error: "유효하지 않은 사용자입니다." }, 401);

    const payload = await req.json() as NotificationRequest;
    const clubId = payload.clubId?.trim();
    const title = payload.title?.trim();
    const body = compactBody(payload.body ?? "");
    const type = payload.type?.trim() || "notice";
    if (!clubId || !title) return jsonResponse({ error: "clubId와 title이 필요합니다." }, 400);

    const { data: adminRow, error: adminError } = await supabase
      .from("club_members")
      .select("user_id")
      .eq("club_id", clubId)
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (adminError) throw adminError;
    if (!adminRow) return jsonResponse({ error: "알림 발송 권한이 없습니다." }, 403);

    const { data: clubRow, error: clubError } = await supabase
      .from("clubs")
      .select("name")
      .eq("id", clubId)
      .maybeSingle();
    if (clubError) throw clubError;
    const notificationTitle = titleWithClubName(title, clubRow?.name);

    let query = supabase
      .from("notification_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, updated_at, last_seen_at")
      .eq("club_id", clubId)
      .eq("channel", "web")
      .eq("enabled", true);

    if (payload.userIds?.length) query = query.in("user_id", payload.userIds);

    const { data: subscriptions, error: subscriptionError } = await query;
    if (subscriptionError) throw subscriptionError;

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const rows = pickLatestSubscriptionPerUser((subscriptions ?? []) as NotificationSubscriptionRow[]);
    const notificationPayload = JSON.stringify({
      title: notificationTitle,
      body,
      data: {
        ...(payload.data ?? {}),
        clubId,
        type,
      },
    });

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      if (!row.p256dh || !row.auth) {
        failed += 1;
        continue;
      }

      try {
        await webpush.sendNotification({
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        }, notificationPayload);
        sent += 1;
        await supabase.from("notification_logs").insert({
          club_id: clubId,
          user_id: row.user_id,
          type,
          title: notificationTitle,
          body,
          data: payload.data ?? {},
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        await supabase.from("notification_logs").insert({
          club_id: clubId,
          user_id: row.user_id,
          type,
          title: notificationTitle,
          body,
          data: payload.data ?? {},
          status: "failed",
          error_message: message,
        });

        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("notification_subscriptions")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      }
    }

    return jsonResponse({ sent, failed, total: rows.length });
  } catch (error) {
    return jsonResponse({ error: errorMessageFromUnknown(error) }, 500);
  }
});
