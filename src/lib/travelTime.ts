type Coordinate = {
  latitude?: number | null
  longitude?: number | null
}

function kakaoRestApiKey() {
  return String(process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || '').trim()
}

function hasCoordinate(point?: Coordinate | null): point is { latitude: number; longitude: number } {
  return typeof point?.latitude === 'number'
    && typeof point.longitude === 'number'
    && Number.isFinite(point.latitude)
    && Number.isFinite(point.longitude)
}

export function formatTravelMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '이동시간 준비중'
  const rounded = Math.max(1, Math.round(minutes))
  if (rounded < 60) return `${rounded}분 소요`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  return rest > 0 ? `${hours}시간 ${rest}분 소요` : `${hours}시간 소요`
}

export async function getDrivingTravelTimeMinutes(origin: Coordinate, destination: Coordinate): Promise<number | null> {
  const apiKey = kakaoRestApiKey()
  if (!apiKey || !hasCoordinate(origin) || !hasCoordinate(destination)) return null

  const params = new URLSearchParams({
    origin: `${origin.longitude},${origin.latitude}`,
    destination: `${destination.longitude},${destination.latitude}`,
    priority: 'RECOMMEND',
  })

  const response = await fetch(`https://apis-navi.kakaomobility.com/v1/directions?${params.toString()}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  })
  if (!response.ok) return null

  const json = await response.json()
  const durationSeconds = Number(json?.routes?.[0]?.summary?.duration)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null
  return Math.ceil(durationSeconds / 60)
}
