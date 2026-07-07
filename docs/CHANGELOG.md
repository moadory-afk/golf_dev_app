# CHANGELOG - Home Weather Acquisition v3.0 Phase 2

## Added
- Home Dashboard에서 예정 라운드별 날씨 정보를 OpenWeather 5일 예보 API 기준으로 입수하는 구조를 추가했다.
- 라운드 날짜와 Tee Off 시간에 가장 가까운 예보 슬롯을 선택해 Hero에 표시하도록 연결했다.
- 라운드별 날씨 캐시 키 역할을 하는 `weatherByScheduleId` 데이터를 Home raw data에 추가했다.

## Changed
- 기존 Home 날씨 로직은 현재 날씨 기준이었으나, Home Hero 목적에 맞게 예정 라운드 시간 기준 예보로 변경했다.
- `homeService`에 중복 구현되어 있던 날씨/Raw Data 조회 코드를 제거하고 `homeRepository.getHomeDashboardRawData`를 사용하도록 정리했다.
- `homeMapper`가 하드코딩된 `날씨 준비중 / --° / 풍속 준비중` 대신 실제 입수된 날씨 스냅샷을 우선 사용하도록 변경했다.

## Files
- `src/features/home/api/homeRepository.ts`
- `src/features/home/services/homeService.ts`
- `src/features/home/mappers/homeMapper.ts`
- `docs/CHANGELOG.md`
- `docs/NEXT.md`
- `docs/PROJECT_STATUS.md`

## Env
- `EXPO_PUBLIC_OPENWEATHER_API_KEY`가 설정되어 있어야 실제 날씨가 표시된다.
- API Key가 없거나 API 호출이 실패하면 기존처럼 `날씨 준비중` 상태를 유지한다.

## DB
- 변경 없음

## Verified
- 업로드된 `src.zip`, `docs.zip` 기준으로 실제 파일 수정 완료
- 프로젝트 루트의 `package.json`, `tsconfig.json`이 제공되지 않아 전체 `tsc --noEmit` 검증은 실행하지 못함

## Preserved
- Hero Carousel 구조 유지
- Statistics 구조 유지
- AI Caddie Card 구조 유지
- DB Schema 변경 없음


## 2026-07-07 - Home v3 Hero Curve + Club Picker Fix

### Changed
- Hero 카드 하단을 라운드 처리하여 아래로 볼록하게 보이도록 조정.
- 캐디 카드 상단에 Hero 곡선과 맞물리는 오목한 notch 처리를 추가.
- Home 상단 클럽 선택 버튼 클릭 시 클럽 메뉴로 이동하지 않고 클럽 선택 모달을 표시하도록 수정.
- 클럽 선택 시 `setActiveClub`로 현재 클럽을 변경하고 Home 데이터가 선택 클럽 기준으로 다시 로드되도록 연결.
- Hero 하단 요약 영역은 골프장명, 온도, 풍속, D-Day, 날짜, 전반 코스와 Tee Off를 표시하도록 정리.

### Notes
- DB 변경 없음.
