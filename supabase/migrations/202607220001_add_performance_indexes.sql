do $$
begin
  if to_regclass('public.rounds') is not null then
    execute 'create index if not exists rounds_club_date_desc_idx on public.rounds (club_id, date desc)';
    execute 'create index if not exists rounds_club_schedule_idx on public.rounds (club_id, schedule_id) where schedule_id is not null';
  end if;

  if to_regclass('public.club_round_schedules') is not null then
    execute 'create index if not exists club_round_schedules_club_date_time_idx on public.club_round_schedules (club_id, round_date, tee_time)';
    execute 'create index if not exists club_round_schedules_club_status_date_idx on public.club_round_schedules (club_id, status, round_date)';
  end if;

  if to_regclass('public.club_round_groups') is not null then
    execute 'create index if not exists club_round_groups_schedule_group_no_idx on public.club_round_groups (schedule_id, group_no)';
  end if;

  if to_regclass('public.club_round_group_members') is not null then
    execute 'create index if not exists club_round_group_members_schedule_sort_idx on public.club_round_group_members (schedule_id, sort_order)';
    execute 'create index if not exists club_round_group_members_group_sort_idx on public.club_round_group_members (group_id, sort_order)';
  end if;

  if to_regclass('public.club_round_attendances') is not null then
    execute 'create index if not exists club_round_attendances_schedule_member_idx on public.club_round_attendances (schedule_id, member_user_id)';
  end if;

  if to_regclass('public.club_members') is not null then
    execute 'create index if not exists club_members_club_user_idx on public.club_members (club_id, user_id)';
  end if;

  if to_regclass('public.round_lotto_entries') is not null then
    execute 'create index if not exists round_lotto_entries_schedule_user_idx on public.round_lotto_entries (schedule_id, user_id)';
  end if;

  if to_regclass('public.round_lotto_draws') is not null then
    execute 'create index if not exists round_lotto_draws_schedule_idx on public.round_lotto_draws (schedule_id)';
  end if;

  if to_regclass('public.golf_course_season_images') is not null then
    execute 'create index if not exists golf_course_season_images_active_course_season_idx on public.golf_course_season_images (golf_course_id, season) where is_active = true';
  end if;

  if to_regclass('public.course_layouts') is not null then
    execute 'create index if not exists course_layouts_course_idx on public.course_layouts (golf_course_id)';
  end if;
end $$;
