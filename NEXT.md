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

---

## Next - Hero Source Prompt / DB Image Pipeline

- Hero 원본 이미지 생성 프롬프트를 `16:12 source → 16:10.5 display crop` 기준으로 정리한다.
- 골프장별 `hero_image_url` 저장 구조를 점검한다.
- 필요 시 이미지 메타데이터(`focus_x`, `focus_y`)는 다음 단계에서 검토한다.
