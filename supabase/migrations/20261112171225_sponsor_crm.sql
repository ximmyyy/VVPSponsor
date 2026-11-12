-- Fase 4: één bedrijfsbron. Alleen veilige profielvelden in sponsors.
alter table public.sponsors
 add column trading_name text check(length(trading_name)<=160),
 add column website text check(website ~ '^https?://[^[:space:]]+$' and length(website)<=500),
 add column city text check(length(city)<=120),
 add column archived_at timestamptz,
 add column updated_at timestamptz not null default now();
-- Bestaande namen eerst controleren: migratie faalt reviewbaar bij een conflict.
create unique index sponsors_normalized_name on public.sponsors(lower(regexp_replace(btrim(name),'\s+',' ','g')));
create trigger sponsors_timestamp before update on public.sponsors for each row execute function private.set_updated_at();
grant insert(name,trading_name,website,city), update(name,trading_name,website,city,archived_at) on public.sponsors to authenticated;
create policy sponsors_insert on public.sponsors for insert to authenticated with check ((select private.current_app_role()) in ('super_admin','sponsorcommissie'));
create policy sponsors_update on public.sponsors for update to authenticated
 using ((select private.current_app_role()) in ('super_admin','sponsorcommissie'))
 with check ((select private.current_app_role()) in ('super_admin','sponsorcommissie'));

create table public.sponsor_internal (
 sponsor_id uuid primary key references public.sponsors(id) on delete restrict,
 status text not null default 'prospect' check(status in ('prospect','active','inactive')),
 kvk text unique check(kvk ~ '^[0-9]{8}$'),
 vat_number text check(length(vat_number)<=32),
 street text check(length(street)<=200), postal_code text check(length(postal_code)<=20),
 email text check(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(email)<=254),
 phone text check(length(phone)<=40),
 notes text check(length(notes)<=10000),
 owner_id uuid references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now()
);
alter table public.sponsor_internal enable row level security;
revoke all on public.sponsor_internal from public,anon,authenticated;
grant select,insert,update on public.sponsor_internal to authenticated;
create policy internal_read on public.sponsor_internal for select to authenticated using ((select private.current_app_role()) in ('super_admin','sponsorcommissie'));
create policy internal_insert on public.sponsor_internal for insert to authenticated with check ((select private.current_app_role()) in ('super_admin','sponsorcommissie'));
create policy internal_update on public.sponsor_internal for update to authenticated
 using ((select private.current_app_role()) in ('super_admin','sponsorcommissie'))
 with check ((select private.current_app_role()) in ('super_admin','sponsorcommissie'));
create index on public.sponsor_internal(status);
create index on public.sponsor_internal(owner_id);
create trigger internal_timestamp before update on public.sponsor_internal for each row execute function private.set_updated_at();

create table public.sponsor_contacts (
 id uuid primary key default gen_random_uuid(),
 sponsor_id uuid not null references public.sponsors(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 160),
 position text check(length(position)<=120),
 email text check(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(email)<=254),
 phone text check(length(phone)<=40),
 is_primary boolean not null default false,
 archived_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,sponsor_id)
);
create unique index contacts_one_primary on public.sponsor_contacts(sponsor_id) where is_primary and archived_at is null;
create index on public.sponsor_contacts(sponsor_id);
alter table public.sponsor_contacts enable row level security;
revoke all on public.sponsor_contacts from public,anon,authenticated;
grant select on public.sponsor_contacts to authenticated;
grant insert(sponsor_id,name,position,email,phone,is_primary),update(name,position,email,phone,is_primary,archived_at) on public.sponsor_contacts to authenticated;
create policy contacts_read on public.sponsor_contacts for select to authenticated using ((select private.current_app_role()) in ('super_admin','sponsorcommissie'));
create policy contacts_insert on public.sponsor_contacts for insert to authenticated with check ((select private.current_app_role()) in ('super_admin','sponsorcommissie'));
create policy contacts_update on public.sponsor_contacts for update to authenticated
 using ((select private.current_app_role()) in ('super_admin','sponsorcommissie'))
 with check ((select private.current_app_role()) in ('super_admin','sponsorcommissie'));
create trigger contact_timestamp before update on public.sponsor_contacts for each row execute function private.set_updated_at();

-- Eigenaars moeten actieve interne accounts zijn. Geen gebruikerslijst voor sponsor/bestuur.
create function private.check_crm_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.owner_id is not null and (tg_op='INSERT' or new.owner_id is distinct from old.owner_id) and not exists(
 select 1 from private.user_access where user_id=new.owner_id and is_active and role in ('super_admin','sponsorcommissie')) then raise exception 'Ongeldige eigenaar';end if;
 return new;
end;$$;
revoke all on function private.check_crm_owner() from public,anon,authenticated;
create trigger internal_owner before insert or update on public.sponsor_internal for each row execute function private.check_crm_owner();
create function public.crm_owners() returns table(user_id uuid,label text) language plpgsql security definer set search_path='' as $$
begin
 if private.current_app_role() not in ('super_admin','sponsorcommissie') or private.current_app_role() is null then raise insufficient_privilege;end if;
 return query select a.user_id,coalesce(p.display_name,u.email::text,'Intern account') from private.user_access a join auth.users u on u.id=a.user_id left join public.user_profiles p on p.user_id=a.user_id where a.is_active and a.role in ('super_admin','sponsorcommissie');
end;$$;
revoke all on function public.crm_owners() from public,anon,authenticated;grant execute on function public.crm_owners() to authenticated;

-- Beide bedrijfsdelen atomair opslaan met eigen sessie en RLS.
create function public.save_sponsor(target uuid, details jsonb) returns uuid language plpgsql set search_path='' as $$
declare result uuid;
begin
 if private.current_app_role() not in ('super_admin','sponsorcommissie') or private.current_app_role() is null then raise insufficient_privilege;end if;
 if target is null then
 insert into public.sponsors(name,trading_name,website,city) values(details->>'name',nullif(details->>'trading_name',''),nullif(details->>'website',''),nullif(details->>'city','')) returning id into result;
 else
 update public.sponsors set name=details->>'name',trading_name=nullif(details->>'trading_name',''),website=nullif(details->>'website',''),city=nullif(details->>'city','') where id=target and archived_at is null returning id into result;
 if result is null then raise exception 'Bedrijf niet beschikbaar';end if;
 end if;
 insert into public.sponsor_internal(sponsor_id,status,kvk,vat_number,street,postal_code,email,phone,notes,owner_id)
 values(result,coalesce(details->>'status','prospect'),nullif(details->>'kvk',''),nullif(details->>'vat_number',''),nullif(details->>'street',''),nullif(details->>'postal_code',''),nullif(details->>'email',''),nullif(details->>'phone',''),nullif(details->>'notes',''),nullif(details->>'owner_id','')::uuid)
 on conflict(sponsor_id) do update set status=excluded.status,kvk=excluded.kvk,vat_number=excluded.vat_number,street=excluded.street,postal_code=excluded.postal_code,email=excluded.email,phone=excluded.phone,notes=excluded.notes,owner_id=excluded.owner_id;
 return result;
end;$$;
revoke all on function public.save_sponsor(uuid,jsonb) from public,anon,authenticated;grant execute on function public.save_sponsor(uuid,jsonb) to authenticated;

create table private.crm_audit (
 id bigint generated always as identity primary key, actor uuid references auth.users(id),
 sponsor_id uuid not null references public.sponsors(id), entity_id uuid not null,
 operation text not null, created_at timestamptz not null default now()
);
alter table private.crm_audit enable row level security;
revoke all on private.crm_audit from public,anon,authenticated;
create function private.audit_crm() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.crm_audit(actor,sponsor_id,entity_id,operation) values(auth.uid(),case when tg_table_name='sponsors' then new.id else new.sponsor_id end,case when tg_table_name='sponsor_internal' then new.sponsor_id else new.id end,tg_table_name||'_'||tg_op);
 return new;
end;$$;
revoke all on function private.audit_crm() from public,anon,authenticated;
create trigger sponsors_audit after insert or update on public.sponsors for each row execute function private.audit_crm();
create trigger internal_audit after insert or update on public.sponsor_internal for each row execute function private.audit_crm();
create trigger contacts_audit after insert or update on public.sponsor_contacts for each row execute function private.audit_crm();

alter table private.sponsor_memberships add column contact_id uuid;
alter table private.sponsor_memberships add foreign key(contact_id,sponsor_id) references public.sponsor_contacts(id,sponsor_id) on delete restrict;
-- Commissie krijgt geen vrije rol-/bedrijfsmutatie: alleen dit begrensde proces.
create function public.manage_sponsor_member(company uuid,target uuid,contact uuid,active boolean) returns void language plpgsql security definer set search_path='' as $$
declare existing_role private.app_role;existing_company uuid;
begin
 if private.current_app_role() not in ('super_admin','sponsorcommissie') or private.current_app_role() is null then raise insufficient_privilege;end if;
 if target=auth.uid() or active is null then raise exception 'Ongeldige machtiging';end if;
 perform 1 from auth.users where id=target for update;
 if not found then raise exception 'Gebruiker niet gevonden';end if;
 select role into existing_role from private.user_access where user_id=target;
 select sponsor_id into existing_company from private.sponsor_memberships where user_id=target;
 if (existing_role is not null and existing_role<>'sponsor') or (existing_company is not null and existing_company<>company) then raise exception 'Bestaande rol of koppeling kan hier niet worden gewijzigd';end if;
 if active then
 if not exists(select 1 from public.sponsors where id=company and archived_at is null) then raise exception 'Bedrijf niet beschikbaar';end if;
 if not exists(select 1 from public.sponsor_contacts c join auth.users u on lower(u.email)=lower(c.email) where c.id=contact and c.sponsor_id=company and c.archived_at is null and u.id=target) then raise exception 'Contact en account komen niet overeen';end if;
 insert into private.user_access(user_id,role,is_active) values(target,'sponsor',true) on conflict(user_id) do update set is_active=true;
 insert into private.sponsor_memberships(user_id,sponsor_id,is_active,contact_id) values(target,company,true,contact) on conflict(user_id) do update set is_active=true,contact_id=excluded.contact_id;
 else
 update private.sponsor_memberships set is_active=false where user_id=target and sponsor_id=company;
 if not found then raise exception 'Machtiging niet gevonden';end if;
 end if;
end;$$;
revoke all on function public.manage_sponsor_member(uuid,uuid,uuid,boolean) from public,anon,authenticated;grant execute on function public.manage_sponsor_member(uuid,uuid,uuid,boolean) to authenticated;
create function public.sponsor_members(company uuid) returns table(user_id uuid,label text,is_active boolean) language plpgsql security definer set search_path='' as $$
begin
 if private.current_app_role() not in ('super_admin','sponsorcommissie') or private.current_app_role() is null then raise insufficient_privilege;end if;
 return query select m.user_id,coalesce(u.email::text,'Sponsoraccount'),m.is_active from private.sponsor_memberships m join auth.users u on u.id=m.user_id where m.sponsor_id=company;
end;$$;
revoke all on function public.sponsor_members(uuid) from public,anon,authenticated;grant execute on function public.sponsor_members(uuid) to authenticated;
