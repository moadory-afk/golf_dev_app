# CHANGELOG - Home Experience Sprint v1.7

## Added
- Home 주요 섹션 순차 등장 Motion Animation 적용
- `PremiumHomeMotion` 컴포넌트 추가
- Design Token `motion.stagger` 추가

## Changed
- `HomeExperienceScreen`의 Hero / Theme / Quick Menu / Upcoming Round / AI Caddie / Recent Stats / 최근 라운드 / Community 섹션을 Motion Wrapper로 감쌌다.
- 애니메이션은 opacity + translateY만 사용해 과한 움직임 없이 Premium 앱 톤을 유지한다.

## Verified
- `npx tsc --noEmit` 통과

## Preserved
- 기존 Navigation Route 의미 유지
- 기존 Home 데이터 계산 로직 유지
- Authentication, Invite, Payment, Existing DB Schema 변경 없음
