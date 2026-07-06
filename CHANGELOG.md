# CHANGELOG - AI Shot Plan Sprint v2.8

## Added
- AI Shot Plan v2.8 추가
  - 홀별 추천 클럽 플랜 생성
  - 샷별 예상 거리와 남은 거리 계산
  - 홀별 예상 타수 산출
  - Par / Bogey / Double 확률 산출
  - 18홀 Shot Plan 요약과 오늘 예상 스코어 산출
- `src/features/caddie/types/shotPlan.ts` 추가
  - `AIShotPlan`, `AIShotPlanStep`, `AIShotPlanRoundSummary` 타입 정의
- `src/features/caddie/engine/shotPlanEngine.ts` 추가
  - 사용자 비거리, 홀 거리, PAR, 위험도, 추천 모드를 기반으로 AI Shot Plan 생성
  - 18홀 예상 스코어 요약 생성
- 캐디북 상세 화면에 `AI Shot Plan` 카드 추가
  - Driver → 4H 형태의 실행 계획 표시
  - 샷별 예상 거리 / 남은 거리 / AI 한마디 표시
- 캐디북 상단에 `18 Hole Shot Plan` 요약 카드 추가
  - 홀별 공략 요약
  - 홀별 예상 타수
  - 오늘 예상 스코어
  - Par / Bogey / Double 목표 표시

## Changed
- `CaddieBookHole` 모델에 `shotPlan`을 추가했다.
- `CaddieBookData` 모델에 `shotPlanSummary`를 추가했다.
- `mapCaddieBookData`가 홀별 AI Shot Plan과 18홀 요약을 함께 생성하도록 변경했다.
- 캐디북은 단순 설명형 화면에서 라운드 전 실행 계획을 보여주는 화면으로 확장했다.

## DB
- 이번 Sprint에서 DB 변경은 없다.

## Verified
- 순수 AI Shot Plan Engine 관련 TypeScript 검증 통과
  - `shotPlan.ts`
  - `shotPlanEngine.ts`
  - `clubRecommendation.ts`
  - `riskAnalyzer.ts`
  - `caddie.ts`
- 전체 앱 TypeScript 검증은 업로드 범위가 `src.zip`이고 프로젝트 루트 의존성이 없어 실행하지 못했다.

## Preserved
- 기존 Navigation 구조 유지
- 기존 Home UI 유지
- 기존 CaddieBook 진입 흐름 유지
- Authentication, Invite, Payment 변경 없음
- 기존 DB Schema 변경 없음
