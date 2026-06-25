import { C } from '../theme'
import { Icon, type IconName } from './Icon'

// ── 이모지 → 라인 아이콘 매핑 ─────────────────────────────
// 기존 화면 곳곳의 이모지를 최소 수정으로 라인 아이콘으로 바꾸기 위한 헬퍼.
//   <Text>{rec.icon}</Text>            →  <EmojiIcon char={rec.icon} size={20} />
//   <Text style={s.menuRowIcon}>👥</Text> →  <EmojiIcon char="👥" size={18} />
//
// 메달(🥇🥈🥉)은 자동으로 gold/silver/bronze 색이 들어갑니다.
// 매핑에 없는 글리프는 그대로 텍스트로 렌더 (안전한 폴백).

const MAP: Record<string, IconName> = {
  '🏆': 'trophy', '🏅': 'medal', '🎖️': 'medal', '🎖': 'medal',
  '🥇': 'medal', '🥈': 'medal', '🥉': 'medal',
  '🐦': 'birdie', '🐦🐦': 'birdie', '🦅': 'eagle',
  '⛳': 'flag', '🏌️': 'flag', '🏌': 'flag',
  '📈': 'trend', '📉': 'trendDown', '📊': 'chart',
  '📋': 'list', '👥': 'users', '👤': 'user',
  '💰': 'money', '⚡': 'bolt', '✏️': 'edit', '✏': 'edit',
  '🔗': 'link', '🚪': 'logout', '📱': 'phone', '📨': 'mail',
  '⚔️': 'versus', '⚔': 'versus', '🔥': 'flame',
  '🎯': 'target', '🌟': 'star', '⭐': 'star',
  '⚙️': 'settings', '⚙': 'settings', '🏠': 'home',
  '✓': 'check', '✅': 'check',
}

// 메달 색
const MEDAL_COLOR: Record<string, string> = {
  '🥇': C.gold, '🥈': C.silver, '🥉': C.bronze,
}

export function EmojiIcon({
  char,
  size = 18,
  color,
  strokeWidth,
}: {
  char: string
  size?: number
  color?: string
  strokeWidth?: number
}) {
  const trimmed = (char ?? '').trim()
  const name = MAP[trimmed]
  if (!name) return null // 매핑 없으면 아무것도 안 그림 (텍스트 잔여 방지)
  const resolved = color ?? MEDAL_COLOR[trimmed] ?? C.text
  return <Icon name={name} size={size} color={resolved} strokeWidth={strokeWidth} />
}

// 매핑 존재 여부 (조건부 렌더가 필요할 때)
export function hasIcon(char: string): boolean {
  return !!MAP[(char ?? '').trim()]
}
