-- Orbit Translator — Supabase Schema

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  role text,
  staff_id text,
  pharmacy text,
  preferred_language text default 'Dutch (Flemish)',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Sessions table
create table if not exists public.sessions (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references public.profiles(id) on delete set null,
  staff_language text not null,
  guest_language text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  audio_path text
);

alter table public.sessions enable row level security;

create policy "Users can read own sessions" on public.sessions
  for select using (auth.uid() = staff_id);

create policy "Users can insert own sessions" on public.sessions
  for insert with check (auth.uid() = staff_id);

create policy "Users can update own sessions" on public.sessions
  for update using (auth.uid() = staff_id);

-- Translations table
create table if not exists public.translations (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade,
  speaker text not null check (speaker in ('staff', 'guest')),
  original_text text not null,
  translated_text text not null,
  created_at timestamptz default now()
);

alter table public.translations enable row level security;

create policy "Users can read own translations" on public.translations
  for select using (
    exists (select 1 from public.sessions s where s.id = session_id and s.staff_id = auth.uid())
  );

create policy "Users can insert own translations" on public.translations
  for insert with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.staff_id = auth.uid())
  );

-- Storage bucket for audio recordings
insert into storage.buckets (id, name, public) values ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "Users can upload own recordings" on storage.objects
  for insert with check (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read own recordings" on storage.objects
  for select using (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name))[1]);
