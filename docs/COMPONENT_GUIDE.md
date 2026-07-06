# COMPONENT_GUIDE

## Base Components

- GPButton
- GPCard
- GPSection
- GPBadge
- GPChip
- GPAvatar

## Home Components

- PremiumHomeHeroSection
- PremiumGogoCaddieCard
  - Mock 상태와 Live AI Advice 상태를 모두 지원한다.
  - `title`, `message`, `primaryChip`, `secondaryChip`, `hasLiveAdvice`를 받을 수 있다.
- PremiumRecentStatsSection
- PremiumUpcomingRoundCard
- PremiumQuickMenuSection
- PremiumHomeMotion

## Navigation Components

- AppTabBar
- Main Bottom Tab

## Home Data Components / Hooks

- useHomeDashboard
  - Home 화면이 사용하는 단일 Dashboard Hook
  - `dashboard`, `loading`, `error`, `refresh`를 제공
  - Screen에서 Supabase를 직접 호출하지 않도록 한다.
  - v2.4부터 `userId`를 받아 AI Caddie Data Binding에 전달한다.

## AI Caddie Engine

- `src/features/caddie/engine/distanceCalculator.ts`
  - 남은 거리, 바람, 고저차, 라이를 반영해 유효거리를 계산한다.

- `src/features/caddie/engine/clubRecommendation.ts`
  - 사용자 클럽별 평균 거리와 유효거리를 비교해 추천 클럽, 신뢰도, 대체 클럽을 반환한다.

- `src/features/caddie/engine/riskAnalyzer.ts`
  - `course_hole_guides`의 summary, strategy, caution, JSON 필드에서 OB, 해저드, 벙커, 도그렉 등 위험 신호를 분석한다.

- `src/features/caddie/engine/shotPlanner.ts`
  - 위험도와 추천 클럽을 바탕으로 attack, safe, layup, recovery 공략 의도를 결정한다.

- `src/features/caddie/engine/holeStrategy.ts`
  - 홀 공략 메시지와 추천 근거를 사용자에게 보여줄 수 있는 형태로 조합한다.

## AI Caddie Data Binding

- `src/features/caddie/api/caddieRepository.ts`
  - Supabase에서 `user_distance_profiles`, `user_preferences`, `course_hole_guides`를 조회한다.

- `src/features/caddie/mappers/caddieMapper.ts`
  - DB Row를 AI Engine 입력 모델로 변환한다.

- `src/features/caddie/services/caddieService.ts`
  - Home에서 사용할 AI Caddie Preview를 생성한다.

- `src/features/caddie/hooks/useAICaddieData.ts`
  - 향후 화면에서 AI Caddie Preview를 직접 사용할 때 쓰는 Hook이다.

## Component Rule

새 Home 컴포넌트는 Screen 내부에 직접 구현하지 않고 `src/features/home/components`에 재사용 가능한 단위로 둔다.

AI 계산 로직은 UI 컴포넌트에 넣지 않고 `src/features/caddie/engine`의 순수 함수로 유지한다.
