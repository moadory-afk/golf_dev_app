# GogoPar Project Status

## Current Version
Home Redesign v3.0 Phase 1

## Current Sprint
Home Round Hub Hero Carousel

## Progress

✅ Theme System
✅ Skin System
✅ Design Token
✅ Architecture
✅ Component Library (Base)
✅ Home Experience v1.0 ~ v1.7
✅ Live Data Foundation v2.1
✅ Home Real Binding v2.2
✅ AI Engine Foundation v2.3
✅ AI Caddie Data Binding v2.4
✅ CaddieBook Entry v2.5
✅ CaddieBook Live Detail v2.6
✅ AI Hole Strategy v2.7
✅ AI Shot Plan v2.8 ~ v2.8.1
✅ Home Redesign v3.0 Phase 1

## Current Task

Home Hero를 예정 라운드 Carousel 기반의 Round Hub로 전환했다.

- 여러 예정 라운드 Swipe 표시
- Hero 내부 라운드 액션 통합
- 관리자 전용 새 라운딩 등록 카드 추가
- 이동시간 / 추천 출발시간 표시 영역 추가

## Verified

- 변경 파일 기준 TypeScript transpile syntax check 통과
- 전체 TypeScript 검증은 전체 프로젝트 루트와 의존성 부재로 미실행

## Next Task

- Home Redesign v3.0 Phase 2
- Upcoming Round Card 제거
- Home 중복 섹션 정리
- AI Card / Quick Menu 단순화

## Do Not Touch

- Authentication
- Invite
- Payment
- Existing DB Schema without explicit SQL approval

---

## Home v4.0 Step 5

Hero Display System을 단순화했다.

- 앱의 Home Hero 표시 규격은 `16:10.5`로 고정한다.
- 이미지 원본 생성 규격과 앱 표시 규격을 분리한다.
- 앱에서는 카드 폭 기준으로 높이를 계산하고, 이미지는 해당 영역에 맞춰 cover 출력한다.
