# NEXT - After AI Shot Plan Polish v2.8.1

## Next Sprint

Tee Shot Feedback v2.9

## Goal

세컨드 샷은 입력하지 않고, 티샷 결과만 입력해 AI Shot Plan을 오늘 컨디션에 맞게 보정한다.

## Planned Work

- 홀별 티샷 결과 입력 UI
- 사용 클럽 선택
- 실제 티샷 거리 입력
- 평소 비거리 대비 차이 계산
- 오늘 컨디션 보정값 생성
- 다음 홀 Shot Plan에 보정값 반영
- 세션 단위 저장 구조 검토

## DB

- v2.9는 우선 로컬 상태 기반으로 진행 가능
- 장기 저장이 필요하면 별도 SQL 승인 후 진행


# NEXT - After Home v3.7 Concierge Visual Polish

## Next Sprint
Home v3.8 Data Reliability

## Goal
Hero의 날씨, 풍속, 이동시간, 출발 추천 시간을 실제 데이터 기반으로 안정화한다.

## Planned Work
- 골프장 좌표 데이터 연결
- OpenWeather 응답과 Hero weather strip 연결
- 이동시간/출발추천 계산 로직 실제 API 또는 설정값 기반으로 분리
- Hero empty state 이미지/문구 정리
- 작은 화면에서 Home 무스크롤 여부 실기기 확인

## Do Not Touch
- DB Schema는 승인 전 변경하지 않는다.
- Authentication / Invite / Payment 변경 없음.
