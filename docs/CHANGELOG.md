# CHANGELOG - AI Caddie Data Binding Sprint v2.4

## Added
- AI Caddie Data Binding 추가
  - `src/features/caddie/api/caddieRepository.ts`
  - `src/features/caddie/mappers/caddieMapper.ts`
  - `src/features/caddie/services/caddieService.ts`
  - `src/features/caddie/hooks/useAICaddieData.ts`
  - `src/features/caddie/types/caddieData.ts`
- `user_distance_profiles`, `user_preferences`, `course_hole_guides` 조회를 AI Engine 입력값으로 매핑하는 구조를 추가했다.
- Home AI Caddie Card가 실제 추천 클럽, 유효거리, 위험도 메시지를 표시할 수 있도록 연결했다.

## Changed
- `HomeExperienceScreen`이 `userId`를 `useHomeDashboard`에 전달하도록 변경했다.
- `HomeService`가 Home Dashboard 생성 후 AI Caddie Preview를 비파괴적으로 병합하도록 변경했다.
- `PremiumGogoCaddieCard`가 기존 Mock 메시지와 Live Advice 메시지를 모두 지원하도록 확장했다.
- `HomeAiCaddie` 모델에 Live Advice 표시 필드를 추가했다.

## DB
- 이번 Sprint에서 DB 변경은 없다.
- 기존 `user_distance_profiles`, `user_preferences`, `course_hole_guides`를 사용한다.

## Verified
- 업로드된 파일은 `src` 단위라 전체 프로젝트 의존성 설치 상태가 없어 전체 `tsc --noEmit`은 실행하지 못했다.
- 순수 AI Engine 및 Mapper 파일은 `tsc --noEmit` 부분 검증을 통과했다.

## Preserved
- 기존 Navigation 변경 없음
- Authentication, Invite, Payment 기능 변경 없음
- 기존 DB Schema 변경 없음
