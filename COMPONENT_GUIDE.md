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

# Home Layout Engine v3.11

## Files

- `src/features/home/layout/homeLayoutTypes.ts`
  - Home Layout Definition 타입을 정의한다.

- `src/features/home/layout/premiumGolfHomeLayout.ts`
  - 현재 Home 디자인을 `Premium Golf Wave` 레이아웃으로 등록한다.

- `src/features/home/layout/HomeLayoutRenderer.tsx`
  - Layout Definition의 section 순서에 따라 슬롯을 렌더링한다.

## Rules

- Home Screen은 개별 섹션 순서를 직접 하드코딩하지 않고 Layout Renderer를 통해 출력한다.
- 데이터는 Screen에서 준비하고, 배치는 Layout Definition이 결정한다.
- 새로운 Home 디자인은 컴포넌트 재작성보다 Layout Definition 추가를 우선 검토한다.
