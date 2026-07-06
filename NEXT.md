# NEXT - AI Engine Sprint v2.3

다음 작업은 `AI Caddie Engine` 기반 구축입니다.

## Priority

1. `src/features/caddie/engine` 구조 생성
2. 사용자 클럽별 거리 기반 추천 로직 작성
3. `course_hole_guides`의 거리/전략/주의사항 데이터를 AI Caddie 입력값으로 변환
4. `user_distance_profiles`와 `user_preferences`를 읽는 Repository 추가
5. Home의 AI Caddie Card에 실제 추천 메시지 연결 준비

## Proposed Structure

```text
src/features/caddie/
  api/
  engine/
    clubRecommendation.ts
    distanceCalculator.ts
    riskAnalyzer.ts
    shotPlanner.ts
  types/
```

## Acceptance Criteria

- UI 컴포넌트가 AI 계산 로직을 직접 알지 않는다.
- 추천 로직은 순수 함수 중심으로 테스트 가능하게 작성한다.
- DB 조회는 Repository 계층에서만 수행한다.
- Home / Caddie / Round 화면이 같은 엔진을 재사용할 수 있어야 한다.
- `npx tsc --noEmit` 통과
- 작업 후 CHANGELOG.md, NEXT.md, PROJECT_STATUS.md, DECISIONS.md 업데이트
