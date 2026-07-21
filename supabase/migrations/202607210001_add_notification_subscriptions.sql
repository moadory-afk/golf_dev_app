create table if not exists public.notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null,
  channel text not null default 'web' check (channel in ('web', 'native')),
  endpoint text not null,
  p256dh text,
  auth text,
  platform text,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, club_id, channel, endpoint)
);

create index if not exists notification_subscriptions_club_enabled_idx
on public.notification_subscriptions (club_id, enabled);

create index if not exists notification_subscriptions_user_club_idx
on public.notification_subscriptions (user_id, club_id);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_logs_club_created_at_idx
on public.notification_logs (club_id, created_at desc);

alter table public.notification_subscriptions enable row level security;
alter table public.notification_logs enable row level security;

drop policy if exists "members can read own notification subscriptions" on public.notification_subscriptions;
create policy "members can read own notification subscriptions"
on public.notification_subscriptions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "members can insert own notification subscriptions" on public.notification_subscriptions;
create policy "members can insert own notification subscriptions"
on public.notification_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.club_members cm
    where cm.club_id = notification_subscriptions.club_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "members can update own notification subscriptions" on public.notification_subscriptions;
create policy "members can update own notification subscriptions"
on public.notification_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.club_members cm
    where cm.club_id = notification_subscriptions.club_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "members can delete own notification subscriptions" on public.notification_subscriptions;
create policy "members can delete own notification subscriptions"
on public.notification_subscriptions
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "members can read own notification logs" on public.notification_logs;
create policy "members can read own notification logs"
on public.notification_logs
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "admins can read club notification logs" on public.notification_logs;
create policy "admins can read club notification logs"
on public.notification_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = notification_logs.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
);
