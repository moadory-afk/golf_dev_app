import AsyncStorage from '@react-native-async-storage/async-storage'

export type RoundWeather = {
  tempC: number
  icon: string
  condition: string
  windMs?: number
  windDeg?: number
  pop?: number
  fetchedAt: string
}

type GeoItem = { lat: number; lon: number; name?: string }
type ForecastItem = {
  dt: number
  main?: { temp?: number }
  weather?: { main?: string; description?: string; icon?: string }[]
  wind?: { speed?: number; deg?: number }
  pop?: number
}

type ForecastResponse = { list?: ForecastItem[] }

const API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY
const CACHE_TTL_MS = 1000 * 60 * 60 * 3

function normalizeCourseName(name: string) {
  return name
    .replace(/컨트리클럽/g, 'CC')
    .replace(/골프클럽/g, 'GC')
    .replace(/골프장/g, '')
    .replace(/Valley|East|West|In|Out|Lake|Mountain|Hills/gi, '')
    .replace(/[·•]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function weatherEmoji(icon?: string, main?: string) {
  if (icon?.includes('09') || icon?.includes('10') || /rain/i.test(main ?? '')) return '🌧️'
  if (icon?.includes('11') || /thunder/i.test(main ?? '')) return '⛈️'
  if (icon?.includes('13') || /snow/i.test(main ?? '')) return '❄️'
  if (icon?.includes('50') || /mist|fog|haze/i.test(main ?? '')) return '🌫️'
  if (icon?.includes('02')) return '🌤️'
  if (icon?.includes('03') || icon?.includes('04') || /cloud/i.test(main ?? '')) return '☁️'
  return '☀️'
}

function targetTimestamp(date: string, time?: string) {
  const safeTime = /^\d{1,2}:\d{2}/.test(time ?? '') ? time : '09:00'
  return new Date(`${date}T${safeTime}:00+09:00`).getTime() / 1000
}

function pickForecast(list: ForecastItem[], date: string, time?: string) {
  const target = targetTimestamp(date, time)
  return [...list].sort((a, b) => Math.abs(a.dt - target) - Math.abs(b.dt - target))[0]
}

async function readCache(key: string): Promise<RoundWeather | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RoundWeather
    if (Date.now() - new Date(parsed.fetchedAt).getTime() > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

async function writeCache(key: string, value: RoundWeather) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore cache write errors
  }
}

function hasCoordinate(latitude?: number | null, longitude?: number | null) {
  return typeof latitude === 'number'
    && typeof longitude === 'number'
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
}

async function geocodeCourse(courseName: string, region?: string): Promise<GeoItem | null> {
  if (!API_KEY) return null
  const queryParts = [normalizeCourseName(courseName), region, 'Korea'].filter(Boolean)
  const q = encodeURIComponent(queryParts.join(' '))
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${q}&limit=1&appid=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json() as GeoItem[]
  return data?.[0] ?? null
}

export async function getOpenWeatherForRound(params: {
  roundId: string
  courseName?: string
  region?: string
  latitude?: number | null
  longitude?: number | null
  date: string
  time?: string
}): Promise<RoundWeather | null> {
  if (!API_KEY) return null

  const coordinateKey = hasCoordinate(params.latitude, params.longitude)
    ? `${params.latitude},${params.longitude}`
    : normalizeCourseName(params.courseName ?? '')
  const cacheKey = `@gogopar_weather:${params.roundId}:${coordinateKey}:${params.date}:${params.time ?? ''}`
  const cached = await readCache(cacheKey)
  if (cached) return cached

  const geo = hasCoordinate(params.latitude, params.longitude)
    ? { lat: params.latitude as number, lon: params.longitude as number }
    : params.courseName?.trim()
      ? await geocodeCourse(params.courseName, params.region)
      : null
  if (!geo) return null

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${geo.lat}&lon=${geo.lon}&appid=${API_KEY}&units=metric&lang=kr`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json() as ForecastResponse
  const picked = pickForecast(data.list ?? [], params.date, params.time)
  if (!picked) return null

  const weather = picked.weather?.[0]
  const result: RoundWeather = {
    tempC: Math.round(picked.main?.temp ?? 0),
    icon: weatherEmoji(weather?.icon, weather?.main),
    condition: weather?.description ?? weather?.main ?? '날씨',
    windMs: typeof picked.wind?.speed === 'number' ? Math.round(picked.wind.speed * 10) / 10 : undefined,
    windDeg: picked.wind?.deg,
    pop: typeof picked.pop === 'number' ? Math.round(picked.pop * 100) : undefined,
    fetchedAt: new Date().toISOString(),
  }
  await writeCache(cacheKey, result)
  return result
}
