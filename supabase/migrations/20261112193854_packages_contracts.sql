-- Fase 5: sponsorpakketten, contracten, sponsorrechten, uitvoering en private
-- contract-/bewijsdocumenten. Geen officiële pakketten/prijzen of seeds.
-- Lezen via RLS met de eigen sessie; schrijven uitsluitend via begrensde RPC's
-- die rol, bedrijfsgrens en status zelf controleren. Triggers bewaken daarnaast
-- de onveranderlijkheid van gepubliceerde versies en bevestigde baselines.

create function private.is_internal() returns boolean language sql stable set search_path='' as $$
 select coalesce(private.current_app_role() in ('super_admin','sponsorcommissie'),false);
$$;
revoke all on function private.is_internal() from public,anon,authenticated;
grant execute on function private.is_internal() to authenticated;

create function private.is_sponsor_of(target uuid) returns boolean language sql stable set search_path='' as $$
 select coalesce(private.current_app_role()='sponsor',false) and private.can_access_sponsor(target);
$$;
revoke all on function private.is_sponsor_of(uuid) from public,anon,authenticated;
grant execute on function private.is_sponsor_of(uuid) to authenticated;

create function private.require_internal() returns void language plpgsql stable set search_path='' as $$
begin
 if not private.is_internal() then raise insufficient_privilege; end if;
end;$$;
revoke all on function private.require_internal() from public,anon,authenticated;

create function private.check_internal_user(target uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if target is not null and not exists(select 1 from private.user_access where user_id=target and is_active and role in ('super_admin','sponsorcommissie')) then
  raise exception 'Ongeldige verantwoordelijke' using errcode='23514';
 end if;
end;$$;
revoke all on function private.check_internal_user(uuid) from public,anon,authenticated;

create function private.in_amendment() returns boolean language sql stable set search_path='' as $$
 select coalesce(current_setting('vvp.amendment',true),'')='on';
$$;
revoke all on function private.in_amendment() from public,anon,authenticated;

-- Pakketten en versies -------------------------------------------------------
create table public.sponsorship_packages (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 160),
 description text check(length(description)<=4000),
 archived_at timestamptz,
 created_by uuid references auth.users(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index packages_normalized_name on public.sponsorship_packages(lower(regexp_replace(btrim(name),'\s+',' ','g')));
create trigger packages_timestamp before update on public.sponsorship_packages for each row execute function private.set_updated_at();

create table public.package_versions (
 id uuid primary key default gen_random_uuid(),
 package_id uuid not null references public.sponsorship_packages(id) on delete restrict,
 version_number integer not null check(version_number>0),
 description text check(length(description)<=4000),
 list_price numeric(14,2) check(list_price>=0),
 currency text not null default 'EUR' check(currency='EUR'),
 vat_rate numeric(5,2) check(vat_rate between 0 and 100),
 status text not null default 'draft' check(status in ('draft','published','retired')),
 published_at timestamptz,
 published_by uuid references auth.users(id) on delete restrict,
 created_by uuid references auth.users(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(package_id,version_number),
 check((status='draft')=(published_at is null))
);
create unique index package_one_published on public.package_versions(package_id) where status='published';
create trigger versions_timestamp before update on public.package_versions for each row execute function private.set_updated_at();

create table public.package_right_templates (
 id uuid primary key default gen_random_uuid(),
 package_version_id uuid not null references public.package_versions(id) on delete restrict,
 position integer not null default 0,
 description text not null check(length(btrim(description)) between 1 and 1000),
 quantity numeric(12,2) not null check(quantity>0),
 unit text not null check(length(btrim(unit)) between 1 and 60),
 timing text check(length(timing)<=200)
);
create index on public.package_right_templates(package_version_id);

create function private.guard_package_version() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Pakketversies worden niet verwijderd' using errcode='42501'; end if;
 if old.status='draft' then return new; end if;
 -- Gepubliceerd: alleen uitfaseren. Inhoud blijft onveranderlijk.
 if old.status='published' and new.status='retired'
  and (to_jsonb(new)-'status'-'updated_at')=(to_jsonb(old)-'status'-'updated_at') then return new; end if;
 raise exception 'Gepubliceerde pakketversie is onveranderlijk' using errcode='42501';
end;$$;
revoke all on function private.guard_package_version() from public,anon,authenticated;
create trigger versions_guard before update or delete on public.package_versions for each row execute function private.guard_package_version();

create function private.guard_template() returns trigger language plpgsql set search_path='' as $$
declare version_id uuid:=case when tg_op='DELETE' then old.package_version_id else new.package_version_id end;
begin
 if tg_op='UPDATE' and new.package_version_id<>old.package_version_id then raise exception 'Template niet verplaatsen' using errcode='42501'; end if;
 if not exists(select 1 from public.package_versions where id=version_id and status='draft') then
  raise exception 'Rechten van een gepubliceerde versie zijn onveranderlijk' using errcode='42501';
 end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
revoke all on function private.guard_template() from public,anon,authenticated;
create trigger templates_guard before insert or update or delete on public.package_right_templates for each row execute function private.guard_template();

-- Contracten -------------------------------------------------------------------
create table private.contract_counters (
 year integer primary key check(year between 2000 and 9999),
 last_value integer not null check(last_value>0)
);
alter table private.contract_counters enable row level security;
revoke all on private.contract_counters from public,anon,authenticated;

create table public.contracts (
 id uuid primary key default gen_random_uuid(),
 sponsor_id uuid not null references public.sponsors(id) on delete restrict,
 contract_number text not null unique check(contract_number ~ '^SC-[0-9]{4}-[0-9]{4,}$'),
 title text not null check(length(btrim(title)) between 1 and 160),
 status text not null default 'draft' check(status in ('draft','confirmed','terminated')),
 starts_on date not null,
 ends_on date not null,
 notice_deadline date,
 renewal_terms text check(length(renewal_terms)<=2000),
 terms text check(length(terms)<=10000),
 currency text not null default 'EUR' check(currency='EUR'),
 predecessor_contract_id uuid,
 party_snapshot jsonb check(party_snapshot is null or jsonb_typeof(party_snapshot)='object'),
 confirmed_at timestamptz,
 confirmed_by uuid references auth.users(id) on delete restrict,
 terminated_at timestamptz,
 terminated_on date,
 termination_reason text check(length(termination_reason)<=2000),
 created_by uuid references auth.users(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,sponsor_id),
 check(ends_on>=starts_on),
 check(notice_deadline is null or notice_deadline<=ends_on),
 check(predecessor_contract_id is null or predecessor_contract_id<>id),
 check((status='draft')=(confirmed_at is null)),
 check(status='draft' or party_snapshot is not null),
 check((status='terminated')=(terminated_at is not null and terminated_on is not null and termination_reason is not null)),
 foreign key(predecessor_contract_id,sponsor_id) references public.contracts(id,sponsor_id) on delete restrict
);
create index contracts_sponsor_status_end on public.contracts(sponsor_id,status,ends_on);
create unique index contracts_one_successor on public.contracts(predecessor_contract_id) where predecessor_contract_id is not null;
create trigger contracts_timestamp before update on public.contracts for each row execute function private.set_updated_at();

create table public.contract_amendments (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null,
 sponsor_id uuid not null,
 sequence_number integer not null check(sequence_number>0),
 effective_on date not null,
 reason text not null check(length(btrim(reason)) between 1 and 2000),
 changes jsonb not null default '{}' check(jsonb_typeof(changes)='object'),
 created_by uuid references auth.users(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),
 unique(contract_id,sequence_number),
 unique(id,contract_id),
 foreign key(contract_id,sponsor_id) references public.contracts(id,sponsor_id) on delete restrict
);
create index on public.contract_amendments(sponsor_id);

create table public.contract_lines (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null,
 sponsor_id uuid not null,
 package_version_id uuid references public.package_versions(id) on delete restrict,
 amendment_id uuid,
 position integer not null default 0,
 title text not null check(length(btrim(title)) between 1 and 160),
 description text check(length(description)<=4000),
 quantity numeric(12,2) not null check(quantity>0),
 unit_price numeric(14,4) not null check(abs(unit_price)<10000000000),
 vat_rate numeric(5,2) check(vat_rate between 0 and 100),
 currency text not null default 'EUR' check(currency='EUR'),
 line_total numeric(14,2) generated always as (round(quantity*unit_price,2)) stored,
 created_at timestamptz not null default now(),
 unique(id,contract_id),
 unique(id,sponsor_id),
 -- Een negatieve regel (korting/vermindering) bestaat alleen als amendement.
 check(unit_price>=0 or amendment_id is not null),
 foreign key(contract_id,sponsor_id) references public.contracts(id,sponsor_id) on delete restrict,
 foreign key(amendment_id,contract_id) references public.contract_amendments(id,contract_id) on delete restrict
);
create index on public.contract_lines(contract_id);
create index on public.contract_lines(sponsor_id);
create index on public.contract_lines(package_version_id);

create table public.contract_rights (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null,
 sponsor_id uuid not null,
 contract_line_id uuid,
 source_template_id uuid references public.package_right_templates(id) on delete restrict,
 amendment_id uuid,
 cancelled_by_amendment_id uuid,
 position integer not null default 0,
 description text not null check(length(btrim(description)) between 1 and 1000),
 quantity numeric(12,2) not null check(quantity>0),
 unit text not null check(length(btrim(unit)) between 1 and 60),
 deadline date,
 responsible_id uuid references auth.users(id) on delete restrict,
 status text not null default 'open' check(status in ('open','in_progress','fulfilled','cancelled')),
 portal_visible boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,sponsor_id),
 check((status='cancelled')=(cancelled_by_amendment_id is not null)),
 foreign key(contract_id,sponsor_id) references public.contracts(id,sponsor_id) on delete restrict,
 foreign key(contract_line_id,contract_id) references public.contract_lines(id,contract_id) on delete restrict,
 foreign key(amendment_id,contract_id) references public.contract_amendments(id,contract_id) on delete restrict,
 foreign key(cancelled_by_amendment_id,contract_id) references public.contract_amendments(id,contract_id) on delete restrict
);
create index on public.contract_rights(contract_id);
create index contract_rights_open_deadline on public.contract_rights(sponsor_id,status,deadline);
create index on public.contract_rights(responsible_id);
create index on public.contract_rights(contract_line_id);
create trigger rights_timestamp before update on public.contract_rights for each row execute function private.set_updated_at();

create table public.right_fulfillments (
 id uuid primary key default gen_random_uuid(),
 contract_right_id uuid not null,
 sponsor_id uuid not null,
 fulfilled_on date not null,
 quantity numeric(12,2) not null check(quantity>0),
 description text not null check(length(btrim(description)) between 1 and 2000),
 portal_visible boolean not null default false,
 registered_by uuid references auth.users(id) on delete restrict default auth.uid(),
 registered_at timestamptz not null default now(),
 verified_by uuid references auth.users(id) on delete restrict,
 verified_at timestamptz,
 voided_by uuid references auth.users(id) on delete restrict,
 voided_at timestamptz,
 void_reason text check(length(void_reason)<=2000),
 unique(id,sponsor_id),
 check((verified_by is null)=(verified_at is null)),
 check((voided_at is null)=(void_reason is null) and (voided_at is null)=(voided_by is null)),
 foreign key(contract_right_id,sponsor_id) references public.contract_rights(id,sponsor_id) on delete restrict
);
create index on public.right_fulfillments(contract_right_id);
create index on public.right_fulfillments(sponsor_id);

-- Bescherming van de bevestigde baseline --------------------------------------
create function private.guard_contract() returns trigger language plpgsql set search_path='' as $$
declare changed jsonb;
begin
 if tg_op='DELETE' then raise exception 'Contracten worden niet verwijderd' using errcode='42501'; end if;
 if new.sponsor_id<>old.sponsor_id or new.contract_number<>old.contract_number
  or new.predecessor_contract_id is distinct from old.predecessor_contract_id then
  raise exception 'Bedrijf, nummer en voorganger zijn onveranderlijk' using errcode='42501';
 end if;
 if old.status='draft' then
  if new.status not in ('draft','confirmed') then raise exception 'Ongeldige statusovergang' using errcode='42501'; end if;
  return new;
 end if;
 changed:=(to_jsonb(new)-'updated_at');
 if old.status='confirmed' and new.status='terminated'
  and changed-'status'-'terminated_at'-'terminated_on'-'termination_reason'=(to_jsonb(old)-'updated_at'-'status'-'terminated_at'-'terminated_on'-'termination_reason') then
  return new;
 end if;
 if old.status='confirmed' and new.status='confirmed' and private.in_amendment()
  and changed-'ends_on'-'notice_deadline'=(to_jsonb(old)-'updated_at'-'ends_on'-'notice_deadline') then
  return new;
 end if;
 raise exception 'Bevestigd contract is onveranderlijk; gebruik een amendement' using errcode='42501';
end;$$;
revoke all on function private.guard_contract() from public,anon,authenticated;
create trigger contracts_guard before update or delete on public.contracts for each row execute function private.guard_contract();

create function private.guard_contract_line() returns trigger language plpgsql set search_path='' as $$
declare state text; row_contract uuid:=case when tg_op='DELETE' then old.contract_id else new.contract_id end;
begin
 select status into state from public.contracts where id=row_contract;
 if tg_op='INSERT' and (state='draft' and new.amendment_id is null or state='confirmed' and new.amendment_id is not null and private.in_amendment()) then return new; end if;
 if tg_op='DELETE' and state='draft' then return old; end if;
 if tg_op='UPDATE' and state='draft' and new.contract_id=old.contract_id and new.sponsor_id=old.sponsor_id and new.amendment_id is not distinct from old.amendment_id then return new; end if;
 raise exception 'Contractregels zijn na bevestiging onveranderlijk' using errcode='42501';
end;$$;
revoke all on function private.guard_contract_line() from public,anon,authenticated;
create trigger lines_guard before insert or update or delete on public.contract_lines for each row execute function private.guard_contract_line();

create function private.guard_contract_right() returns trigger language plpgsql security definer set search_path='' as $$
declare state text; row_contract uuid:=case when tg_op='DELETE' then old.contract_id else new.contract_id end;
begin
 select status into state from public.contracts where id=row_contract;
 if tg_op='DELETE' then
  if state='draft' then return old; end if;
  raise exception 'Bevestigde rechten worden niet verwijderd' using errcode='42501';
 end if;
 if new.responsible_id is not null and (tg_op='INSERT' or new.responsible_id is distinct from old.responsible_id) then
  perform private.check_internal_user(new.responsible_id);
 end if;
 if tg_op='INSERT' then
  if state='draft' and new.amendment_id is null and new.status<>'cancelled' then return new; end if;
  if state='confirmed' and new.amendment_id is not null and new.status<>'cancelled' and private.in_amendment() then return new; end if;
  raise exception 'Nieuwe rechten na bevestiging alleen via amendement' using errcode='42501';
 end if;
 if new.contract_id<>old.contract_id or new.sponsor_id<>old.sponsor_id or new.amendment_id is distinct from old.amendment_id
  or new.source_template_id is distinct from old.source_template_id then
  raise exception 'Herkomst van een recht is onveranderlijk' using errcode='42501';
 end if;
 if state='draft' then
  if new.status='cancelled' then raise exception 'Concept-rechten verwijderen in plaats van annuleren' using errcode='42501'; end if;
  return new;
 end if;
 if old.status='cancelled' then raise exception 'Geannuleerd recht is onveranderlijk' using errcode='42501'; end if;
 if new.description<>old.description or new.quantity<>old.quantity or new.unit<>old.unit
  or new.contract_line_id is distinct from old.contract_line_id or new.position<>old.position then
  raise exception 'Afgesproken recht is onveranderlijk; gebruik een amendement' using errcode='42501';
 end if;
 if new.status='cancelled' and not (private.in_amendment() and state='confirmed') then
  raise exception 'Annuleren alleen via amendement' using errcode='42501';
 end if;
 if state<>'confirmed' and (to_jsonb(new)-'updated_at')<>(to_jsonb(old)-'updated_at') then
  raise exception 'Alleen lopende contracten bijwerken' using errcode='42501';
 end if;
 return new;
end;$$;
revoke all on function private.guard_contract_right() from public,anon,authenticated;
create trigger rights_guard before insert or update or delete on public.contract_rights for each row execute function private.guard_contract_right();

create function private.guard_fulfillment() returns trigger language plpgsql set search_path='' as $$
declare state text; right_status text;
begin
 if tg_op='DELETE' then raise exception 'Uitvoering wordt niet verwijderd; maak ongedaan met reden' using errcode='42501'; end if;
 if tg_op='INSERT' then
  select c.status,r.status into state,right_status from public.contract_rights r join public.contracts c on c.id=r.contract_id where r.id=new.contract_right_id;
  if state not in ('confirmed','terminated') or right_status='cancelled' then
   raise exception 'Uitvoering alleen bij een bevestigd, niet-geannuleerd recht' using errcode='42501';
  end if;
  if new.verified_at is not null or new.voided_at is not null then raise exception 'Ongeldige beginstatus' using errcode='42501'; end if;
  return new;
 end if;
 if old.voided_at is not null then raise exception 'Ongedaan gemaakte uitvoering is onveranderlijk' using errcode='42501'; end if;
 if (old.verified_at is not null and new.verified_at is distinct from old.verified_at)
  or (to_jsonb(new)-'portal_visible'-'verified_by'-'verified_at'-'voided_by'-'voided_at'-'void_reason')
   <>(to_jsonb(old)-'portal_visible'-'verified_by'-'verified_at'-'voided_by'-'voided_at'-'void_reason') then
  raise exception 'Vastgelegde uitvoering is onveranderlijk' using errcode='42501';
 end if;
 return new;
end;$$;
revoke all on function private.guard_fulfillment() from public,anon,authenticated;
create trigger fulfillments_guard before insert or update or delete on public.right_fulfillments for each row execute function private.guard_fulfillment();

create function private.guard_append_only() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Historie is alleen aanvulbaar' using errcode='42501'; end;$$;
revoke all on function private.guard_append_only() from public,anon,authenticated;
create function private.guard_amendment() returns trigger language plpgsql set search_path='' as $$
begin
 -- Alleen de eenmalige vastlegging van het wijzigingsoverzicht binnen dezelfde RPC.
 if tg_op='UPDATE' and private.in_amendment() and old.changes='{}'::jsonb
  and (to_jsonb(new)-'changes')=(to_jsonb(old)-'changes') then return new; end if;
 raise exception 'Historie is alleen aanvulbaar' using errcode='42501';
end;$$;
revoke all on function private.guard_amendment() from public,anon,authenticated;
create trigger amendments_append_only before update or delete on public.contract_amendments for each row execute function private.guard_amendment();

-- Documenten: uploadstatus, metadata en getypeerde koppelingen ------------------
alter table public.documents
 add column category text not null default 'general' check(category in ('general','contract','evidence')),
 add column mime_type text check(mime_type in ('application/pdf','image/png','image/jpeg')),
 add column size_bytes integer check(size_bytes between 1 and 10485760),
 add column checksum text check(checksum ~ '^[0-9a-f]{64}$'),
 add column upload_status text not null default 'available' check(upload_status in ('pending','available')),
 add column uploaded_by uuid references auth.users(id) on delete restrict default auth.uid(),
 add column created_at timestamptz not null default now(),
 add constraint documents_id_sponsor unique(id,sponsor_id);
-- Bestaande rijen bleven beschikbaar; nieuwe documenten pas na servercontrole.
alter table public.documents alter column upload_status set default 'pending';
create index on public.documents(sponsor_id);
revoke insert,update on public.documents from authenticated;
grant insert(id,sponsor_id,object_path,title,sponsor_shared,board_shared,category) on public.documents to authenticated;
grant update(title,sponsor_shared,board_shared) on public.documents to authenticated;
drop policy documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated using (
 (select private.is_internal())
 or (upload_status='available' and (select private.current_app_role())='clubbestuur' and board_shared)
 or (upload_status='available' and sponsor_shared and (select private.is_sponsor_of(sponsor_id))));
drop policy documents_object_insert on storage.objects;
create policy documents_object_insert on storage.objects for insert to authenticated with check (
 bucket_id='private-documents' and (select private.is_internal())
 and exists(select 1 from public.documents d where d.object_path=name and d.upload_status='pending'));

create table public.contract_documents (
 contract_id uuid not null,
 document_id uuid not null,
 sponsor_id uuid not null,
 document_role text not null default 'contract' check(document_role in ('contract','amendment','annex','other')),
 created_at timestamptz not null default now(),
 primary key(contract_id,document_id),
 foreign key(contract_id,sponsor_id) references public.contracts(id,sponsor_id) on delete restrict,
 foreign key(document_id,sponsor_id) references public.documents(id,sponsor_id) on delete restrict
);
create index on public.contract_documents(document_id);
create index on public.contract_documents(sponsor_id);

create table public.fulfillment_evidence (
 right_fulfillment_id uuid not null,
 document_id uuid not null,
 sponsor_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(right_fulfillment_id,document_id),
 foreign key(right_fulfillment_id,sponsor_id) references public.right_fulfillments(id,sponsor_id) on delete restrict,
 foreign key(document_id,sponsor_id) references public.documents(id,sponsor_id) on delete restrict
);
create index on public.fulfillment_evidence(document_id);
create index on public.fulfillment_evidence(sponsor_id);
create trigger contract_documents_append_only before update or delete on public.contract_documents for each row execute function private.guard_append_only();
create trigger evidence_append_only before update or delete on public.fulfillment_evidence for each row execute function private.guard_append_only();

-- RLS en grants -----------------------------------------------------------------
do $$
declare t text;
begin
 foreach t in array array['sponsorship_packages','package_versions','package_right_templates','contracts','contract_amendments','contract_lines','contract_rights','right_fulfillments','contract_documents','fulfillment_evidence'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end$$;
-- Pakketcatalogus is intern tot publicatie in fase 10 is opgedragen.
create policy packages_read on public.sponsorship_packages for select to authenticated using ((select private.is_internal()));
create policy versions_read on public.package_versions for select to authenticated using ((select private.is_internal()));
create policy templates_read on public.package_right_templates for select to authenticated using ((select private.is_internal()));
-- Sponsor: alleen eigen bevestigde/beëindigde afspraken; nooit concepten.
create policy contracts_read on public.contracts for select to authenticated using (
 (select private.is_internal()) or (status<>'draft' and (select private.is_sponsor_of(sponsor_id))));
create policy amendments_read on public.contract_amendments for select to authenticated using (
 (select private.is_internal()) or (select private.is_sponsor_of(sponsor_id)));
create policy lines_read on public.contract_lines for select to authenticated using (
 (select private.is_internal()) or ((select private.is_sponsor_of(sponsor_id))
  and exists(select 1 from public.contracts c where c.id=contract_id and c.status<>'draft')));
create policy rights_read on public.contract_rights for select to authenticated using (
 (select private.is_internal()) or (portal_visible and (select private.is_sponsor_of(sponsor_id))
  and exists(select 1 from public.contracts c where c.id=contract_id and c.status<>'draft')));
create policy fulfillments_read on public.right_fulfillments for select to authenticated using (
 (select private.is_internal()) or (portal_visible and voided_at is null and (select private.is_sponsor_of(sponsor_id))
  and exists(select 1 from public.contract_rights r where r.id=contract_right_id)));
create policy contract_documents_read on public.contract_documents for select to authenticated using (
 (select private.is_internal()) or ((select private.is_sponsor_of(sponsor_id))
  and exists(select 1 from public.documents d where d.id=document_id)
  and exists(select 1 from public.contracts c where c.id=contract_id)));
create policy evidence_read on public.fulfillment_evidence for select to authenticated using (
 (select private.is_internal()) or ((select private.is_sponsor_of(sponsor_id))
  and exists(select 1 from public.documents d where d.id=document_id)
  and exists(select 1 from public.right_fulfillments f where f.id=right_fulfillment_id)));

-- Contractwaarde volgt uitsluitend uit vastgelegde regels (baseline + amendementen).
create view public.contract_totals with (security_invoker=true) as
 select c.id as contract_id, c.sponsor_id,
  coalesce(sum(l.line_total) filter (where l.amendment_id is null),0)::numeric(14,2) as baseline_total,
  coalesce(sum(l.line_total),0)::numeric(14,2) as current_total,
  count(l.id)::integer as line_count
 from public.contracts c left join public.contract_lines l on l.contract_id=c.id
 group by c.id,c.sponsor_id;
revoke all on public.contract_totals from public,anon,authenticated;
grant select on public.contract_totals to authenticated;

-- Audit -------------------------------------------------------------------------
create table private.contract_audit (
 id bigint generated always as identity primary key,
 actor uuid references auth.users(id),
 sponsor_id uuid references public.sponsors(id),
 entity text not null,
 entity_id uuid not null,
 operation text not null,
 created_at timestamptz not null default now()
);
create index on private.contract_audit(sponsor_id);
alter table private.contract_audit enable row level security;
revoke all on private.contract_audit from public,anon,authenticated;
create function private.audit_contracts() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb:=to_jsonb(case when tg_op='DELETE' then old else new end);
begin
 insert into private.contract_audit(actor,sponsor_id,entity,entity_id,operation)
 values(auth.uid(),(row_data->>'sponsor_id')::uuid,tg_table_name,
  coalesce((row_data->>'id')::uuid,(row_data->>'document_id')::uuid),tg_op);
 return null;
end;$$;
revoke all on function private.audit_contracts() from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array['sponsorship_packages','package_versions','package_right_templates','contracts','contract_amendments','contract_lines','contract_rights','right_fulfillments','contract_documents','fulfillment_evidence','documents'] loop
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_contracts()',t||'_contract_audit',t);
 end loop;
end$$;

-- RPC's: pakketten ------------------------------------------------------------
create function public.save_package(target uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.require_internal();
 if target is null then
  insert into public.sponsorship_packages(name,description) values(btrim(details->>'name'),nullif(btrim(details->>'description'),''))
  returning id into result;
 else
  update public.sponsorship_packages set name=btrim(details->>'name'),description=nullif(btrim(details->>'description'),'')
  where id=target and archived_at is null returning id into result;
  if result is null then raise exception 'Pakket niet beschikbaar' using errcode='P0002'; end if;
 end if;
 return result;
end;$$;

create function public.set_package_archived(target uuid, archive boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_internal();
 update public.sponsorship_packages set archived_at=case when archive then coalesce(archived_at,now()) end where id=target;
 if not found then raise exception 'Pakket niet gevonden' using errcode='P0002'; end if;
end;$$;

create function public.save_package_version(target uuid, package uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; rights jsonb:=coalesce(details->'rights','[]'::jsonb);
begin
 perform private.require_internal();
 if jsonb_typeof(rights)<>'array' or jsonb_array_length(rights)>50 then raise exception 'Ongeldige rechtenlijst' using errcode='22023'; end if;
 perform 1 from public.sponsorship_packages where id=package and archived_at is null for update;
 if not found then raise exception 'Pakket niet beschikbaar' using errcode='P0002'; end if;
 if target is null then
  insert into public.package_versions(package_id,version_number,description,list_price,vat_rate)
  select package,coalesce(max(version_number),0)+1,nullif(btrim(details->>'description'),''),
   nullif(details->>'list_price','')::numeric,nullif(details->>'vat_rate','')::numeric
  from public.package_versions where package_id=package returning id into result;
 else
  update public.package_versions set description=nullif(btrim(details->>'description'),''),
   list_price=nullif(details->>'list_price','')::numeric,vat_rate=nullif(details->>'vat_rate','')::numeric
  where id=target and package_id=package and status='draft' returning id into result;
  if result is null then raise exception 'Alleen een conceptversie is bewerkbaar' using errcode='42501'; end if;
  delete from public.package_right_templates where package_version_id=result;
 end if;
 insert into public.package_right_templates(package_version_id,position,description,quantity,unit,timing)
 select result,r.ord::integer,btrim(r.value->>'description'),(r.value->>'quantity')::numeric,btrim(r.value->>'unit'),nullif(btrim(r.value->>'timing'),'')
 from jsonb_array_elements(rights) with ordinality r(value,ord);
 return result;
end;$$;

create function public.publish_package_version(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare package uuid;
begin
 perform private.require_internal();
 select package_id into package from public.package_versions where id=target and status='draft';
 if package is null then raise exception 'Alleen een conceptversie kan worden gepubliceerd' using errcode='42501'; end if;
 perform 1 from public.sponsorship_packages where id=package and archived_at is null for update;
 if not found then raise exception 'Pakket niet beschikbaar' using errcode='P0002'; end if;
 update public.package_versions set status='retired' where package_id=package and status='published';
 update public.package_versions set status='published',published_at=now(),published_by=auth.uid() where id=target and status='draft';
end;$$;

create function public.retire_package_version(target uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_internal();
 update public.package_versions set status='retired' where id=target and status='published';
 if not found then raise exception 'Alleen een gepubliceerde versie kan worden uitgefaseerd' using errcode='42501'; end if;
end;$$;

-- RPC's: contracten -------------------------------------------------------------
create function private.next_contract_number() returns text language plpgsql security definer set search_path='' as $$
declare y integer:=extract(year from (now() at time zone 'Europe/Amsterdam'))::integer; n integer;
begin
 insert into private.contract_counters(year,last_value) values(y,1)
 on conflict(year) do update set last_value=private.contract_counters.last_value+1 returning last_value into n;
 return 'SC-'||y||'-'||lpad(n::text,4,'0');
end;$$;
revoke all on function private.next_contract_number() from public,anon,authenticated;

create function public.create_contract(company uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.require_internal();
 perform 1 from public.sponsors where id=company and archived_at is null for update;
 if not found then raise exception 'Bedrijf niet beschikbaar' using errcode='P0002'; end if;
 insert into public.contracts(sponsor_id,contract_number,title,starts_on,ends_on,notice_deadline,renewal_terms,terms)
 values(company,private.next_contract_number(),btrim(details->>'title'),(details->>'starts_on')::date,(details->>'ends_on')::date,
  nullif(details->>'notice_deadline','')::date,nullif(btrim(details->>'renewal_terms'),''),nullif(btrim(details->>'terms'),''))
 returning id into result;
 return result;
end;$$;

create function public.update_contract_draft(target uuid, details jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_internal();
 update public.contracts set title=btrim(details->>'title'),starts_on=(details->>'starts_on')::date,ends_on=(details->>'ends_on')::date,
  notice_deadline=nullif(details->>'notice_deadline','')::date,renewal_terms=nullif(btrim(details->>'renewal_terms'),''),
  terms=nullif(btrim(details->>'terms'),'')
 where id=target and status='draft';
 if not found then raise exception 'Alleen een concept is bewerkbaar' using errcode='42501'; end if;
end;$$;

create function private.lock_contract(target uuid, expected text) returns public.contracts
language plpgsql security definer set search_path='' as $$
declare c public.contracts;
begin
 select * into c from public.contracts where id=target for update;
 if not found then raise exception 'Contract niet gevonden' using errcode='P0002'; end if;
 if expected is not null and c.status<>expected then raise exception 'Handeling niet toegestaan in deze contractstatus' using errcode='42501'; end if;
 return c;
end;$$;
revoke all on function private.lock_contract(uuid,text) from public,anon,authenticated;

create function private.insert_right(c public.contracts, line uuid, template uuid, amendment uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 insert into public.contract_rights(contract_id,sponsor_id,contract_line_id,source_template_id,amendment_id,position,description,quantity,unit,deadline,responsible_id,portal_visible)
 values(c.id,c.sponsor_id,line,template,amendment,coalesce((details->>'position')::integer,0),btrim(details->>'description'),(details->>'quantity')::numeric,
  btrim(details->>'unit'),nullif(details->>'deadline','')::date,nullif(details->>'responsible_id','')::uuid,coalesce((details->>'portal_visible')::boolean,true))
 returning id into result;
 return result;
end;$$;
revoke all on function private.insert_right(public.contracts,uuid,uuid,uuid,jsonb) from public,anon,authenticated;

create function private.insert_line(c public.contracts, amendment uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; v record; version uuid:=nullif(details->>'package_version_id','')::uuid; t record;
begin
 if version is not null then
  select pv.id,pv.list_price,pv.vat_rate,pv.version_number,p.name into v
  from public.package_versions pv join public.sponsorship_packages p on p.id=pv.package_id
  where pv.id=version and pv.status='published';
  if not found then raise exception 'Alleen een gepubliceerde pakketversie is te kiezen' using errcode='42501'; end if;
 end if;
 insert into public.contract_lines(contract_id,sponsor_id,package_version_id,amendment_id,position,title,description,quantity,unit_price,vat_rate)
 values(c.id,c.sponsor_id,version,amendment,
  coalesce((select count(*)::integer from public.contract_lines where contract_id=c.id),0)+1,
  coalesce(nullif(btrim(details->>'title'),''),case when version is not null then v.name||' (versie '||v.version_number||')' end),
  nullif(btrim(details->>'description'),''),coalesce(nullif(details->>'quantity','')::numeric,1),
  coalesce(nullif(details->>'unit_price','')::numeric,case when version is not null then v.list_price end),
  coalesce(nullif(details->>'vat_rate','')::numeric,case when version is not null then v.vat_rate end))
 returning id into result;
 -- Rechten worden als eigen afspraak gekopieerd; latere pakketwijziging raakt ze niet.
 if version is not null and coalesce((details->>'copy_rights')::boolean,true) then
  for t in select * from public.package_right_templates where package_version_id=version order by position loop
   perform private.insert_right(c,result,t.id,amendment,jsonb_build_object('description',t.description,'quantity',t.quantity,'unit',t.unit,'position',t.position));
  end loop;
 end if;
 return result;
end;$$;
revoke all on function private.insert_line(public.contracts,uuid,jsonb) from public,anon,authenticated;

create function public.add_contract_line(contract uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_internal();
 return private.insert_line(private.lock_contract(contract,'draft'),null,details);
end;$$;

create function public.remove_contract_line(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 perform private.require_internal();
 select contract_id into c from public.contract_lines where id=target;
 if c is null then raise exception 'Regel niet gevonden' using errcode='P0002'; end if;
 perform private.lock_contract(c,'draft');
 delete from public.contract_rights where contract_line_id=target;
 delete from public.contract_lines where id=target;
end;$$;

create function public.add_contract_right(contract uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_internal();
 return private.insert_right(private.lock_contract(contract,'draft'),nullif(details->>'contract_line_id','')::uuid,null,null,details);
end;$$;

create function public.remove_contract_right(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 perform private.require_internal();
 select contract_id into c from public.contract_rights where id=target;
 if c is null then raise exception 'Recht niet gevonden' using errcode='P0002'; end if;
 perform private.lock_contract(c,'draft');
 delete from public.contract_rights where id=target;
end;$$;

create function public.confirm_contract(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.contracts; snapshot jsonb;
begin
 perform private.require_internal();
 c:=private.lock_contract(target,'draft');
 if not exists(select 1 from public.contract_lines where contract_id=target) then
  raise exception 'Een contract vereist minimaal één regel' using errcode='23514';
 end if;
 select jsonb_build_object('name',s.name,'trading_name',s.trading_name,'city',s.city,'kvk',i.kvk,'vat_number',i.vat_number,
  'street',i.street,'postal_code',i.postal_code,'captured_at',now())
 into snapshot from public.sponsors s left join public.sponsor_internal i on i.sponsor_id=s.id where s.id=c.sponsor_id and s.archived_at is null;
 if snapshot is null then raise exception 'Bedrijf niet beschikbaar' using errcode='P0002'; end if;
 update public.contracts set status='confirmed',confirmed_at=now(),confirmed_by=auth.uid(),party_snapshot=snapshot where id=target;
end;$$;

create function public.terminate_contract(target uuid, details jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare c public.contracts; stop date:=(details->>'terminated_on')::date;
begin
 perform private.require_internal();
 c:=private.lock_contract(target,'confirmed');
 if stop is null or stop<c.starts_on or nullif(btrim(details->>'reason'),'') is null then
  raise exception 'Geldige einddatum en reden vereist' using errcode='23514';
 end if;
 update public.contracts set status='terminated',terminated_at=now(),terminated_on=stop,termination_reason=btrim(details->>'reason') where id=target;
end;$$;

create function public.renew_contract(target uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.contracts; result uuid; new_contract public.contracts; l record; r record; new_line uuid;
begin
 perform private.require_internal();
 c:=private.lock_contract(target,null);
 if c.status='draft' then raise exception 'Alleen een vastgelegd contract kan worden verlengd' using errcode='42501'; end if;
 perform 1 from public.sponsors where id=c.sponsor_id and archived_at is null;
 if not found then raise exception 'Bedrijf niet beschikbaar' using errcode='P0002'; end if;
 insert into public.contracts(sponsor_id,contract_number,title,starts_on,ends_on,notice_deadline,renewal_terms,terms,predecessor_contract_id)
 values(c.sponsor_id,private.next_contract_number(),coalesce(nullif(btrim(details->>'title'),''),c.title),
  (details->>'starts_on')::date,(details->>'ends_on')::date,nullif(details->>'notice_deadline','')::date,c.renewal_terms,c.terms,c.id)
 returning * into new_contract;
 result:=new_contract.id;
 -- Kopie van de actuele positieve regels en niet-geannuleerde rechten als nieuw concept.
 for l in select * from public.contract_lines where contract_id=c.id and unit_price>=0 order by position,created_at loop
  insert into public.contract_lines(contract_id,sponsor_id,package_version_id,position,title,description,quantity,unit_price,vat_rate)
  values(result,c.sponsor_id,l.package_version_id,l.position,l.title,l.description,l.quantity,l.unit_price,l.vat_rate) returning id into new_line;
  for r in select * from public.contract_rights where contract_line_id=l.id and status<>'cancelled' order by position loop
   perform private.insert_right(new_contract,new_line,r.source_template_id,null,jsonb_build_object('description',r.description,'quantity',r.quantity,'unit',r.unit,'position',r.position,'portal_visible',r.portal_visible));
  end loop;
 end loop;
 for r in select * from public.contract_rights where contract_id=c.id and contract_line_id is null and status<>'cancelled' order by position loop
  perform private.insert_right(new_contract,null,r.source_template_id,null,jsonb_build_object('description',r.description,'quantity',r.quantity,'unit',r.unit,'position',r.position,'portal_visible',r.portal_visible));
 end loop;
 return result;
end;$$;

create function public.add_contract_amendment(target uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.contracts; result uuid; seq integer; item jsonb; created_lines jsonb:='[]'; created_rights jsonb:='[]';
 cancelled jsonb:='[]'; previous jsonb:='{}'; cancel_id uuid;
 lines jsonb:=coalesce(details->'add_lines','[]'); rights jsonb:=coalesce(details->'add_rights','[]'); cancels jsonb:=coalesce(details->'cancel_rights','[]');
begin
 perform private.require_internal();
 c:=private.lock_contract(target,'confirmed');
 if jsonb_typeof(lines)<>'array' or jsonb_typeof(rights)<>'array' or jsonb_typeof(cancels)<>'array'
  or jsonb_array_length(lines)+jsonb_array_length(rights)+jsonb_array_length(cancels)>50 then
  raise exception 'Ongeldige amendementinhoud' using errcode='22023';
 end if;
 if nullif(btrim(details->>'reason'),'') is null or (details->>'effective_on') is null then
  raise exception 'Reden en ingangsdatum zijn verplicht' using errcode='23514';
 end if;
 if jsonb_array_length(lines)+jsonb_array_length(rights)+jsonb_array_length(cancels)=0
  and nullif(details->>'ends_on','') is null and not (details ? 'notice_deadline') then
  raise exception 'Een amendement bevat minimaal één wijziging' using errcode='23514';
 end if;
 perform set_config('vvp.amendment','on',true);
 select coalesce(max(sequence_number),0)+1 into seq from public.contract_amendments where contract_id=target;
 insert into public.contract_amendments(contract_id,sponsor_id,sequence_number,effective_on,reason)
 values(target,c.sponsor_id,seq,(details->>'effective_on')::date,btrim(details->>'reason')) returning id into result;
 if nullif(details->>'ends_on','') is not null or details ? 'notice_deadline' then
  previous:=jsonb_build_object('ends_on',c.ends_on,'notice_deadline',c.notice_deadline);
  update public.contracts set ends_on=coalesce(nullif(details->>'ends_on','')::date,ends_on),
   notice_deadline=case when details ? 'notice_deadline' then nullif(details->>'notice_deadline','')::date else notice_deadline end
  where id=target;
 end if;
 for item in select value from jsonb_array_elements(lines) loop
  created_lines:=created_lines||to_jsonb(private.insert_line(c,result,item-'package_version_id'));
 end loop;
 for item in select value from jsonb_array_elements(rights) loop
  created_rights:=created_rights||to_jsonb(private.insert_right(c,null,null,result,item));
 end loop;
 for item in select value from jsonb_array_elements(cancels) loop
  cancel_id:=(item#>>'{}')::uuid;
  update public.contract_rights set status='cancelled',cancelled_by_amendment_id=result where id=cancel_id and contract_id=target and status<>'cancelled';
  if not found then raise exception 'Recht niet annuleerbaar' using errcode='23514'; end if;
  cancelled:=cancelled||to_jsonb(cancel_id);
 end loop;
 -- Vastlegging van de wijziging is append-only en reconstrueerbaar.
 update public.contract_amendments set changes=jsonb_build_object('previous',previous,
  'new',jsonb_build_object('ends_on',(select ends_on from public.contracts where id=target),'notice_deadline',(select notice_deadline from public.contracts where id=target)),
  'added_lines',created_lines,'added_rights',created_rights,'cancelled_rights',cancelled) where id=result;
 perform set_config('vvp.amendment','',true);
 return result;
end;$$;

create function public.update_contract_right(target uuid, details jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 perform private.require_internal();
 select contract_id into c from public.contract_rights where id=target;
 if c is null then raise exception 'Recht niet gevonden' using errcode='P0002'; end if;
 perform private.lock_contract(c,null);
 if coalesce(details->>'status','open') not in ('open','in_progress','fulfilled') then raise exception 'Ongeldige status' using errcode='23514'; end if;
 update public.contract_rights set deadline=nullif(details->>'deadline','')::date,responsible_id=nullif(details->>'responsible_id','')::uuid,
  status=coalesce(details->>'status','open'),portal_visible=coalesce((details->>'portal_visible')::boolean,portal_visible)
 where id=target;
end;$$;

create function public.register_fulfillment(target uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare r record; result uuid;
begin
 perform private.require_internal();
 select id,sponsor_id,contract_id into r from public.contract_rights where id=target;
 if r.id is null then raise exception 'Recht niet gevonden' using errcode='P0002'; end if;
 perform private.lock_contract(r.contract_id,null);
 if (details->>'fulfilled_on')::date>(now() at time zone 'Europe/Amsterdam')::date then
  raise exception 'Uitvoerdatum ligt in de toekomst' using errcode='23514';
 end if;
 insert into public.right_fulfillments(contract_right_id,sponsor_id,fulfilled_on,quantity,description,portal_visible)
 values(r.id,r.sponsor_id,(details->>'fulfilled_on')::date,(details->>'quantity')::numeric,btrim(details->>'description'),coalesce((details->>'portal_visible')::boolean,false))
 returning id into result;
 return result;
end;$$;

create function public.review_fulfillment(target uuid, action text, reason text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_internal();
 perform 1 from public.right_fulfillments where id=target and voided_at is null for update;
 if not found then raise exception 'Uitvoering niet beschikbaar' using errcode='P0002'; end if;
 if action='verify' then
  update public.right_fulfillments set verified_by=auth.uid(),verified_at=now() where id=target and verified_at is null;
  if not found then raise exception 'Al gecontroleerd' using errcode='23514'; end if;
 elsif action='share' then update public.right_fulfillments set portal_visible=true where id=target;
 elsif action='unshare' then update public.right_fulfillments set portal_visible=false where id=target;
 elsif action='void' and nullif(btrim(reason),'') is not null then
  update public.right_fulfillments set voided_by=auth.uid(),voided_at=now(),void_reason=btrim(reason),portal_visible=false where id=target;
 else raise exception 'Ongeldige handeling' using errcode='22023';
 end if;
end;$$;

-- RPC's: documenten --------------------------------------------------------------
create function public.register_document(company uuid, details jsonb, link jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare doc uuid:=gen_random_uuid(); contract uuid:=nullif(link->>'contract_id','')::uuid; fulfillment uuid:=nullif(link->>'fulfillment_id','')::uuid;
begin
 perform private.require_internal();
 if (contract is null)=(fulfillment is null) then raise exception 'Precies één koppeling vereist' using errcode='22023'; end if;
 perform 1 from public.sponsors where id=company and archived_at is null;
 if not found then raise exception 'Bedrijf niet beschikbaar' using errcode='P0002'; end if;
 insert into public.documents(id,sponsor_id,object_path,title,sponsor_shared,board_shared,category,mime_type,size_bytes,checksum,upload_status)
 values(doc,company,company::text||'/'||doc::text,btrim(details->>'title'),coalesce((details->>'sponsor_shared')::boolean,false),
  coalesce((details->>'board_shared')::boolean,false),case when contract is not null then 'contract' else 'evidence' end,
  details->>'mime_type',(details->>'size_bytes')::integer,details->>'checksum','pending');
 if contract is not null then
  insert into public.contract_documents(contract_id,document_id,sponsor_id,document_role) values(contract,doc,company,coalesce(nullif(link->>'role',''),'contract'));
 else
  insert into public.fulfillment_evidence(right_fulfillment_id,document_id,sponsor_id) values(fulfillment,doc,company);
 end if;
 return doc;
end;$$;

create function public.finalize_document(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare d public.documents;
begin
 perform private.require_internal();
 select * into d from public.documents where id=target and upload_status='pending' for update;
 if not found then raise exception 'Document niet in afwachting' using errcode='P0002'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='private-documents' and o.name=d.object_path
  and (d.size_bytes is null or (o.metadata->>'size')::bigint=d.size_bytes)) then
  raise exception 'Bestand ontbreekt of wijkt af' using errcode='23514';
 end if;
 update public.documents set upload_status='available' where id=target;
end;$$;

do $$
declare f text;
begin
 foreach f in array array['save_package(uuid,jsonb)','set_package_archived(uuid,boolean)','save_package_version(uuid,uuid,jsonb)',
  'publish_package_version(uuid)','retire_package_version(uuid)','create_contract(uuid,jsonb)','update_contract_draft(uuid,jsonb)',
  'add_contract_line(uuid,jsonb)','remove_contract_line(uuid)','add_contract_right(uuid,jsonb)','remove_contract_right(uuid)',
  'confirm_contract(uuid)','terminate_contract(uuid,jsonb)','renew_contract(uuid,jsonb)','add_contract_amendment(uuid,jsonb)',
  'update_contract_right(uuid,jsonb)','register_fulfillment(uuid,jsonb)','review_fulfillment(uuid,text,text)',
  'register_document(uuid,jsonb,jsonb)','finalize_document(uuid)'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',f);
  execute format('grant execute on function public.%s to authenticated',f);
 end loop;
end$$;

comment on table public.contracts is 'Contractkop per bedrijf. Bevestigde baseline onveranderlijk; wijzigingen via contract_amendments.';
comment on table public.package_versions is 'Gepubliceerde versies zijn onveranderlijk. Geen officiële inhoud zonder aanlevering.';
comment on column public.contract_lines.unit_price is 'Afgesproken eenheidsprijs als momentopname; BTW-behandeling wordt in fase 6 vastgesteld.';
