# COMPONENT_GUIDE - v2.8.1 Update

## AI Shot Plan

- `src/features/caddie/engine/shotPlanEngine.ts`
  - 홀별 추천 샷 플랜을 생성한다.
  - 샷별 클럽, 예상 거리, 남은 거리, 예상타수, 스코어 확률을 반환한다.
  - 18홀 예상 스코어와 목표 스코어를 요약한다.

## CaddieBook Screen

- `AIShotPlanCard`
  - 선택 홀의 AI Shot Plan을 보여준다.
  - Shot Timeline, 예상타수, 스코어 확률, 추천 이유를 표시한다.

- `ShotPlanSummaryCard`
  - 18홀 전략표와 오늘 예상 스코어를 보여준다.

- `ShotPlanTimeline`
  - Tee → Approach → Green 흐름을 시각적으로 표시한다.

## Rules

- Shot Plan 계산은 UI에서 하지 않는다.
- UI는 Mapper가 제공한 `shotPlan`, `shotPlanSummary`를 표시한다.
- 배열 렌더링은 항상 `?? []` 또는 길이 확인 후 수행한다.


# COMPONENT_GUIDE - Home v3.7 Addendum

## PremiumHomeHeroSection
- Header를 포함하지 않는다.
- Hero는 예정 라운드 Carousel과 하단 Weather/Route Strip만 담당한다.
- 하단 Strip의 정보는 날씨, 풍속, 예상 소요시간, 출발 추천 순서로 유지한다.

## PremiumGogoCaddieCard
- Greeting은 이 카드 내부에서 표시한다.
- 교통상황 상세 블록은 표시하지 않는다.
- 주요 액션은 `AI 캐디북`, `조편성`, `Lotto` 3개만 표시한다.
- 카드 하단에는 AI 한줄 코멘트만 유지한다.

## PremiumRecentStatsSection
- Home에서는 4개 통계를 한 줄 compact 카드로 표시한다.
