# route-travel-times

지도 앱별 예상 이동시간을 서버에서 대신 계산하는 Edge Function입니다.

## 현재 역할

- Kakao Mobility Directions API를 호출해 카카오맵 예상 이동시간을 분 단위로 반환합니다.
- TMAP Routes API를 호출해 티맵 예상 이동시간을 분 단위로 반환합니다.
- NAVER Directions 5 API를 호출해 네이버지도 예상 이동시간을 분 단위로 반환합니다.
- 앱에서는 `supabase.functions.invoke("route-travel-times")`로 호출합니다.
- 실패한 앱은 `null`로 반환해 화면이 깨지지 않게 합니다.

## 필요한 Secrets

Supabase Dashboard > Edge Functions > Secrets에 아래 값을 등록합니다.

```text
KAKAO_REST_API_KEY=카카오 REST API Key
TMAP_APP_KEY=티맵 appKey
NAVER_MAPS_CLIENT_ID=네이버 Client ID
NAVER_MAPS_CLIENT_SECRET=네이버 Client Secret
```

프론트엔드/Vercel에는 지도 API Secret을 넣지 않습니다.

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

정상 응답 예시:

```json
{
  "kakao": 42,
  "tmap": 39,
  "naver": 45,
  "errors": {
    "kakao": null,
    "tmap": null,
    "naver": null
  }
}
```
