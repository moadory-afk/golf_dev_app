# send-caddie-feed-notifications

홈 캐디카드에 노출되는 라운드 안내 항목을 웹 푸시로 자동 발송하는 Edge Function입니다.

## 역할

- 오늘부터 3일 뒤까지의 라운드 일정을 확인합니다.
- 홈 캐디카드 기준에 맞는 알림 후보를 만듭니다.
- 조편성 회원을 우선 대상으로 발송하고, 조편성이 없으면 참석 회원에게 발송합니다.
- `notification_logs.data.feedEventId`와 `user_id`를 기준으로 같은 회원에게 같은 항목을 중복 발송하지 않습니다.

## 필요한 Secrets

기존 공지 푸시와 같은 VAPID 값이 필요합니다.

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT`
- `SUPABASE_SERVICE_ROLE_KEY` 또는 `SUPABASE_SECRET_KEYS`
- `CADDIE_FEED_NOTIFICATION_SECRET`

`CADDIE_FEED_NOTIFICATION_SECRET`은 Supabase Cron 또는 Dashboard 테스트에서 함수 호출 권한을 확인하는 별도 비밀값입니다.

## Dashboard 배포

1. Supabase Dashboard에서 `Edge Functions`로 이동합니다.
2. `Deploy a new function` 또는 새 함수 생성에서 이름을 `send-caddie-feed-notifications`로 지정합니다.
3. `index.ts` 내용을 붙여넣고 배포합니다.
4. Function Settings에서 `Verify JWT`는 OFF로 둡니다.
5. Secrets에 위 값을 등록합니다.

## Dashboard 테스트

`Test` 탭에서 아래처럼 요청합니다.

Headers:

```text
Content-Type: application/json
x-auto-notification-secret: CADDIE_FEED_NOTIFICATION_SECRET 값
```

Body:

```json
{
  "dryRun": true
}
```

`dryRun: true`는 후보 개수만 확인하고 실제 푸시는 보내지 않습니다.

실제 발송 테스트:

```json
{
  "dryRun": false
}
```

특정 클럽만 테스트하려면:

```json
{
  "clubId": "클럽 ID",
  "dryRun": false
}
```

## 자동 실행

Supabase Dashboard의 `Integrations > Cron`에서 Job을 만들고 Supabase Edge Function 호출 방식으로 등록합니다.

권장 주기:

```text
*/10 * * * *
```

10분마다 실행하면 티오프 임박 알림과 로또 마감 알림을 놓칠 가능성이 낮습니다. 함수 내부에서 사용자별 중복 발송을 막기 때문에 같은 카드가 반복 전송되지는 않습니다.

HTTP headers에는 아래 값을 포함합니다.

```text
Content-Type: application/json
x-auto-notification-secret: CADDIE_FEED_NOTIFICATION_SECRET 값
```

Body:

```json
{}
```

## 실시간 자동 실행

캐디카드가 새로 생기는 시점에 가깝게 보내려면 Cron 대신 Database Webhook을 사용합니다.

Supabase Dashboard에서 `Database > Webhooks`로 이동한 뒤 아래 테이블마다 Webhook을 만듭니다.

공통 설정:

- Method: `POST`
- URL: `https://mmovqqtwgjfhxhwkqycp.supabase.co/functions/v1/send-caddie-feed-notifications`
- Events: `INSERT`, `UPDATE`, `DELETE`
- Headers:

```text
Content-Type: application/json
x-auto-notification-secret: CADDIE_FEED_NOTIFICATION_SECRET 값
```

등록할 테이블:

- `club_round_schedules`
- `club_round_attendances`
- `club_round_groups`
- `club_round_group_members`
- `round_lotto_entries`
- `round_lotto_draws`
- `rounds`

Webhook payload에 `club_id` 또는 `schedule_id`가 있으면 해당 일정만 다시 계산합니다. `club_round_schedules`는 row의 `id`를 일정 ID로 사용합니다.

권장 운영:

- Database Webhook: 실시간 발송용
- Cron `*/10 * * * *`: 혹시 Webhook이 누락됐을 때를 대비한 보조 안전망

중복 발송은 `notification_logs.data.feedEventId`와 `user_id` 기준으로 막습니다.

## 중복 알림 방지

Database Webhook은 조편성 저장처럼 여러 row가 한 번에 바뀌는 작업에서 여러 번 호출될 수 있습니다.

중복 푸시를 막으려면 아래 두 가지가 함께 적용되어야 합니다.

- `create-webhooks.sql`의 `notification_logs_caddie_feed_once_idx` 유일 인덱스
- Edge Function의 발송 전 `pending` 로그 선점 로직

이미 같은 알림이 여러 번 발송된 로그가 있으면 `create-webhooks.sql`이 인덱스 생성 전에 중복 로그를 1개만 남기고 정리합니다.
