# send-notification

클럽 공지사항과 캐디 시스템 알림을 웹 푸시로 발송하는 Supabase Edge Function입니다.

## 필요한 환경변수

앱 빌드 환경:

```bash
EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=...
```

Supabase Edge Function secret:

```bash
WEB_PUSH_VAPID_PUBLIC_KEY=...
WEB_PUSH_VAPID_PRIVATE_KEY=...
WEB_PUSH_VAPID_SUBJECT=mailto:admin@gogopar.app
```

## 배포

```bash
supabase functions deploy send-notification --project-ref <project-ref> --use-api
supabase secrets set WEB_PUSH_VAPID_PUBLIC_KEY=... WEB_PUSH_VAPID_PRIVATE_KEY=... WEB_PUSH_VAPID_SUBJECT=mailto:admin@gogopar.app --project-ref <project-ref>
```

## 요청 예시

```ts
await supabase.functions.invoke('send-notification', {
  body: {
    clubId,
    type: 'notice',
    title: '새 공지사항',
    body: '7월 정기 라운드 조편성이 등록되었습니다.',
    data: { type: 'notice', clubId, noticeId },
  },
})
```
