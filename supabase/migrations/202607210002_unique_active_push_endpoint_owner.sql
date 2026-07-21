create or replace function public.disable_stale_notification_endpoint_owners()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.enabled is true then
    update public.notification_subscriptions
    set
      enabled = false,
      updated_at = now()
    where club_id = new.club_id
      and channel = new.channel
      and endpoint = new.endpoint
      and user_id <> new.user_id
      and enabled is true;
  end if;

  return new;
end;
$$;

drop trigger if exists notification_subscriptions_disable_stale_endpoint_owners
on public.notification_subscriptions;

create trigger notification_subscriptions_disable_stale_endpoint_owners
before insert or update of user_id, club_id, channel, endpoint, enabled
on public.notification_subscriptions
for each row
execute function public.disable_stale_notification_endpoint_owners();
