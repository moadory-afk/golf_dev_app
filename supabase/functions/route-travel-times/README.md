# route-travel-times

지도 앱별 예상 이동시간 중 브라우저에서 직접 호출하기 어려운 외부 길찾기 API를 서버에서 대신 호출하는 Edge Function입니다.

## 현재 역할

- NAVER Directions 5 API를 호출해 자동차 예상 이동시간을 분 단위로 반환합니다.
- 앱에서는 `supabase.functions.invoke("route-travel-times")`로 호출합니다.
- 실패해도 앱 화면이 깨지지 않도록 `{ naver: null }`을 반환합니다.

## 필요한 Secrets

Supabase Dashboard > Edge Functions > Secrets에 아래 값을 등록합니다.

```text
NAVER_MAPS_CLIENT_ID=네이버 Client ID
NAVER_MAPS_CLIENT_SECRET=네이버 Client Secret
```

프론트엔드/Vercel에는 네이버 `Client Secret`을 넣지 않습니다.

## Dashboard 배포

1. Supabase Dashboard에서 `Edge Functions`로 이동합니다.
2. `route-travel-times` 함수를 생성합니다.
3. `index.ts` 내용을 붙여넣고 배포합니다.
4. Function Settings에서 JWT 검증은 기본 ON이어도 됩니다. 앱의 Supabase client가 anon key로 호출합니다.

## 테스트 Body

```json
{
  "origin": { "latitude": 37.5665, "longitude": 126.9780 },
  "destination": { "latitude": 37.3596, "longitude": 127.1054 }
}
```
