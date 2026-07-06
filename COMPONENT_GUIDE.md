# COMPONENT_GUIDE - v2.8 Update

## AI Shot Plan Engine

- `src/features/caddie/types/shotPlan.ts`
  - AI Shot Plan ViewModel 타입을 정의한다.
  - 홀별 실행 계획, 예상 타수, 확률, 18홀 요약 모델을 포함한다.

- `src/features/caddie/engine/shotPlanEngine.ts`
  - 사용자 비거리와 홀 정보를 기반으로 홀별 Shot Plan을 생성한다.
  - Driver → 4H 형태의 실행 계획을 반환한다.
  - 홀별 예상 타수와 Par / Bogey / Double 확률을 계산한다.
  - 18홀 전체 예상 스코어를 요약한다.

## CaddieBook Components

- `ShotPlanOverview`
  - 18홀 전체 Shot Plan 요약을 표시한다.
  - 오늘 예상 스코어, Par/Bogey/Double 목표, 홀별 요약을 제공한다.

- `ShotPlanTimeline`
  - 선택 홀의 추천 클럽 플랜을 Timeline 형태로 표시한다.
  - 샷별 예상 거리와 남은 거리를 함께 보여준다.

## Rules

- AI Shot Plan 계산은 UI에 작성하지 않는다.
- UI는 `AIShotPlan` ViewModel을 표시만 한다.
- Screen은 Supabase를 직접 호출하지 않는다.
- Shot Plan은 캐디북, 라운드 화면, Home AI Card에서 재사용 가능한 구조를 유지한다.
