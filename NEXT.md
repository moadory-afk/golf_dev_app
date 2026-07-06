# NEXT - After Home v3.9 Premium Polish

## Next Sprint

Home v4.0 Data Quality & Runtime Polish

## Goal

Home의 시각 구조가 정리되었으므로, 실제 데이터 품질과 런타임 안정성을 높인다.

## Planned Work

1. 실제 기기 화면 확인
   - 작은 화면에서 스크롤 없이 들어오는지 확인
   - Bottom Navigation과 Stats 겹침 확인
   - Hero / Concierge / Stats 높이 재조정

2. Hero 데이터 고도화
   - 날씨 API 실패 시 fallback 문구 정리
   - 풍속 표기 통일
   - 이동시간과 출발 추천시간 실제 연동 검토

3. Concierge 상태 모델 정리
   - 예정 라운드 없음
   - 출발 전
   - 당일 라운드
   - 라운드 후

4. Home Runtime Check
   - `getHomeDashboardRawData` 로딩 흐름 확인
   - 오류 카드 노출 조건 확인
   - 빈 데이터 상태 확인

## DB

- DB 변경 없음.
- 이동시간/추천 출발시간을 서버 저장하려면 별도 SQL 승인 후 진행.


# NEXT - After Home v3.10

## Next Sprint
Home v3.11 Device Fit QA

## Goal
여러 화면 높이에서 Home이 실제로 스크롤 없이 보이는지 확인하고, 작은 기기 기준으로 최종 미세 조정한다.

## Planned Work
- iPhone SE급 / 일반 iPhone / Android 기준 화면 높이 확인
- Bottom Navigation과 Stats 겹침 여부 확인
- Hero 4개 정보 가독성 확인
- Concierge 버튼 라벨 잘림 여부 확인
- 필요 시 기기 높이별 responsive height 적용
