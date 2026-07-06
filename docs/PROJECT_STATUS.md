# GogoPar Project Status

## Current Version
Live Data Foundation Sprint v2.2

## Current Sprint
Home Real Binding v2.2

## Progress

✅ Theme System
✅ Skin System
✅ Design Token
✅ Architecture
✅ Component Library (Base)
✅ Home Experience v1.0
✅ Premium Hero v1.1
✅ Gogo Caddie Card v1.2
✅ Recent Stats Cards v1.3
✅ Upcoming Round Ticket v1.4
✅ Quick Menu Polish v1.5
✅ Bottom Navigation Polish v1.6
✅ Motion Animation v1.7
✅ Live Data Foundation v2.1
✅ Home Real Binding v2.2
🚧 AI Engine v2.3

## Current Task

Home 화면을 `Repository → Service → Mapper → Hook → Screen` 구조로 전환했다.

Hero와 Upcoming Round는 `club_round_schedules` 기반의 다음 예정 라운드를 사용한다.
Recent Stats 계산은 Screen에서 제거하고 `homeMapper`로 이동했다.

## Verified

- `npx tsc --noEmit` 통과

## Next Task

- AI Caddie Engine v2.3
- `user_distance_profiles` 기반 클럽 추천
- `course_hole_guides` 기반 홀 공략 데이터 연결
- Home AI Caddie Card 실제 추천 메시지 연결

## Do Not Touch

- Authentication
- Invite
- Payment
- Existing DB Schema without explicit SQL approval
