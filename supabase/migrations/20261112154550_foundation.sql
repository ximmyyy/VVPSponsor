-- Fase 1: clubconfiguratie, profiel en afgeschermde autorisatiebron.
-- Geen accounts, sponsoren, bedrijfsmachtigingen of productieseeds.
create schema private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke create on schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

create type private.app_role as enum ('super_admin', 'sponsorcommissie', 'clubbestuur', 'sponsor');

create table private.user_access (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role private.app_role not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.user_access enable row level security;
revoke all on private.user_access from public, anon, authenticated;

-- Helper zonder parameters: uitsluitend de actuele eigen rol.
-- De eigenaar leest de private bron zonder recursieve RLS; geen schrijfbevoegdheid.
create function private.current_app_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select role::text from private.user_access
  where user_id = (select auth.uid()) and is_active;
$$;
revoke all on function private.current_app_role() from public, anon, authenticated;
grant execute on function private.current_app_role() to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create table public.club_settings (
  id boolean primary key default true check (id),
  club_name text not null check (length(btrim(club_name)) between 1 and 120),
  locale text not null default 'nl-NL' check (locale = 'nl-NL'),
  timezone text not null default 'Europe/Amsterdam' check (timezone = 'Europe/Amsterdam'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.club_settings enable row level security;
revoke all on public.club_settings from public, anon, authenticated;
grant select on public.club_settings to authenticated;
grant update (club_name) on public.club_settings to authenticated;
create policy club_settings_read on public.club_settings for select to authenticated
  using ((select private.current_app_role()) is not null);
create policy club_settings_update on public.club_settings for update to authenticated
  using ((select private.current_app_role()) = 'super_admin')
  with check ((select private.current_app_role()) = 'super_admin');

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from public, anon, authenticated;
grant select on public.user_profiles to authenticated;
grant update (display_name) on public.user_profiles to authenticated;
create policy user_profiles_read on public.user_profiles for select to authenticated
  using ((select private.current_app_role()) is not null
    and (user_id = (select auth.uid()) or (select private.current_app_role()) = 'super_admin'));
create policy user_profiles_update on public.user_profiles for update to authenticated
  using (user_id = (select auth.uid()) and (select private.current_app_role()) is not null)
  with check (user_id = (select auth.uid()) and (select private.current_app_role()) is not null);

create trigger club_settings_updated before update on public.club_settings
  for each row execute function private.set_updated_at();
create trigger user_profiles_updated before update on public.user_profiles
  for each row execute function private.set_updated_at();
create trigger user_access_updated before update on private.user_access
  for each row execute function private.set_updated_at();

comment on table private.user_access is 'Vertrouwde autorisatiebron; geen directe Data API-toegang, ook niet voor Super Admin. Beheerworkflow volgt in fase 3.';
comment on table public.club_settings is 'Alleen niet-geheime clubinstellingen; publieke brandingprojectie volgt na goedkeuring in fase 2/10.';
