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

# CHANGELOG - Home Hero Status Bar Full Bleed Fix

## Changed
- Home ScrollView 상단 padding을 제거해 Hero 이미지가 iPhone 상태바 영역부터 시작되도록 수정했다.
- Home 레이아웃에서 Hero 섹션만 좌우 padding 0으로 두고, 나머지 섹션은 기존 20px padding을 유지하도록 분리했다.
- PremiumHomeHeroSection이 `topInset`을 받아 상태바 아래에 상단 버튼을 배치하면서 배경 이미지는 상태바 영역까지 확장되도록 수정했다.
- Hero 카드 radius를 제거하고 명시적 height를 적용해 상단 흰색 Safe Area 배경이 보이지 않도록 조정했다.

## Files
- `src/screens/HomeExperienceScreen.tsx`
- `src/features/home/components/PremiumHomeHeroSection.tsx`
- `src/features/home/layout/HomeLayoutRenderer.tsx`
- `docs/CHANGELOG.md`
- `docs/NEXT.md`
- `docs/PROJECT_STATUS.md`

## Verified
- 업로드된 `src.zip`, `docs.zip` 기준 실제 파일 수정 완료
- 프로젝트 루트의 `package.json`, `tsconfig.json`이 없어 전체 TypeScript 검증은 실행하지 못함
