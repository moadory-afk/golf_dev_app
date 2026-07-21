-- 같은 사용자/클럽/web 채널에서는 최신 푸시 구독 1개만 enabled 상태로 유지합니다.
-- 오래된 endpoint가 먼저 선택되어 현재 휴대폰으로 알림이 안 가는 문제를 방지합니다.

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, club_id, channel
      order by last_seen_at desc nulls last, updated_at desc nulls last, created_at desc
    ) as row_no
  from public.notification_subscriptions
  where enabled = true
)
update public.notification_subscriptions ns
set
  enabled = false,
  updated_at = now()
from ranked r
where ns.id = r.id
  and r.row_no > 1;

create or replace function public.disable_stale_enabled_notification_subscriptions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.enabled = true then
    update public.notification_subscriptions
    set
      enabled = false,
      updated_at = now()
    where user_id = new.user_id
      and club_id = new.club_id
      and channel = new.channel
      and id <> new.id
      and enabled = true;
  end if;

  return new;
end;
$$;

drop trigger if exists notification_subscriptions_disable_stale_enabled
on public.notification_subscriptions;

create trigger notification_subscriptions_disable_stale_enabled
after insert or update of enabled, last_seen_at, updated_at
on public.notification_subscriptions
for each row
execute function public.disable_stale_enabled_notification_subscriptions();
