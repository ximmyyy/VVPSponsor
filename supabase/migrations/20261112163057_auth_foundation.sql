-- Minimale bedrijfsidentiteit; CRM-velden volgen pas in fase 4.
create table public.sponsors (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 160),
 created_at timestamptz not null default now()
);
alter table public.sponsors enable row level security;
revoke all on public.sponsors from public,anon,authenticated;
grant select on public.sponsors to authenticated;
create table private.sponsor_memberships (
 user_id uuid primary key references private.user_access(user_id) on delete restrict,
 sponsor_id uuid not null references public.sponsors(id) on delete restrict,
 is_active boolean not null default false,
 created_at timestamptz not null default now()
);
create index on private.sponsor_memberships(sponsor_id);
alter table private.sponsor_memberships enable row level security;
revoke all on private.sponsor_memberships from public,anon,authenticated;
create function private.can_access_sponsor(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(private.current_app_role() in ('super_admin','sponsorcommissie'),false)
 or (private.current_app_role()='sponsor' and exists (
 select 1 from private.sponsor_memberships where user_id=auth.uid() and sponsor_id=target and is_active));
$$;
revoke all on function private.can_access_sponsor(uuid) from public,anon,authenticated;
grant execute on function private.can_access_sponsor(uuid) to authenticated;
create policy sponsors_read on public.sponsors for select to authenticated
 using (private.can_access_sponsor(id) or (select private.current_app_role())='clubbestuur');
-- Eigen context: geen parameters, geen rol-/gebruikerslijst of schrijftoegang.
create function public.get_access_context() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('role',private.current_app_role(),'sponsor_id',
 (select sponsor_id from private.sponsor_memberships where user_id=auth.uid() and is_active and private.current_app_role()='sponsor'));
$$;
revoke all on function public.get_access_context() from public,anon,authenticated;
grant execute on function public.get_access_context() to authenticated;

create table private.access_audit (
 id bigint generated always as identity primary key,
 actor uuid references auth.users(id), target uuid not null references auth.users(id),
 operation text not null, created_at timestamptz not null default now()
);
alter table private.access_audit enable row level security;
revoke all on private.access_audit from public,anon,authenticated;
-- Rollen alleen door een actieve Super Admin. Bedrijvenkoppelingen krijgen apart
-- dezelfde controle; voor de commissie geen algemene privilegefunctie.
create function public.set_user_access(target uuid, new_role text, active boolean, company uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if private.current_app_role() is distinct from 'super_admin' then raise insufficient_privilege; end if;
 if target=auth.uid() then raise exception 'Eigen rechten niet via deze functie wijzigen'; end if;
 if new_role not in ('super_admin','sponsorcommissie','clubbestuur','sponsor') or active is null then raise exception 'Ongeldige rol of status'; end if;
 if (new_role='sponsor' and active and company is null) or (new_role<>'sponsor' and company is not null) then raise exception 'Ongeldige bedrijfskoppeling'; end if;
 -- FK-check ook bij een ingetrokken koppeling; alles in één transactie.
 insert into private.user_access(user_id,role,is_active) values(target,new_role::private.app_role,active)
 on conflict(user_id) do update set role=excluded.role,is_active=excluded.is_active;
 update private.sponsor_memberships set is_active=false where user_id=target;
 if company is not null then
 insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values(target,company,active)
 on conflict(user_id) do update set sponsor_id=excluded.sponsor_id,is_active=excluded.is_active;
 end if;
 insert into private.access_audit(actor,target,operation) values(auth.uid(),target,'set_user_access');
end;
$$;
revoke all on function public.set_user_access(uuid,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.set_user_access(uuid,text,boolean,uuid) to authenticated;

-- Eén private documentenbucket; geen uploads voor sponsoren/bestuur in fase 3.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('private-documents','private-documents',false,10485760,array['application/pdf','image/png','image/jpeg']);
create table public.documents (
 id uuid primary key default gen_random_uuid(),
 sponsor_id uuid not null references public.sponsors(id) on delete restrict,
 object_path text not null unique,
 title text not null check(length(btrim(title)) between 1 and 160),
 sponsor_shared boolean not null default false,
 board_shared boolean not null default false,
 check(object_path=sponsor_id::text||'/'||id::text)
);
alter table public.documents enable row level security;
revoke all on public.documents from public,anon,authenticated;
grant select,insert,update on public.documents to authenticated;
create policy documents_read on public.documents for select to authenticated using (
 (select private.current_app_role()) in ('super_admin','sponsorcommissie')
 or ((select private.current_app_role())='clubbestuur' and board_shared)
 or ((select private.current_app_role())='sponsor' and sponsor_shared and private.can_access_sponsor(sponsor_id)));
create policy documents_insert on public.documents for insert to authenticated with check ((select private.current_app_role()) in ('super_admin','sponsorcommissie'));
create policy documents_update on public.documents for update to authenticated
 using ((select private.current_app_role()) in ('super_admin','sponsorcommissie'))
 with check ((select private.current_app_role()) in ('super_admin','sponsorcommissie'));
create policy documents_object_read on storage.objects for select to authenticated using (
 bucket_id='private-documents' and exists(select 1 from public.documents d where d.object_path=name));
create policy documents_object_insert on storage.objects for insert to authenticated with check (
 bucket_id='private-documents' and (select private.current_app_role()) in ('super_admin','sponsorcommissie')
 and exists(select 1 from public.documents d where d.object_path=name));
-- Geen update/delete: objecten niet onzichtbaar vervangen of verwijderen.
