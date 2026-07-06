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

---

# Home v4.0 Step 5 - Hero Fixed Display Ratio

## Changed
- Home Hero 표시 규격을 앱 내부 고정 비율로 정리했다.
- Hero 원본 이미지는 여유 있는 비율로 보유하되, 앱 표시 영역은 `16:10.5` 기준으로 출력한다.
- Hero 카드 높이를 고정 숫자가 아니라 카드 폭 기준 `height = width × 10.5 / 16`으로 계산한다.
- Hero 이미지는 표시 카드 영역에 `resizeMode="cover"`로 맞춰 출력한다.
- Hero 내부 텍스트와 하단 정보 스트립을 축소된 표시 영역에 맞게 compact 조정했다.

## DB
- DB 변경 없음.
