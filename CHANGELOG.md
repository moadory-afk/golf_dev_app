# CHANGELOG - Live Data Foundation Sprint v2.2

## Added
- Home Live Binding 구조 추가
  - `src/features/home/api/homeRepository.ts`
  - `src/features/home/services/homeService.ts`
  - `src/features/home/mappers/homeMapper.ts`
  - `src/features/home/hooks/useHomeDashboard.ts`
  - `src/features/home/types/home.ts`
- Home Dashboard 모델 추가
  - Hero
  - Upcoming Round
  - AI Caddie
  - Recent Stats
  - Recent Rounds
- Home 데이터 로딩/에러/새로고침 상태 처리 추가

## Changed
- `HomeExperienceScreen`이 직접 `getRounds`, `getRoundSchedules`, `computeHandicaps`를 호출하지 않도록 변경했다.
- Home 화면 데이터 흐름을 `Repository → Service → Mapper → Hook → Screen` 구조로 분리했다.
- Hero와 Upcoming Round가 `club_round_schedules`, `club_round_groups`, `club_round_group_members`, `golf_courses`, `course_layouts` 기반 Dashboard 모델을 사용하도록 변경했다.
- Recent Stats 계산 로직을 `homeMapper`로 이동했다.
- Home 화면의 Screen 책임을 화면 조립과 Navigation 연결 중심으로 줄였다.

## DB
- 이번 코드 작업에서 추가 DB 변경은 없다.
- 직전 작업에서 생성한 `user_distance_profiles`, `user_preferences`는 향후 AI Caddie 개인화 Sprint에서 사용한다.

## Verified
- `npx tsc --noEmit` 통과

## Preserved
- 기존 Navigation Route 의미 유지
- Authentication, Invite, Payment 기능 변경 없음
- 기존 DB Schema 추가 변경 없음
