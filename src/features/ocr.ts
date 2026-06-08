import * as ImageManipulator from 'expo-image-manipulator'
import { Image, Platform } from 'react-native'
import { supabase } from '../lib/supabase'

const MAX_EDGE = 1568

export interface RecognizedPlayer {
  name: string
  diffs: (number | null)[] // 카드 1장 = 9개, merge 후 = 18개
}
export interface RecognizedScorecard {
  players: RecognizedPlayer[]
  pars: (number | null)[]          // 카드 1장 = 9개, merge 후 = 18개
  courseName?: string              // 골프장 전체 이름 (예: "서라벌CC")
  recognizedCourseName?: string    // 코스 이름 (예: "밸리코스") — 9홀 슬롯 결정에 사용
}

async function resizeToBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('canvas 실패')); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = uri
    })
  }
  const { width: origW, height: origH } = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject)
  )
  const scale = Math.min(1, MAX_EDGE / Math.max(origW, origH))
  const actions: ImageManipulator.Action[] = scale < 1
    ? [{ resize: { width: Math.round(origW * scale) } }]
    : []
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  })
  return result.base64!
}

export async function recognizeScorecard(uri: string): Promise<RecognizedScorecard> {
  const base64 = await resizeToBase64(uri)
  const { data, error } = await supabase.functions.invoke('recognize-scorecard', {
    body: { imageBase64: base64, mediaType: 'image/jpeg' },
  })
  if (error) {
    const ctx = (error as { context?: { text?: () => Promise<string> } }).context
    if (ctx?.text) throw new Error((await ctx.text()) || error.message)
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)
  return normalize(data)
}

/**
 * 여러 장(9홀 카드들)의 인식 결과를 18홀 1라운드로 합친다.
 *
 * @param cards - recognizeScorecard 결과 배열
 * @param frontCourseName - RoundSetup에서 선택한 전반 코스명 (예: "밸리코스")
 * @param backCourseName  - RoundSetup에서 선택한 후반 코스명 (예: "파인코스")
 */
export function mergeScorecards(
  cards: RecognizedScorecard[],
  frontCourseName?: string,
  backCourseName?: string
): RecognizedScorecard {
  const pars18: (number | null)[] = Array.from({ length: 18 }, () => null)
  const playerMap = new Map<string, { name: string; diffs: (number | null)[] }>()
  const playerOrder: string[] = []

  cards.forEach((card, cardIdx) => {
    const is18 = card.pars.length > 9
    const offset = is18 ? 0 : detectIsBack(card.recognizedCourseName, frontCourseName, backCourseName, cardIdx) ? 9 : 0
    const len = is18 ? Math.min(18, card.pars.length) : Math.min(9, card.pars.length)

    // pars
    for (let i = 0; i < len; i++) {
      if (pars18[offset + i] == null && card.pars[i] != null) pars18[offset + i] = card.pars[i]
    }

    // players
    for (const p of card.players) {
      const key = p.name.trim() || `_${playerOrder.length}`
      if (!playerMap.has(key)) {
        playerMap.set(key, { name: p.name, diffs: Array.from({ length: 18 }, () => null) })
        playerOrder.push(key)
      }
      const entry = playerMap.get(key)!
      const diffLen = is18 ? Math.min(18, p.diffs.length) : Math.min(9, p.diffs.length)
      for (let i = 0; i < diffLen; i++) {
        if (p.diffs[i] != null) entry.diffs[offset + i] = p.diffs[i]
      }
    }
  })

  const courseName = cards.map((c) => c.courseName?.trim()).find(Boolean)
  return {
    players: playerOrder.map((k) => {
      const { name, diffs } = playerMap.get(k)!
      return { name, diffs }
    }),
    pars: pars18,
    courseName,
  }
}

// ──────────────────────────────────────────────────────────────────────────────

// 골프장 스코어카드에서 자주 쓰이는 영문 → 한글 코스명 대조표
const EN_KO: [RegExp, string][] = [
  [/valley/gi,   '밸리'],
  [/pine/gi,     '파인'],
  [/hill/gi,     '힐'],
  [/lake/gi,     '레이크'],
  [/mountain/gi, '마운틴'],
  [/ocean/gi,    '오션'],
  [/west/gi,     '웨스트'],
  [/east/gi,     '이스트'],
  [/south/gi,    '사우스'],
  [/north/gi,    '노스'],
  [/sky/gi,      '스카이'],
  [/forest/gi,   '포레스트'],
  [/beach/gi,    '비치'],
  [/royal/gi,    '로얄'],
  [/grand/gi,    '그랜드'],
  [/sun/gi,      '썬'],
  [/sea/gi,      '씨'],
  [/moon/gi,     '문'],
  [/green/gi,    '그린'],
  [/gold/gi,     '골드'],
  [/blue/gi,     '블루'],
  [/spring/gi,   '스프링'],
  [/summer/gi,   '서머'],
  [/winter/gi,   '윈터'],
  [/course/gi,   ''],
]

function normCourse(s: string): string {
  let n = s.replace(/코스|CC|GC|컨트리클럽|\s/gi, '').toLowerCase()
  for (const [re, ko] of EN_KO) n = n.replace(re, ko)
  return n
}

/**
 * recognizedCourseName이 전반/후반 중 어느 슬롯인지 판별.
 * 매칭 실패 시 카드 순서로 결정 (첫 번째 = 전반).
 */
function detectIsBack(
  recognizedName: string | undefined,
  frontName: string | undefined,
  backName: string | undefined,
  cardIndex: number
): boolean {
  if (recognizedName) {
    const r = normCourse(recognizedName)
    if (backName) {
      const b = normCourse(backName)
      if (b && (r.includes(b) || b.includes(r))) return true
    }
    if (frontName) {
      const f = normCourse(frontName)
      if (f && (r.includes(f) || f.includes(r))) return false
    }
  }
  return cardIndex > 0  // fallback: 첫 카드 = 전반
}

function toClean(arr: unknown): (number | null)[] {
  const a = Array.isArray(arr) ? arr : []
  return a.map((v) => typeof v === 'number' && Number.isFinite(v) ? v : null)
}

function normalize(data: unknown): RecognizedScorecard {
  const d = (data ?? {}) as {
    players?: unknown; pars?: unknown
    courseName?: unknown; course_name?: unknown
    recognizedCourseName?: unknown; recognized_course_name?: unknown
  }
  const players = Array.isArray(d.players) ? d.players : []
  const rawCourse = typeof d.courseName === 'string' ? d.courseName
    : typeof d.course_name === 'string' ? d.course_name : ''
  const rawRecognized = typeof d.recognizedCourseName === 'string' ? d.recognizedCourseName
    : typeof d.recognized_course_name === 'string' ? d.recognized_course_name : ''
  return {
    players: players.slice(0, 8).map((p) => {
      const pl = (p ?? {}) as { name?: unknown; diffs?: unknown }
      return {
        name: typeof pl.name === 'string' ? pl.name : '',
        diffs: toClean(pl.diffs),
      }
    }),
    pars: toClean(d.pars),
    courseName: rawCourse.trim() || undefined,
    recognizedCourseName: rawRecognized.trim() || undefined,
  }
}
