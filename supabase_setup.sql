-- Elite Fitness Ecosystem schema bootstrap

-- 1) Core profile table (supports onboarding calibration + backward compatibility)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  name text,
  display_name text,
  avatar_url text,
  metrics jsonb,
  goals jsonb,
  current_streak int default 0,
  daily_step_goal int default 10000,
  weight float,
  height float,
  dob date,
  gender text,
  primary_goal text,
  activity_level text,
  bmi float,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Daily activity stream table for dashboard + GPS + hydration protocol
create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  activity_date date not null default current_date,
  steps integer not null default 0,
  distance_km numeric(7,3) not null default 0,
  hydration_ml integer not null default 0,
  calories_burned integer not null default 0,
  active_minutes integer not null default 0,
  activity_type text,
  is_target_met boolean not null default false,
  streak_awarded boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(user_id, activity_date)
);

-- 3) Enable RLS
alter table public.profiles enable row level security;
alter table public.daily_activity enable row level security;

-- 4) Profile policies
create policy "Enable insert for authenticated users only"
on public.profiles for insert
with check ( auth.uid() = id );

create policy "Enable read access for owning user"
on public.profiles for select
using ( auth.uid() = id );

create policy "Enable update for owning user"
on public.profiles for update
using ( auth.uid() = id );

-- 5) Daily activity policies
create policy "Enable insert for own daily activity"
on public.daily_activity for insert
with check ( auth.uid() = user_id );

create policy "Enable read for own daily activity"
on public.daily_activity for select
using ( auth.uid() = user_id );

create policy "Enable update for own daily activity"
on public.daily_activity for update
using ( auth.uid() = user_id );
