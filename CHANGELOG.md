# CHANGELOG - AI Shot Plan Polish Sprint v2.8.1

## Added
- AI Shot Plan Engine 추가
  - 홀별 추천 샷 시퀀스 생성
  - 샷별 예상 캐리 거리와 남은 거리 계산
  - 홀별 예상 타수 계산
  - Par / Bogey / Double 확률 계산
  - 18홀 예상 스코어와 오늘 목표 스코어 산출
- 캐디북 상세 화면에 AI Shot Plan Card 추가
  - Shot Timeline 표시
  - 추천 플랜 compact 표기
  - 예상타수 / 구간 / 난이도 표시
  - 스코어 확률 표시
- 캐디북 상단에 18 Hole Strategy 요약 카드 추가
  - 홀별 `D → 4H` 형태의 전략표
  - 오늘 AI 예상 스코어
  - 오늘 목표 스코어
  - Par / Bogey / Double 예상 개수

## Changed
- `CaddieBookHole` 모델에 `shotPlan` 필드를 추가했다.
- `CaddieBookData` 모델에 `shotPlanSummary` 필드를 추가했다.
- 캐디북 Mapper에서 사용자 비거리와 홀 거리 기반 Shot Plan을 함께 생성하도록 변경했다.
- 캐디북 화면의 AI 영역을 정보 표시 중심에서 실행 계획 중심으로 보강했다.

## DB
- DB 변경 없음.

## Verified
- 순수 AI Shot Plan Engine / Mapper 관련 TypeScript 부분 검증 통과.
- 전체 앱 TypeScript 검증은 업로드 범위가 `src.zip`이고 프로젝트 루트 의존성이 없어 실행하지 못함.

## Preserved
- 기존 Navigation 구조 유지.
- 기존 Home UI 유지.
- Authentication, Invite, Payment 변경 없음.
- 기존 DB Schema 변경 없음.


# CHANGELOG - Home v3.7 Concierge Visual Polish

## Changed
- Home 상단을 클럽 선택, 공지사항, 프로필만 남기는 1줄 Header로 정리했다.
- Hero 카드의 하단 핵심 정보 영역을 유지했다.
  - 날씨
  - 풍속
  - 예상 소요시간
  - 출발 추천 시간
- Greeting을 Home 상단에서 Concierge 카드 내부로 이동했다.
- Concierge 카드 아래의 중복 교통상황 블록을 삭제했다.
- Concierge 카드 액션을 `AI 캐디북 / 조편성 / Lotto` 3개로 정리했다.
- Home 통계 4개를 한 줄 compact 카드로 재정리했다.
- Home에서 Quick Menu, Upcoming Round, Recent Round, Community 섹션을 제거했다.

## DB
- DB 변경 없음.

## Verified
- `npx tsc --noEmit` 실행.
- 기존 CaddieBook / AI Shot Plan TypeScript 오류 3건은 유지됨.
- 이번 Home 변경 파일에서 신규 TypeScript 오류는 확인되지 않음.
