# CHANGELOG - Home Experience Sprint v1.4

## Added
- Premium Upcoming Round 전용 컴포넌트 `src/features/home/components/PremiumUpcomingRoundCard.tsx` 추가
- 예정 라운드를 대형 Ticket Card 형태로 표시
- 코스 썸네일, 상태 Badge, 골프장명, 코스명, 날짜, Tee Off, 인원, 날씨 정보 적용
- 우측 Quick Action 영역에 코스맵, 조편성, Lotto 6/18 버튼 구조 추가
- 예정 라운드가 없는 경우 라운드 일정 생성 CTA Empty State 추가

## Changed
- `HomeExperienceScreen`의 `TodayRoundCard` 섹션을 `PremiumUpcomingRoundCard` 기반 `Upcoming Round` 섹션으로 교체
- 기존 라운드 일정 화면 이동 흐름은 유지하면서 Home 카드 UI만 Premium Dashboard 구조로 개선
- Home 컴포넌트 export 목록에 `PremiumUpcomingRoundCard` 추가

## Verified
- `npx tsc --noEmit` 통과

## Preserved
- 기존 `HomeScreen.tsx`, 라운드, 클럽, 기록, 인증, 결제, DB Schema는 삭제/변경하지 않음
