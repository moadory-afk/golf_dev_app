# NEXT - Home Weather Dedup

## 다음 확인 필요
- Expo 실행 후 Hero 날씨/기온/풍속이 실제 라운드에 표시되는지 확인
- `.env`의 `EXPO_PUBLIC_OPENWEATHER_API_KEY`가 Expo 런타임에 정상 주입되는지 확인
- 5일 이후 라운드는 무료 5일 예보 범위를 벗어나 fallback 되는지 확인

## 다음 개발 후보
1. 골프장 위도/경도 DB 저장으로 Geocoding 호출 제거
2. `src/lib/weather.ts`의 캐시 키를 골프장/날짜/시간 기준으로 더 정교화
3. 강수확률, 풍향, 우산/바람주의 AI 멘트 추가
4. 날씨 실패 시 사용자에게 노출되지 않는 개발 로그 추가

## 주의
- 날씨 기능의 단일 진입점은 `src/lib/weather.ts`로 유지
- Home Repository 안에 OpenWeather 직접 호출 로직을 다시 만들지 않기
- DB 변경 없음
