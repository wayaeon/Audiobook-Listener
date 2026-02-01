-- Audibly Web: Supabase schema for catalog (optional), user progress, profiles, and access requests.
-- Run in Supabase SQL Editor after creating your project.
-- Auth is handled by Supabase Auth; this schema is for user_audiobook_progress, profiles, access_requests, and optional audiobooks cache.

-- ========================================
-- PROFILES (first name, last name, role)
-- ========================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Helper: is_admin (security definer bypasses RLS to avoid infinite recursion)
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Trigger: create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========================================
-- ACCESS REQUESTS (request access pre-login)
-- ========================================
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  last_name text,
  status text not null default 'pending' check (status in ('pending', 'invited', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.access_requests enable row level security;

drop policy if exists "Anyone can insert access request" on public.access_requests;
create policy "Anyone can insert access request"
  on public.access_requests for insert
  with check (true);

drop policy if exists "Admins can select access requests" on public.access_requests;
create policy "Admins can select access requests"
  on public.access_requests for select
  using (public.is_admin());

drop policy if exists "Admins can update access requests" on public.access_requests;
create policy "Admins can update access requests"
  on public.access_requests for update
  using (public.is_admin());

-- ========================================
-- USER PROGRESS (per-user, per-audiobook playback state)
-- ========================================
create table if not exists public.user_audiobook_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audiobook_id text not null,
  current_position_ticks bigint not null default 0,
  current_file_index int not null default 0,
  playback_speed double precision not null default 1.0,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, audiobook_id)
);

-- Add started_at / finished_at if table already existed
alter table public.user_audiobook_progress add column if not exists started_at timestamptz;
alter table public.user_audiobook_progress add column if not exists finished_at timestamptz;

-- RLS: users can only read/write their own progress
alter table public.user_audiobook_progress enable row level security;

drop policy if exists "Users can read own progress" on public.user_audiobook_progress;
create policy "Users can read own progress"
  on public.user_audiobook_progress for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own progress" on public.user_audiobook_progress;
create policy "Users can insert own progress"
  on public.user_audiobook_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own progress" on public.user_audiobook_progress;
create policy "Users can update own progress"
  on public.user_audiobook_progress for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own progress" on public.user_audiobook_progress;
create policy "Users can delete own progress"
  on public.user_audiobook_progress for delete
  using (auth.uid() = user_id);

-- Optional: cache audiobook metadata from OneDrive (filled by API sync job)
-- Uncomment if you want to store catalog in Supabase instead of listing OneDrive on every request.
/*
create table if not exists public.audiobooks (
  id text primary key,
  title text not null,
  author text not null default '',
  description text,
  duration bigint not null default 0,
  cover_url text,
  thumbnail_url text,
  source_file_ids jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.audiobooks enable row level security;

create policy "Authenticated users can read catalog"
  on public.audiobooks for select
  to authenticated
  using (true);
*/
