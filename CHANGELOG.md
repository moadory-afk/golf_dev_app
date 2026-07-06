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

# CHANGELOG - Home Layout Engine v3.11

## Added
- Home 전용 Slot 기반 Layout Engine 1차 도입.
  - `HomeLayoutDefinition`
  - `HomeLayoutRenderer`
  - `premiumGolfHomeLayout`
- Home 화면을 데이터 슬롯 중심으로 렌더링하도록 정리.
- 향후 스킨이 색/폰트뿐 아니라 섹션 순서, 슬롯 위치, 표시 여부까지 바꿀 수 있는 기반 추가.

## Changed
- Home 구조를 `Hero → Concierge → Stats` 중심으로 단순화.
- Hero와 Concierge 사이를 곡선 Wave 레이어로 시각적으로 연결.
- Header는 클럽 선택, 공지, 프로필 중심으로 정리.
- Concierge 카드에는 인사, 라운드 준비 안내, `AI 캐디북 / 조편성 / Lotto` 액션을 배치.
- Stats는 4개 지표 한 줄 compact 표시로 정리.
- 기록 숫자는 소수점 이하 절상 후 정수만 표시.
- 평균/최근/베스트 스코어의 `타` 단위 표시 제거.

## DB
- DB 변경 없음.

## Verified
- Home 변경 파일 기준 TypeScript 부분 검증 통과.
- 전체 TypeScript 검증은 프로젝트 전체 검사 시간이 제한을 초과하여 완료하지 못함.
