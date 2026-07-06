# CHANGELOG - Home v3.9 Premium Polish

## Changed
- Home 화면을 `Header → Hero → Gogo Concierge → Stats` 구조로 정리했다.
- Header는 클럽 선택, 공지, 프로필만 남기고 Greeting을 제거했다.
- Greeting은 Gogo Concierge 카드로 이동했다.
- Hero 카드 하단의 4개 핵심 정보는 유지했다.
  - 날씨
  - 풍속
  - 예상 소요시간
  - 출발 추천시간
- Hero의 골프장명, 코스명, 일정 정보, 정보 스트립의 폰트 크기와 정렬을 조정했다.
- Gogo Concierge 카드를 단일 카드 구조로 리디자인했다.
  - 캐릭터 축소
  - Greeting 2줄 구조
  - 라운드 안내 문구 압축
  - `AI 캐디북 / 조편성 / Lotto` 버튼 3개 배치
  - 교통상황 블록 삭제 유지
  - AI 한줄 코멘트 영역 정리
- Statistics를 4개 한 줄 숫자 중심 카드로 재정리했다.
  - HCP
  - AVG
  - LAST
  - BEST
- Home의 Quick Menu, Upcoming Round, Recent Round, Community, Theme 섹션은 Home v3 철학에 맞춰 노출하지 않도록 정리했다.

## Fixed
- 버튼 텍스트가 `A...`, `조...`, `L...`처럼 과도하게 잘리던 문제를 완화했다.
- Concierge 카드에서 Greeting과 안내 문구가 한 줄에서 잘리는 문제를 개선했다.
- Bottom Navigation과 Stats가 겹치지 않도록 하단 여백을 조정했다.

## DB
- DB 변경 없음.

## Verified
- 변경 파일 기준 TypeScript transpile syntax check 통과.
- 전체 `tsc --noEmit`은 실행 시간이 길어 제한 시간 내 완료되지 못했다.

## Preserved
- 기존 Navigation 구조 유지.
- 기존 DB Schema 유지.
- CaddieBook / AI Shot Plan 로직 변경 없음.


# CHANGELOG - Home v3.10 No Scroll Balance Polish

## Changed
- Home 화면에서 기록 4개 카드가 하단 Navigation에 가려지지 않도록 전체 높이 균형을 재조정했다.
- Hero 카드 높이를 compact하게 줄이면서 하단 4개 정보(날씨 / 바람 / 예상 소요 / 출발 추천)는 유지했다.
- Gogo Concierge 카드를 더 작고 명확하게 재정리했다.
  - 캐릭터 크기 축소
  - Greeting 폰트 축소
  - 버튼 높이 축소
  - AI 한줄 코멘트 1줄 고정
- Statistics 영역을 화면 안에 보이도록 compact 유지했다.

## Removed
- HeroInfo에서 중복 렌더링되던 label 텍스트를 제거했다.

## DB
- DB 변경 없음.

## Verified
- Home 변경 파일 4개 TypeScript transpile syntax check 통과.
- 전체 `tsc --noEmit`은 제한 시간 내 완료되지 않아 완료 검증하지 못함.
