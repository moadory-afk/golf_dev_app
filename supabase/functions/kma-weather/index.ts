const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type KmaItem = {
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
};

function toKmaGrid(latitude: number, longitude: number) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + latitude * DEGRAD * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = longitude * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

function latestBaseDateTime() {
  // 발표자료 생성 지연을 고려해 현재 한국시각보다 10분 이전의 최신 발표를 선택한다.
  const shifted = new Date(Date.now() + 9 * 60 * 60 * 1000 - 10 * 60 * 1000);
  const releaseHours = [2, 5, 8, 11, 14, 17, 20, 23];
  let year = shifted.getUTCFullYear();
  let month = shifted.getUTCMonth();
  let day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  let baseHour = [...releaseHours].reverse().find((value) => value <= hour);
  if (baseHour === undefined) {
    const previous = new Date(Date.UTC(year, month, day) - 24 * 60 * 60 * 1000);
    year = previous.getUTCFullYear();
    month = previous.getUTCMonth();
    day = previous.getUTCDate();
    baseHour = 23;
  }
  const baseDate = `${year}${String(month + 1).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  const baseTime = `${String(baseHour).padStart(2, "0")}00`;
  return { baseDate, baseTime };
}

function numeric(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const serviceKey = Deno.env.get("KMA_SERVICE_KEY");
    if (!serviceKey) throw new Error("KMA_SERVICE_KEY가 등록되지 않았습니다.");
    const { latitude, longitude } = await req.json();
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return new Response(JSON.stringify({ error: "유효한 골프장 좌표가 필요합니다." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { nx, ny } = toKmaGrid(latitude, longitude);
    const { baseDate, baseTime } = latestBaseDateTime();
    const params = new URLSearchParams({
      serviceKey, pageNo: "1", numOfRows: "1000", dataType: "JSON",
      base_date: baseDate, base_time: baseTime, nx: String(nx), ny: String(ny),
    });
    const response = await fetch(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?${params}`);
    if (!response.ok) throw new Error(`기상청 API 오류: ${response.status}`);
    const payload = await response.json();
    const header = payload?.response?.header;
    if (header?.resultCode !== "00") throw new Error(header?.resultMsg ?? "기상청 응답 오류");
    const items = (payload?.response?.body?.items?.item ?? []) as KmaItem[];
    const grouped = new Map<string, Record<string, string>>();
    items.forEach((item) => {
      const key = `${item.fcstDate}-${item.fcstTime}`;
      const current = grouped.get(key) ?? { date: item.fcstDate, time: item.fcstTime };
      current[item.category] = item.fcstValue;
      grouped.set(key, current);
    });
    const hours = Array.from(grouped.values())
      .filter((item) => item.TMP !== undefined)
      .map((item) => ({
        date: item.date, time: item.time, tempC: numeric(item.TMP) ?? 0,
        sky: numeric(item.SKY), pty: numeric(item.PTY), pop: numeric(item.POP),
        windMs: numeric(item.WSD), windDeg: numeric(item.VEC),
      }));
    const issuedAt = `${baseDate.slice(0, 4)}.${baseDate.slice(4, 6)}.${baseDate.slice(6, 8)} ${baseTime.slice(0, 2)}:${baseTime.slice(2)}`;
    return new Response(JSON.stringify({ hours, issuedAt, nx, ny }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
