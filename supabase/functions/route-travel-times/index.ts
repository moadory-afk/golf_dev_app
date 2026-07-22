const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Coordinate = {
  latitude?: number | null;
  longitude?: number | null;
};

type RequestBody = {
  origin?: Coordinate | null;
  destination?: Coordinate | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hasCoordinate(
  point?: Coordinate | null,
): point is { latitude: number; longitude: number } {
  return (
    typeof point?.latitude === "number" &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude)
  );
}

function minutesFromMilliseconds(milliseconds: unknown) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.ceil(value / 1000 / 60);
}

function minutesFromSeconds(seconds: unknown) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.ceil(value / 60);
}

function errorMessageFromUnknown(value: unknown): string {
  if (!value) return "알 수 없는 오류";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (typeof value === "object") {
    const item = value as { error?: unknown; message?: unknown; details?: unknown };
    const nested = item.error ?? item.message ?? item.details;
    if (nested && nested !== value) return errorMessageFromUnknown(nested);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

async function getNaverDrivingMinutes(origin: Coordinate, destination: Coordinate) {
  const clientId = Deno.env.get("NAVER_MAPS_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("NAVER_MAPS_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("NAVER Maps Directions Secret이 등록되지 않았습니다.");
  }
  if (!hasCoordinate(origin) || !hasCoordinate(destination)) {
    throw new Error("출발지 또는 목적지 좌표가 없습니다.");
  }

  const params = new URLSearchParams({
    start: `${origin.longitude},${origin.latitude}`,
    goal: `${destination.longitude},${destination.latitude}`,
    option: "trafast",
  });

  const response = await fetch(
    `https://maps.apigw.ntruss.com/map-direction/v1/driving?${params.toString()}`,
    {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`NAVER Directions 호출 실패 (${response.status}) ${text}`.trim());
  }

  const json = await response.json();
  const duration = json?.route?.trafast?.[0]?.summary?.duration;
  return minutesFromMilliseconds(duration);
}

async function getKakaoDrivingMinutes(origin: Coordinate, destination: Coordinate) {
  const apiKey = Deno.env.get("KAKAO_REST_API_KEY")?.trim();
  if (!apiKey) throw new Error("KAKAO_REST_API_KEY가 등록되지 않았습니다.");
  if (!hasCoordinate(origin) || !hasCoordinate(destination)) {
    throw new Error("출발지 또는 목적지 좌표가 없습니다.");
  }

  const params = new URLSearchParams({
    origin: `${origin.longitude},${origin.latitude}`,
    destination: `${destination.longitude},${destination.latitude}`,
    priority: "RECOMMEND",
  });

  const response = await fetch(
    `https://apis-navi.kakaomobility.com/v1/directions?${params.toString()}`,
    {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Kakao Directions 호출 실패 (${response.status}) ${text}`.trim());
  }

  const json = await response.json();
  return minutesFromSeconds(json?.routes?.[0]?.summary?.duration);
}

async function getTmapDrivingMinutes(origin: Coordinate, destination: Coordinate) {
  const appKey = Deno.env.get("TMAP_APP_KEY")?.trim();
  if (!appKey) throw new Error("TMAP_APP_KEY가 등록되지 않았습니다.");
  if (!hasCoordinate(origin) || !hasCoordinate(destination)) {
    throw new Error("출발지 또는 목적지 좌표가 없습니다.");
  }

  const response = await fetch(
    "https://apis.openapi.sk.com/tmap/routes?version=1",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        appKey,
      },
      body: JSON.stringify({
        startX: String(origin.longitude),
        startY: String(origin.latitude),
        endX: String(destination.longitude),
        endY: String(destination.latitude),
        reqCoordType: "WGS84GEO",
        resCoordType: "WGS84GEO",
        searchOption: "0",
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`TMAP Routes 호출 실패 (${response.status}) ${text}`.trim());
  }

  const json = await response.json();
  const totalTime = json?.features?.[0]?.properties?.totalTime
    ?? json?.features?.find?.((item: any) => Number.isFinite(Number(item?.properties?.totalTime)))?.properties?.totalTime;
  return minutesFromSeconds(totalTime);
}

async function settleProvider<T>(promise: Promise<T>) {
  try {
    return { value: await promise, error: null };
  } catch (error) {
    return { value: null, error: errorMessageFromUnknown(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST 요청만 지원합니다." }, 405);

  try {
    const body = await req.json().catch(() => ({})) as RequestBody;
    const [kakao, tmap, naver] = await Promise.all([
      settleProvider(getKakaoDrivingMinutes(body.origin, body.destination)),
      settleProvider(getTmapDrivingMinutes(body.origin, body.destination)),
      settleProvider(getNaverDrivingMinutes(body.origin, body.destination)),
    ]);
    return jsonResponse({
      kakao: kakao.value,
      tmap: tmap.value,
      naver: naver.value,
      errors: {
        kakao: kakao.error,
        tmap: tmap.error,
        naver: naver.error,
      },
    });
  } catch (error) {
    return jsonResponse({ error: errorMessageFromUnknown(error), kakao: null, tmap: null, naver: null }, 200);
  }
});
