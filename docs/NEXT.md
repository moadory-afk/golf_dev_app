# NEXT - Home Weather Acquisition

## 다음 확인 필요
- `.env` 또는 Expo 환경변수에 `EXPO_PUBLIC_OPENWEATHER_API_KEY` 설정
- 실제 기기/Expo에서 Hero 날씨, 기온, 풍속 표시 확인
- 5일 이후 라운드의 경우 OpenWeather 무료 5일 예보 범위를 벗어나 `날씨 준비중`으로 표시되는지 확인

## 다음 개발 후보
1. 골프장 좌표를 DB에 저장해 Geocoding 호출을 줄이기
2. 날씨 API 응답을 AsyncStorage 또는 Supabase Edge Function으로 캐싱
3. 풍향, 강수확률, 체감온도 표시 확장
4. 추천 출발시간 계산에 날씨/풍속 반영

## 주의
- DB 변경 없음
- API Key 미설정 시 날씨 표시가 실패가 아니라 정상 fallback으로 처리됨
- Home Hero는 예정 라운드 시간 기준 예보를 우선 사용


## Next - Home v3 Polish

- 실제 기기에서 Hero 하단 곡선과 캐디 카드 notch의 겹침 정도 확인.
- 클럽이 4개 이상일 때 클럽 선택 모달 스크롤 처리 필요 여부 점검.
- Android 상태바/상단 inset에서 Hero full bleed 유지 여부 확인.
