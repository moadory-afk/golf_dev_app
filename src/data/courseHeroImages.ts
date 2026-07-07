import type { ImageSourcePropType } from 'react-native'

const hillskyHeroImage = require('../../courses/hillsky.png')
const bomunHeroImage = require('../../courses/bomun.png')
const bugokHeroImage = require('../../courses/bugok.png')
const gayaHeroImage = require('../../courses/gaya.png')

export type CourseHeroKey = 'hillsky' | 'bomun' | 'bugok' | 'gaya'

export type CourseHeroAsset = {
  key: CourseHeroKey
  label: string
  courseName: string
  region: string
  source: ImageSourcePropType
  imagePath: string
}

export const COURSE_HERO_STORAGE_KEY = 'gogopar:selectedHeroKey'

export const COURSE_HERO_ASSETS: CourseHeroAsset[] = [
  {
    key: 'hillsky',
    label: '경주 힐스카이',
    courseName: '힐스카이CC',
    region: '경북 경주',
    source: hillskyHeroImage,
    imagePath: 'courses/hillsky.png',
  },
  {
    key: 'bomun',
    label: '경주 보문',
    courseName: '보문CC',
    region: '경북 경주',
    source: bomunHeroImage,
    imagePath: 'courses/bomun.png',
  },
  {
    key: 'bugok',
    label: '창녕 부곡',
    courseName: '부곡CC',
    region: '경남 창녕',
    source: bugokHeroImage,
    imagePath: 'courses/bugok.png',
  },
  {
    key: 'gaya',
    label: '김해 가야',
    courseName: '가야CC',
    region: '경남 김해',
    source: gayaHeroImage,
    imagePath: 'courses/gaya.png',
  },
]

const aliases: Record<string, CourseHeroKey> = {
  hillsky: 'hillsky',
  'hillsky cc': 'hillsky',
  'hillsky country club': 'hillsky',
  힐스카이: 'hillsky',
  힐스카이cc: 'hillsky',
  힐스카이컨트리클럽: 'hillsky',
  '힐스카이 cc': 'hillsky',
  '힐스카이 컨트리클럽': 'hillsky',

  bomun: 'bomun',
  'bomun cc': 'bomun',
  'bomun country club': 'bomun',
  보문: 'bomun',
  보문cc: 'bomun',
  보문컨트리클럽: 'bomun',
  '보문 cc': 'bomun',
  '보문 컨트리클럽': 'bomun',

  bugok: 'bugok',
  'bugok cc': 'bugok',
  'bugok country club': 'bugok',
  부곡: 'bugok',
  부곡cc: 'bugok',
  부곡컨트리클럽: 'bugok',
  '부곡 cc': 'bugok',
  '부곡 컨트리클럽': 'bugok',

  gaya: 'gaya',
  'gaya cc': 'gaya',
  'gaya country club': 'gaya',
  가야: 'gaya',
  가야cc: 'gaya',
  가야컨트리클럽: 'gaya',
  '가야 cc': 'gaya',
  '가야 컨트리클럽': 'gaya',
}

function normalizeCourseName(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function getCourseHeroAssetByKey(key?: string | null) {
  return COURSE_HERO_ASSETS.find((asset) => asset.key === key) ?? COURSE_HERO_ASSETS[0]
}

export function resolveCourseHeroKey(courseName?: string | null): CourseHeroKey {
  const normalized = normalizeCourseName(courseName)
  if (!normalized) return 'hillsky'

  const exact = aliases[normalized]
  if (exact) return exact

  const matched = Object.entries(aliases).find(([alias]) => normalized.includes(alias))
  return matched?.[1] ?? 'hillsky'
}

export function getCourseHeroImageSource(courseName?: string | null): ImageSourcePropType {
  return getCourseHeroAssetByKey(resolveCourseHeroKey(courseName)).source
}
