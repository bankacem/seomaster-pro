-- SEOMaster Pro database schema for Supabase/Postgres.
-- Run this migration in the Supabase SQL editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  credits integer not null default 5 check (credits >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  url text,
  score integer not null check (score between 0 and 100),
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  title text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan text not null default 'free',
  status text not null default 'inactive',
  period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  tokens_used integer not null default 0 check (tokens_used >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analyses_user_id_idx on public.analyses(user_id);
create index if not exists analyses_created_at_idx on public.analyses(created_at desc);
create index if not exists reports_user_id_idx on public.reports(user_id);
create index if not exists reports_created_at_idx on public.reports(created_at desc);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_created_at_idx on public.subscriptions(created_at desc);
create index if not exists usage_logs_user_id_idx on public.usage_logs(user_id);
create index if not exists usage_logs_created_at_idx on public.usage_logs(created_at desc);

 drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.reports enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_logs enable row level security;

drop policy if exists "Users can view their profile" on public.profiles;
create policy "Users can view their profile" on public.profiles
for select using (auth.uid() = id);
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can view their analyses" on public.analyses;
create policy "Users can view their analyses" on public.analyses
for select using (auth.uid() = user_id);
drop policy if exists "Users can create their analyses" on public.analyses;
create policy "Users can create their analyses" on public.analyses
for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete their analyses" on public.analyses;
create policy "Users can delete their analyses" on public.analyses
for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their reports" on public.reports;
create policy "Users can view their reports" on public.reports
for select using (auth.uid() = user_id);
drop policy if exists "Users can create their reports" on public.reports;
create policy "Users can create their reports" on public.reports
for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete their reports" on public.reports;
create policy "Users can delete their reports" on public.reports
for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their subscriptions" on public.subscriptions;
create policy "Users can view their subscriptions" on public.subscriptions
for select using (auth.uid() = user_id);

drop policy if exists "Users can view their usage logs" on public.usage_logs;
create policy "Users can view their usage logs" on public.usage_logs
for select using (auth.uid() = user_id);
drop policy if exists "Users can create their usage logs" on public.usage_logs;
create policy "Users can create their usage logs" on public.usage_logs
for insert with check (auth.uid() = user_id);
