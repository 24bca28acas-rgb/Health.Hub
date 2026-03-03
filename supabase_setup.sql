
-- 1. Create the 'profiles' table (Adapted for Healthy.hub Web App)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  name text,
  avatar_url text,
  metrics jsonb, -- Stores height, weight, age, etc.
  goals jsonb,   -- Stores step, calorie, distance goals
  current_streak int default 0,
  daily_step_goal int default 10000,
  weight float,
  height float,
  bmi float,
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security (CRITICAL for "Save & Start")
alter table public.profiles enable row level security;

-- 3. Policy: Allow users to INSERT their own profile
-- This fixes the "Save & Start" button error
create policy "Enable insert for authenticated users only"
on public.profiles for insert
with check ( auth.uid() = id );

-- 4. Policy: Allow users to SELECT their own profile
-- This fixes the Dashboard loading loop
create policy "Enable read access for owning user"
on public.profiles for select
using ( auth.uid() = id );

-- 5. Policy: Allow users to UPDATE their own profile
-- This allows updating metrics/goals later
create policy "Enable update for owning user"
on public.profiles for update
using ( auth.uid() = id );
