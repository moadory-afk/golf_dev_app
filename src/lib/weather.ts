import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCachedAsync } from "./asyncCache";
import { supabase } from "./supabase";

export type RoundWeatherHour = {
  time: string;
  tempC: number;
  condition: string;
  icon: string;
  windMs?: number;
  pop?: number;
};

export type RoundWeather = {
  tempC: number;
  icon: string;
  condition: string;
  windMs?: number;
  windDeg?: number;
  pop?: number;
  fiveHourSummary?: string;
  fiveHourDetail?: string;
  hourlyForecast?: RoundWeatherHour[];
  openWeatherHourlyForecast?: RoundWeatherHour[];
  kmaIssuedAt?: string;
  fetchedAt: string;
};

type GeoItem = { lat: number; lon: number; name?: string };
type OpenMeteoForecastResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: Array<number | null>;
    weather_code?: number[];
    wind_speed_10m?: number[];
  };
};
type OpenMeteoGeoResponse = { results?: Array<{ latitude: number; longitude: number; name?: string }> };
type KmaFunctionHour = {
  date: string;
  time: string;
  tempC: number;
  sky?: number;
  pty?: number;
  pop?: number;
  windMs?: number;
  windDeg?: number;
};
type KmaFunctionResponse = { hours?: KmaFunctionHour[]; issuedAt?: string };

const CACHE_TTL_MS = 1000 * 60 * 60 * 3;
const GEO_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

function normalizeCourseName(name: string) {
  return name
    .replace(/컨트리클럽/g, "CC")
    .replace(/골프클럽/g, "GC")
    .replace(/골프장/g, "")
    .replace(/Valley|East|West|In|Out|Lake|Mountain|Hills/gi, "")
    .replace(/[·•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function openMeteoCondition(code?: number) {
  if (code === 0) return { condition: "맑음", icon: "☀️" };
  if (code === 1 || code === 2) return { condition: "구름조금", icon: "🌤️" };
  if (code === 3) return { condition: "흐림", icon: "☁️" };
  if (code === 45 || code === 48) return { condition: "안개", icon: "🌫️" };
  if ([51, 53, 55, 56, 57].includes(code ?? -1)) return { condition: "이슬비", icon: "🌦️" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1)) return { condition: "비", icon: "🌧️" };
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return { condition: "눈", icon: "❄️" };
  if ([95, 96, 99].includes(code ?? -1)) return { condition: "뇌우", icon: "⛈️" };
  return { condition: "날씨", icon: "☀️" };
}

function kmaCondition(sky?: number, pty?: number) {
  if (pty === 1) return { condition: "비", icon: "🌧️" };
  if (pty === 2) return { condition: "비/눈", icon: "🌨️" };
  if (pty === 3) return { condition: "눈", icon: "❄️" };
  if (pty === 4) return { condition: "소나기", icon: "🌦️" };
  if (sky === 4) return { condition: "흐림", icon: "☁️" };
  if (sky === 3) return { condition: "구름많음", icon: "🌤️" };
  return { condition: "맑음", icon: "☀️" };
}

function targetTimestamp(date: string, time?: string) {
  const safeTime = /^\d{1,2}:\d{2}/.test(time ?? "") ? time : "09:00";
  return new Date(`${date}T${safeTime}:00+09:00`).getTime() / 1000;
}

function normalizeKmaDate(date: string) {
  return /^\d{8}$/.test(date)
    ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
    : date;
}

function formatHour(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function timestampFromOpenMeteoTime(value: string) {
  return new Date(`${value}:00+09:00`).getTime() / 1000;
}

function pickFiveOpenMeteoHours(data: OpenMeteoForecastResponse, date: string, time?: string) {
  const start = targetTimestamp(date, time);
  const end = start + 5 * 60 * 60;
  const hourly = data.hourly;
  const times = hourly?.time ?? [];
  return times
    .map((timeValue, index) => ({ timeValue, index, timestamp: timestampFromOpenMeteoTime(timeValue) }))
    .filter((item) => item.timestamp >= start && item.timestamp <= end)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, 5)
    .map<RoundWeatherHour>(({ index, timestamp }) => {
      const weather = openMeteoCondition(hourly?.weather_code?.[index]);
      const tempC = Number(hourly?.temperature_2m?.[index]);
      const pop = hourly?.precipitation_probability?.[index];
      const windMs = Number(hourly?.wind_speed_10m?.[index]);
      return {
        time: formatHour(timestamp),
        tempC: Number.isFinite(tempC) ? Math.round(tempC) : 0,
        condition: weather.condition,
        icon: weather.icon,
        windMs: Number.isFinite(windMs) ? Math.round(windMs * 10) / 10 : undefined,
        pop: typeof pop === "number" ? Math.round(pop) : undefined,
      };
    });
}

function pickFiveKmaHours(hours: KmaFunctionHour[], date: string, time?: string) {
  const start = targetTimestamp(date, time);
  const end = start + 5 * 60 * 60;
  return hours
    .map((item) => ({
      item,
      timestamp: targetTimestamp(
        normalizeKmaDate(item.date),
        `${item.time.slice(0, 2)}:${item.time.slice(2, 4)}`,
      ),
    }))
    .filter(({ timestamp }) => timestamp >= start && timestamp <= end)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, 5)
    .map<RoundWeatherHour>(({ item, timestamp }) => {
      const weather = kmaCondition(item.sky, item.pty);
      return {
        time: formatHour(timestamp), tempC: Math.round(item.tempC),
        condition: weather.condition, icon: weather.icon,
        windMs: item.windMs, pop: item.pop,
      };
    });
}

function summarizeFiveHourForecast(hours: RoundWeatherHour[]) {
  if (!hours.length) return { summary: undefined, detail: undefined };
  const temps = hours.map((item) => item.tempC);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const maxPop = Math.max(...hours.map((item) => item.pop ?? 0));
  const maxWind = Math.max(...hours.map((item) => item.windMs ?? 0));
  const rainStart = hours.find((item) => (item.pop ?? 0) >= 50 || /비|소나기/.test(item.condition));
  let summary = "라운드 동안 날씨 변화가 크지 않겠습니다.";
  if (rainStart) summary = `${rainStart.time} 전후 비가 예상됩니다.`;
  else if (maxWind >= 7) summary = "라운드 중 강한 바람이 예상됩니다.";
  else if (maxTemp >= 33) summary = "라운드 동안 무더운 날씨가 이어지겠습니다.";
  else if (minTemp <= 5) summary = "라운드 동안 쌀쌀한 날씨가 예상됩니다.";
  const temperatureText = minTemp === maxTemp ? `${maxTemp}°C` : `${minTemp}~${maxTemp}°C`;
  return { summary, detail: `${temperatureText} · 강수확률 최고 ${maxPop}% · 바람 최고 ${Math.round(maxWind * 10) / 10}m/s` };
}

async function readCache(key: string) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoundWeather;
    return Date.now() - new Date(parsed.fetchedAt).getTime() <= CACHE_TTL_MS ? parsed : null;
  } catch { return null; }
}

async function writeCache(key: string, value: RoundWeather) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* cache is optional */ }
}

function hasCoordinate(latitude?: number | null, longitude?: number | null) {
  return typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude);
}

async function geocodeCourse(courseName: string, region?: string): Promise<GeoItem | null> {
  const normalizedName = normalizeCourseName(courseName);
  return getCachedAsync(`weather-geo:${normalizedName}:${region ?? ""}`, GEO_CACHE_TTL_MS, async () => {
    const q = encodeURIComponent([normalizedName, region].filter(Boolean).join(" "));
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=ko&format=json`);
    if (!res.ok) return null;
    const item = ((await res.json()) as OpenMeteoGeoResponse).results?.[0];
    return item ? { lat: item.latitude, lon: item.longitude, name: item.name } : null;
  }, { shouldCache: (value) => value !== null });
}

async function fetchKmaForecast(latitude: number, longitude: number, date: string, time?: string) {
  const { data, error } = await supabase.functions.invoke<KmaFunctionResponse>("kma-weather", {
    body: { latitude, longitude, date, time },
  });
  if (error || !data?.hours) return { hours: [] as RoundWeatherHour[], issuedAt: undefined };
  return { hours: pickFiveKmaHours(data.hours, date, time), issuedAt: data.issuedAt };
}

async function fetchOpenMeteoForecast(geo: GeoItem | null, date: string, time?: string) {
  if (!geo) return [] as RoundWeatherHour[];
  const params = new URLSearchParams({
    latitude: String(geo.lat),
    longitude: String(geo.lon),
    hourly: "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
    timezone: "Asia/Seoul",
    wind_speed_unit: "ms",
    forecast_days: "7",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) return [] as RoundWeatherHour[];
  return pickFiveOpenMeteoHours((await res.json()) as OpenMeteoForecastResponse, date, time);
}

export async function getWeatherForRound(params: {
  roundId: string; courseName?: string; region?: string;
  latitude?: number | null; longitude?: number | null;
  date: string; time?: string;
}): Promise<RoundWeather | null> {
  const geo = hasCoordinate(params.latitude, params.longitude)
    ? { lat: params.latitude as number, lon: params.longitude as number }
    : params.courseName?.trim() ? await geocodeCourse(params.courseName, params.region) : null;
  if (!geo) return null;
  const coordinateKey = `${geo.lat},${geo.lon}`;
  const cacheKey = `@gogopar_weather_compare_v4:${coordinateKey}:${params.date}:${params.time ?? ""}`;
  return getCachedAsync(`weather-compare-v4:${coordinateKey}:${params.date}:${params.time ?? ""}`, CACHE_TTL_MS, async () => {
    const cached = await readCache(cacheKey);
    if (cached) return cached;
    const [kma, openMeteoHours] = await Promise.all([
      fetchKmaForecast(geo.lat, geo.lon, params.date, params.time).catch(() => ({ hours: [], issuedAt: undefined })),
      fetchOpenMeteoForecast(geo, params.date, params.time).catch(() => []),
    ]);
    const primaryHours = kma.hours.length ? kma.hours : openMeteoHours;
    if (!primaryHours.length) return null;
    const first = primaryHours[0];
    const fiveHour = summarizeFiveHourForecast(primaryHours);
    const result: RoundWeather = {
      tempC: first.tempC, icon: first.icon, condition: first.condition,
      windMs: first.windMs, pop: first.pop,
      fiveHourSummary: fiveHour.summary, fiveHourDetail: fiveHour.detail,
      hourlyForecast: kma.hours,
      openWeatherHourlyForecast: openMeteoHours,
      kmaIssuedAt: kma.issuedAt,
      fetchedAt: new Date().toISOString(),
    };
    await writeCache(cacheKey, result);
    return result;
  }, { shouldCache: (value) => value !== null });
}

// 이전 호출부와의 호환성을 유지한다.
export const getOpenWeatherForRound = getWeatherForRound;
