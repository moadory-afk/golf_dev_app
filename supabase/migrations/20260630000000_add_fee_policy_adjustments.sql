create table if not exists public.club_fee_policy_adjustments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  member_user_id uuid not null,
  adjustment_type text not null check (adjustment_type in ('contribution', 'discount')),
  amount integer not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, member_user_id, adjustment_type)
);

create index if not exists idx_club_fee_policy_adjustments_club_id
  on public.club_fee_policy_adjustments(club_id);

create index if not exists idx_club_fee_policy_adjustments_member_user_id
  on public.club_fee_policy_adjustments(member_user_id);

alter table public.club_fee_policy_adjustments enable row level security;

drop policy if exists "club_fee_policy_adjustments_select" on public.club_fee_policy_adjustments;
create policy "club_fee_policy_adjustments_select"
on public.club_fee_policy_adjustments
for select
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_policy_adjustments.club_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "club_fee_policy_adjustments_admin_write" on public.club_fee_policy_adjustments;
create policy "club_fee_policy_adjustments_admin_write"
on public.club_fee_policy_adjustments
for all
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_policy_adjustments.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_fee_policy_adjustments.club_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  )
);
