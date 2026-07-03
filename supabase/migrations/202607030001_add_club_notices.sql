create table if not exists public.club_notices (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  title text not null,
  body text not null default '',
  is_published boolean not null default true,
  is_important boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_notices_club_id_created_at_idx
on public.club_notices (club_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'club_notices'
  ) then
    alter publication supabase_realtime add table public.club_notices;
  end if;
end $$;

alter table public.club_notices enable row level security;

drop policy if exists "club members can read published notices" on public.club_notices;
create policy "club members can read published notices"
on public.club_notices
for select
to authenticated
using (
  is_published = true
  and exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_notices.club_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "admins can read all notices" on public.club_notices;
create policy "admins can read all notices"
on public.club_notices
for select
to authenticated
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_notices.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
);

drop policy if exists "admins can insert notices" on public.club_notices;
create policy "admins can insert notices"
on public.club_notices
for insert
to authenticated
with check (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_notices.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
);

drop policy if exists "admins can update notices" on public.club_notices;
create policy "admins can update notices"
on public.club_notices
for update
to authenticated
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_notices.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_notices.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
);

drop policy if exists "admins can delete notices" on public.club_notices;
create policy "admins can delete notices"
on public.club_notices
for delete
to authenticated
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_notices.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
);
