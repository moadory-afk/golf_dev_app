import Svg, { Path, Circle, Rect, Polyline } from 'react-native-svg'

// ── GogoPar 라인 아이콘 세트 ──────────────────────────────
// 개편안(turf)에서 이모지를 대체합니다. 24x24 그리드, stroke 기반.
//   <Icon name="home" size={22} color="#15201a" />
// 색은 stroke로 들어가므로 라인 아이콘은 color 한 가지로 통일됩니다.

export type IconName =
  | 'home' | 'list' | 'settings' | 'flag' | 'user' | 'users'
  | 'chevronDown' | 'chevronRight' | 'chevronLeft' | 'check'
  | 'plus' | 'minus' | 'camera' | 'trophy' | 'target' | 'trend'
  | 'coin' | 'edit' | 'link' | 'bolt' | 'chart' | 'money' | 'logout'
  // 스코어 표기 (홀별 점수 라벨)
  | 'birdie' | 'par' | 'bogey' | 'double' | 'eagle'

export function Icon({
  name,
  size = 22,
  color = '#15201a',
  strokeWidth = 1.8,
}: {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}) {
  const common = {
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths(name, common)}
    </Svg>
  )
}

function paths(name: IconName, p: any) {
  switch (name) {
    case 'home':
      return <>
        <Path d="M4 11.5 L12 4.5 L20 11.5" {...p} />
        <Path d="M6.3 10 V19.5 H17.7 V10" {...p} />
      </>
    case 'list':
      return <>
        <Rect x={5} y={4.5} width={14} height={16} rx={2.5} {...p} />
        <Path d="M9 4 h6 v2.6 h-6 z" {...p} />
        <Path d="M8.6 11 H15.4 M8.6 14.6 H13" {...p} />
      </>
    case 'settings':
      return <>
        <Circle cx={12} cy={12} r={3} {...p} />
        <Path d="M12 3.5 v2.2 M12 18.3 v2.2 M5.5 5.5 l1.6 1.6 M16.9 16.9 l1.6 1.6 M3.5 12 h2.2 M18.3 12 h2.2 M5.5 18.5 l1.6 -1.6 M16.9 7.1 l1.6 -1.6" {...p} />
      </>
    case 'flag':
      return <>
        <Path d="M6.5 20.5 V4" {...p} />
        <Path d="M6.5 5 H17 L14 8.3 L17 11.6 H6.5" {...p} />
      </>
    case 'user':
      return <>
        <Circle cx={12} cy={8.5} r={3.6} {...p} />
        <Path d="M5.5 20 a6.5 6.5 0 0 1 13 0" {...p} />
      </>
    case 'users':
      return <>
        <Circle cx={9} cy={8} r={3.2} {...p} />
        <Path d="M3.5 19 a5.5 5.5 0 0 1 11 0" {...p} />
        <Path d="M16 5.2 a3.2 3.2 0 0 1 0 6" {...p} />
        <Path d="M17 14.2 a5.5 5.5 0 0 1 4 4.8" {...p} />
      </>
    case 'chevronDown':
      return <Path d="M6 9.5 L12 15.5 L18 9.5" {...p} strokeWidth={2} />
    case 'chevronRight':
      return <Path d="M9 5 L16 12 L9 19" {...p} strokeWidth={2} />
    case 'chevronLeft':
      return <Path d="M15 5 L8 12 L15 19" {...p} strokeWidth={2} />
    case 'check':
      return <Path d="M5 12.5 L10 17.5 L19 6.5" {...p} strokeWidth={2.2} />
    case 'plus':
      return <Path d="M12 6 V18 M6 12 H18" {...p} strokeWidth={2.2} />
    case 'minus':
      return <Path d="M6 12 H18" {...p} strokeWidth={2.2} />
    case 'camera':
      return <>
        <Path d="M4 8 h3 l1.5 -2 h7 L18 8 h2 a1 1 0 0 1 1 1 v9 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 V9 a1 1 0 0 1 1 -1" {...p} />
        <Circle cx={12} cy={13} r={3.4} {...p} />
      </>
    case 'trophy':
      return <>
        <Path d="M7.5 4.5 H16.5 V8 a4.5 4.5 0 0 1 -9 0 Z" {...p} />
        <Path d="M12 12.5 V16 M8.5 19.5 H15.5" {...p} />
        <Path d="M9.5 19.5 a2.5 2.5 0 0 1 5 0" {...p} />
        <Path d="M7.5 5.5 H5.2 a2.8 2.8 0 0 0 2.8 3.6" {...p} />
        <Path d="M16.5 5.5 H18.8 a2.8 2.8 0 0 1 -2.8 3.6" {...p} />
      </>
    case 'target':
      return <>
        <Circle cx={12} cy={12} r={8} {...p} />
        <Circle cx={12} cy={12} r={4} {...p} />
        <Circle cx={12} cy={12} r={0.6} {...p} />
      </>
    case 'trend':
      return <>
        <Polyline points="4,16.5 9.5,11 13,14 20,6.5" {...p} />
        <Path d="M15.5 6.5 H20 V11" {...p} />
      </>
    case 'coin':
    case 'money':
      return <>
        <Circle cx={12} cy={12} r={8} {...p} />
        <Path d="M9 9 L12 14 L15 9 M9.5 12 H14.5" {...p} />
      </>
    case 'edit':
      return <>
        <Path d="M15.5 5.5 l3 3 L9 18 H6 V15 Z" {...p} />
        <Path d="M14 7 l3 3" {...p} />
      </>
    case 'link':
      return <>
        <Path d="M9 14.5 a4 4 0 0 1 0 -5 L11 7.5 a4 4 0 0 1 5.6 5.6" {...p} />
        <Path d="M15 9.5 a4 4 0 0 1 0 5 L13 16.5 a4 4 0 0 1 -5.6 -5.6" {...p} />
      </>
    case 'bolt':
      return <Path d="M13 3 L5.5 13 H11 L10 21 L18.5 10.5 H12.5 Z" {...p} />
    case 'chart':
      return <>
        <Path d="M5 4 V20 H20" {...p} />
        <Path d="M8 16 V12 M12 16 V8 M16 16 V10" {...p} />
      </>
    case 'logout':
      return <>
        <Path d="M14 5 H6 a1 1 0 0 0 -1 1 V18 a1 1 0 0 0 1 1 H14" {...p} />
        <Path d="M11 12 H20 M16.5 8.5 L20 12 L16.5 15.5" {...p} />
      </>
    // ── 스코어 표기 ──
    case 'eagle':
      return <>
        <Circle cx={12} cy={12} r={7.5} {...p} strokeWidth={2} />
        <Circle cx={12} cy={12} r={3.8} {...p} strokeWidth={2} />
      </>
    case 'birdie':
      return <Circle cx={12} cy={12} r={7} {...p} strokeWidth={2} />
    case 'par':
      return <Path d="M5 12 H19" {...p} strokeWidth={2.2} />
    case 'bogey':
      return <Rect x={5.5} y={5.5} width={13} height={13} rx={1.5} {...p} strokeWidth={2} />
    case 'double':
      return <>
        <Rect x={3.5} y={3.5} width={17} height={17} rx={1.5} {...p} strokeWidth={2} />
        <Rect x={8} y={8} width={8} height={8} rx={1} {...p} strokeWidth={2} />
      </>
    default:
      return null
  }
}
