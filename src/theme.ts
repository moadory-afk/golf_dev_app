// ============================================================
//  GogoPar 디자인 버전 스위치
// ------------------------------------------------------------
//  배포할 버전을 아래 APP_VERSION 한 줄로 선택하세요.
//
//    'legacy' → 기존 디자인 (딥그린)            ← 지금까지의 앱
//    'turf'   → 새 디자인 (민트 페이퍼 + 라임)   ← 개편안
//
//  앱의 모든 화면이 이 파일의 C 를 import 해서 색을 쓰므로,
//  이 한 줄만 바꾸면 화면 코드를 전혀 건드리지 않고
//  앱 전체가 해당 버전 톤으로 갈아입습니다.
// ============================================================

export type AppVersion = 'legacy' | 'turf'

export const APP_VERSION: AppVersion = 'turf'

// 두 팔레트는 키 구성이 완전히 동일합니다 (드롭인 호환).
type Palette = {
  green: string      // 주요 강조 (버튼 배경 · 강조 텍스트 · 활성 상태)
  greenDark: string  // 헤더 배경 (그 위 텍스트는 항상 흰색)
  greenMid: string
  greenLight: string // 옅은 강조 배경 (칩 · 활성 배경)
  bg: string
  card: string
  text: string
  muted: string
  border: string
  danger: string
  warn: string
  info: string
  gold: string
  silver: string
  bronze: string
  eagle: string
  // ── 아래 3개는 개편에서 추가된 키 (헤더/탭바 등 버전 인식 컴포넌트용) ──
  accent: string     // 시그니처 포인트 (legacy=그린 / turf=라임)
  accentText: string // accent 위에 올라가는 텍스트/아이콘 색
  headerText: string // 헤더 위 본문 텍스트
}

const LEGACY: Palette = {
  green:      '#1a6b44',
  greenDark:  '#0f4029',
  greenMid:   '#2d8a5a',
  greenLight: '#eaf5ef',
  bg:         '#f0f5f2',
  card:       '#ffffff',
  text:       '#111b14',
  muted:      '#6b7c74',
  border:     '#dde8e2',
  danger:     '#c0392b',
  warn:       '#e67e22',
  info:       '#2980b9',
  gold:       '#c9900a',
  silver:     '#8a9ba8',
  bronze:     '#a07048',
  eagle:      '#7c3aed',
  accent:     '#1a6b44',
  accentText: '#ffffff',
  headerText: '#ffffff',
}

const TURF: Palette = {
  // 'green' 키는 기존 화면 전반에서 버튼 배경(흰 글자)·강조 텍스트(흰 카드 위)
  // 양쪽으로 쓰이므로, 대비가 안전한 또렷한 그린으로 매핑합니다.
  green:      '#1f9d57',
  greenDark:  '#15201a', // 잉크 헤더 (그 위 흰 텍스트 그대로 유효)
  greenMid:   '#2f6b46',
  greenLight: '#e4f3ea',
  bg:         '#e9f1ea', // 민트 페이퍼
  card:       '#ffffff',
  text:       '#15201a', // 잉크
  muted:      '#7e8f82',
  border:     '#dce8de',
  danger:     '#d2533a',
  warn:       '#db8a2c',
  info:       '#3a78c2',
  gold:       '#c9900a',
  silver:     '#8a9ba8',
  bronze:     '#a07048',
  eagle:      '#7c3aed',
  accent:     '#c6ff3a', // 시그니처 라임 (잉크 헤더/탭 위에서 강하게 발색)
  accentText: '#15201a',
  headerText: '#ffffff',
}

export const C: Palette = APP_VERSION === 'turf' ? TURF : LEGACY

// 버전 분기가 필요한 컴포넌트(헤더·탭바 등)에서 사용
export const isTurf = APP_VERSION === 'turf'
