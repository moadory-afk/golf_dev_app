import { getCachedAsync } from "./asyncCache";
import { supabase } from "./supabase";

type Coordinate = {
  latitude?: number | null;
  longitude?: number | null;
};

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

export function formatTravelMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "이동시간 준비중";
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `${rounded}분 소요`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest > 0 ? `${hours}시간 ${rest}분 소요` : `${hours}시간 소요`;
}

export function formatRecommendedDepartureTime(
  date?: string | null,
  time?: string | null,
  travelMinutes?: number | null,
  bufferMinutes = 40,
) {
  if (!date || !time || !Number.isFinite(travelMinutes ?? NaN))
    return "출발 추천 준비중";
  const normalizedDate = date.includes("T") ? date.slice(0, 10) : date;
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "출발 추천 준비중";

  const departure = new Date(normalizedDate);
  if (Number.isNaN(departure.getTime())) return "출발 추천 준비중";
  departure.setHours(Number(match[1]), Number(match[2]), 0, 0);
  departure.setMinutes(
    departure.getMinutes() -
      Math.max(0, Math.round(travelMinutes ?? 0)) -
      Math.max(0, Math.round(bufferMinutes)),
  );

  const hours = String(departure.getHours()).padStart(2, "0");
  const minutes = String(departure.getMinutes()).padStart(2, "0");
  return `출발 추천 ${hours}:${minutes}`;
}

const TRAVEL_CACHE_TTL_MS = 1000 * 60 * 10;

export type TravelTimeProvider = "kakao" | "tmap" | "naver";

export type ProviderTravelTimeMinutes = Partial<Record<TravelTimeProvider, number | null>>;

function coordinateCacheKey(point: { latitude: number; longitude: number }) {
  return `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;
}

export async function getProviderDrivingTravelTimeMinutes(
  origin: Coordinate,
  destination: Coordinate,
): Promise<ProviderTravelTimeMinutes> {
  if (!hasCoordinate(origin) || !hasCoordinate(destination))
    return {};

  const cacheKey = `travel:providers:${coordinateCacheKey(origin)}:${coordinateCacheKey(destination)}`;
  return getCachedAsync(
    cacheKey,
    TRAVEL_CACHE_TTL_MS,
    async () => {
      const { data, error } = await supabase.functions.invoke("route-travel-times", {
        body: { origin, destination },
      });
      if (error) return {};
      const kakao = Number(data?.kakao);
      const tmap = Number(data?.tmap);
      const naver = Number(data?.naver);
      return {
        kakao: Number.isFinite(kakao) && kakao > 0 ? kakao : null,
        tmap: Number.isFinite(tmap) && tmap > 0 ? tmap : null,
        naver: Number.isFinite(naver) && naver > 0 ? naver : null,
      };
    },
    { shouldCache: (value) => Object.values(value ?? {}).some((item) => item !== null && item !== undefined) },
  );
}
