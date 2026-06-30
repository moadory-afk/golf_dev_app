create table if not exists public.club_fee_policies (
  club_id uuid primary key,
  fee_mode text not null check (fee_mode in ('monthly', 'yearly')),
  default_amount integer not null default 0,
  visibility text not null default 'members' check (visibility in ('admin_only', 'members')),
  auto_create_cycles boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_fee_cycles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  cycle_key text not null,
  label text not null,
  fee_year integer not null,
  fee_month integer,
  amount integer not null default 0,
  due_date date,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (club_id, cycle_key)
);

create table if not exists public.club_fee_member_statuses (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  cycle_id uuid not null references public.club_fee_cycles(id) on delete cascade,
  member_user_id uuid not null,
  amount_due integer not null default 0,
  amount_paid integer not null default 0,
  status text not null default 'unpaid' check (status in ('paid', 'partial', 'unpaid')),
  memo text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (cycle_id, member_user_id)
);

create table if not exists public.club_treasury_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  entry_type text not null check (entry_type in ('income', 'expense')),
  title text not null,
  amount integer not null check (amount > 0),
  entry_date date not null default current_date,
  memo text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_club_fee_cycles_club_id on public.club_fee_cycles(club_id);
create index if not exists idx_club_fee_member_statuses_cycle_id on public.club_fee_member_statuses(cycle_id);
create index if not exists idx_club_fee_member_statuses_member_user_id on public.club_fee_member_statuses(member_user_id);
create index if not exists idx_club_treasury_entries_club_id on public.club_treasury_entries(club_id);
create index if not exists idx_club_treasury_entries_entry_date on public.club_treasury_entries(entry_date desc);

alter table public.club_fee_policies enable row level security;
alter table public.club_fee_cycles enable row level security;
alter table public.club_fee_member_statuses enable row level security;
alter table public.club_treasury_entries enable row level security;

drop policy if exists "club_fee_policies_select" on public.club_fee_policies;
create policy "club_fee_policies_select"
on public.club_fee_policies
for select
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_policies.club_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "club_fee_policies_admin_write" on public.club_fee_policies;
create policy "club_fee_policies_admin_write"
on public.club_fee_policies
for all
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_policies.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_policies.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
);

drop policy if exists "club_fee_cycles_select" on public.club_fee_cycles;
create policy "club_fee_cycles_select"
on public.club_fee_cycles
for select
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_cycles.club_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "club_fee_cycles_admin_write" on public.club_fee_cycles;
create policy "club_fee_cycles_admin_write"
on public.club_fee_cycles
for all
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_cycles.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_cycles.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
);

drop policy if exists "club_fee_member_statuses_select" on public.club_fee_member_statuses;
create policy "club_fee_member_statuses_select"
on public.club_fee_member_statuses
for select
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_member_statuses.club_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "club_fee_member_statuses_admin_write" on public.club_fee_member_statuses;
create policy "club_fee_member_statuses_admin_write"
on public.club_fee_member_statuses
for all
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_member_statuses.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_member_statuses.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
);

drop policy if exists "club_treasury_entries_select" on public.club_treasury_entries;
create policy "club_treasury_entries_select"
on public.club_treasury_entries
for select
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_treasury_entries.club_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "club_treasury_entries_admin_write" on public.club_treasury_entries;
create policy "club_treasury_entries_admin_write"
on public.club_treasury_entries
for all
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_treasury_entries.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_treasury_entries.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
);
