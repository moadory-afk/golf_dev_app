# CHANGELOG - Home Weather Dedup v3.0 Phase 2

## Changed
- Home 날씨 API 호출 로직을 `src/lib/weather.ts`로 단일화했다.
- `homeRepository.ts` 내부에 중복 구현되어 있던 OpenWeather Geocoding/Forecast 직접 호출 로직을 제거했다.
- Home Repository는 이제 `getOpenWeatherForRound()` 결과를 `HomeWeatherSnapshot` 형태로 변환해서 Mapper에 전달한다.

## Preserved
- `EXPO_PUBLIC_OPENWEATHER_API_KEY` 환경변수 사용 유지
- 라운드 날짜 + Tee Off 시간 기준 예보 선택 유지
- API Key 없거나 호출 실패 시 `날씨 준비중 / --° / 풍속 준비중` fallback 유지
- DB 변경 없음

## Files
- `src/features/home/api/homeRepository.ts`
- `docs/CHANGELOG.md`
- `docs/NEXT.md`
- `docs/PROJECT_STATUS.md`

## Verified
- 업로드된 `src.zip`, `docs.zip` 기준 실제 파일 수정 완료
- `homeRepository.ts` TS transpile 문법 진단 오류 없음
- 전체 프로젝트 루트의 `package.json`, `tsconfig.json`이 제공되지 않아 전체 `tsc --noEmit` 검증은 실행하지 못함
