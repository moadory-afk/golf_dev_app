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

---

## PremiumHomeHeroSection - Hero Display

- `HERO_DISPLAY_ASPECT_RATIO = 16 / 10.5`를 사용한다.
- 실제 slide 높이는 `heroWidth × 10.5 / 16`으로 계산한다.
- 화면 크기가 달라져도 Hero 표시 높이는 카드 폭 기준으로 일관되게 유지한다.
