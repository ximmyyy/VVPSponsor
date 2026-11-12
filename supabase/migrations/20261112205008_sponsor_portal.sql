-- Fase 8: persoonlijk sponsorportaal.
-- Contact via e-mail naar een door Super Admin ingesteld clubadres; wijzigingsverzoeken
-- voor bedrijfsgegevens met beoordeling door de commissie; sponsors nodigen collega's
-- van hun eigen bedrijf uit en trekken hun toegang in. Bedrijfs-ID komt altijd uit de
-- actieve machtiging van de aanroeper, nooit uit de client.

alter table public.club_settings
 add column contact_email text check(contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(contact_email)<=254);
grant update(contact_email) on public.club_settings to authenticated;
-- Eén configuratierij met de aangeleverde clubnaam; contactadres blijft leeg tot Super Admin het invult.
insert into public.club_settings(id,club_name) values(true,'VV Pernis') on conflict(id) do nothing;

create function private.current_sponsor() returns uuid language sql stable security definer set search_path='' as $$
 select m.sponsor_id from private.sponsor_memberships m
 where m.user_id=auth.uid() and m.is_active and private.current_app_role()='sponsor';
$$;
revoke all on function private.current_sponsor() from public,anon,authenticated;

create function private.require_sponsor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare company uuid:=private.current_sponsor();
begin
 if company is null then raise insufficient_privilege; end if;
 return company;
end;$$;
revoke all on function private.require_sponsor() from public,anon,authenticated;

-- Eigen bedrijfsgegevens voor het portaal: logische zakelijke velden, geen interne status,
-- notities, verantwoordelijke of betaalvlag.
create function public.portal_company() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare company uuid:=private.require_sponsor(); result jsonb;
begin
 select jsonb_build_object('id',s.id,'name',s.name,'trading_name',s.trading_name,'website',s.website,'city',s.city,
  'kvk',i.kvk,'vat_number',i.vat_number,'street',i.street,'postal_code',i.postal_code,'email',i.email,'phone',i.phone,
  'archived',s.archived_at is not null)
 into result from public.sponsors s left join public.sponsor_internal i on i.sponsor_id=s.id where s.id=company;
 return result;
end;$$;
revoke all on function public.portal_company() from public,anon,authenticated;
grant execute on function public.portal_company() to authenticated;

-- Wijzigingsverzoeken ----------------------------------------------------------------
create table public.sponsor_requests (
 id uuid primary key default gen_random_uuid(),
 sponsor_id uuid not null references public.sponsors(id) on delete restrict,
 requested_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
 kind text not null default 'profile' check(kind='profile'),
 proposed jsonb not null check(jsonb_typeof(proposed)='object' and proposed<>'{}'::jsonb),
 message text check(length(message)<=2000),
 status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
 reviewed_by uuid references auth.users(id) on delete restrict,
 reviewed_at timestamptz,
 answer text check(length(answer)<=2000),
 previous jsonb check(previous is null or jsonb_typeof(previous)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((status in ('approved','rejected'))=(reviewed_at is not null and reviewed_by is not null)),
 check(status<>'approved' or previous is not null)
);
create index on public.sponsor_requests(sponsor_id,status);
create index on public.sponsor_requests(status,created_at);
create trigger requests_timestamp before update on public.sponsor_requests for each row execute function private.set_updated_at();
alter table public.sponsor_requests enable row level security;
revoke all on public.sponsor_requests from public,anon,authenticated;
grant select on public.sponsor_requests to authenticated;
create policy requests_read on public.sponsor_requests for select to authenticated using (
 (select private.is_internal()) or (select private.is_sponsor_of(sponsor_id)));
create trigger requests_audit after insert or update on public.sponsor_requests for each row execute function private.audit_crm();

create function private.guard_request() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Verzoeken worden niet verwijderd' using errcode='42501'; end if;
 if old.status<>'pending' then raise exception 'Afgehandeld verzoek is onveranderlijk' using errcode='42501'; end if;
 if new.sponsor_id<>old.sponsor_id or new.proposed<>old.proposed or new.requested_by<>old.requested_by or new.created_at<>old.created_at then
  raise exception 'Verzoekinhoud is onveranderlijk' using errcode='42501';
 end if;
 return new;
end;$$;
revoke all on function private.guard_request() from public,anon,authenticated;
create trigger requests_guard before update or delete on public.sponsor_requests for each row execute function private.guard_request();

-- Alleen toegestane velden, met dezelfde vorm als de CRM-constraints.
create function private.clean_profile_request(details jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:='{}'::jsonb; k text; v text;
 allowed text[]:=array['name','trading_name','website','city','kvk','vat_number','street','postal_code','email','phone'];
 limits integer[]:=array[160,160,500,120,8,32,200,20,254,40];
begin
 if jsonb_typeof(details)<>'object' then raise exception 'Ongeldig verzoek' using errcode='22023'; end if;
 for k in select jsonb_object_keys(details) loop
  if not k=any(allowed) then raise exception 'Veld % kan niet via het portaal worden gewijzigd',k using errcode='42501'; end if;
  if jsonb_typeof(details->k) not in ('string','null') then raise exception 'Ongeldige waarde' using errcode='22023'; end if;
  v:=btrim(coalesce(details->>k,''));
  if length(v)>limits[array_position(allowed,k)] then raise exception 'Waarde te lang' using errcode='23514'; end if;
  if k='name' and v='' then raise exception 'Bedrijfsnaam is verplicht' using errcode='23514'; end if;
  if k='kvk' and v<>'' and v !~ '^[0-9]{8}$' then raise exception 'KvK-nummer heeft 8 cijfers' using errcode='23514'; end if;
  if k='email' and v<>'' and v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Ongeldig e-mailadres' using errcode='23514'; end if;
  if k='website' and v<>'' and v !~ '^https?://[^[:space:]]+$' then raise exception 'Ongeldige website' using errcode='23514'; end if;
  result:=result||jsonb_build_object(k,v);
 end loop;
 return result;
end;$$;
revoke all on function private.clean_profile_request(jsonb) from public,anon,authenticated;

create function public.submit_profile_request(details jsonb, message text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare company uuid:=private.require_sponsor(); clean jsonb:=private.clean_profile_request(details);
 current jsonb:=public.portal_company(); changed jsonb:='{}'::jsonb; k text; result uuid;
begin
 perform 1 from public.sponsors where id=company and archived_at is null;
 if not found then raise exception 'Bedrijf niet beschikbaar' using errcode='P0002'; end if;
 for k in select jsonb_object_keys(clean) loop
  if coalesce(current->>k,'')<>clean->>k then changed:=changed||jsonb_build_object(k,clean->k); end if;
 end loop;
 if changed='{}'::jsonb then raise exception 'Er is niets gewijzigd' using errcode='23514'; end if;
 if (select count(*) from public.sponsor_requests where sponsor_id=company and status='pending')>=5 then
  raise exception 'Te veel openstaande verzoeken' using errcode='23514';
 end if;
 insert into public.sponsor_requests(sponsor_id,proposed,message) values(company,changed,nullif(btrim(message),'')) returning id into result;
 return result;
end;$$;

create function public.withdraw_request(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare company uuid:=private.require_sponsor();
begin
 update public.sponsor_requests set status='withdrawn' where id=target and sponsor_id=company and status='pending';
 if not found then raise exception 'Verzoek niet (meer) open' using errcode='P0002'; end if;
end;$$;

create function public.review_request(target uuid, approve boolean, reply text default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.sponsor_requests; before jsonb; p jsonb;
begin
 perform private.require_internal();
 select * into r from public.sponsor_requests where id=target for update;
 if not found or r.status<>'pending' then raise exception 'Verzoek niet (meer) open' using errcode='P0002'; end if;
 if not approve then
  if nullif(btrim(reply),'') is null then raise exception 'Geef een toelichting bij afwijzen' using errcode='23514'; end if;
  update public.sponsor_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),answer=btrim(reply) where id=target;
  return;
 end if;
 perform 1 from public.sponsors where id=r.sponsor_id and archived_at is null for update;
 if not found then raise exception 'Bedrijf niet beschikbaar' using errcode='P0002'; end if;
 p:=private.clean_profile_request(r.proposed);
 select jsonb_build_object('name',s.name,'trading_name',s.trading_name,'website',s.website,'city',s.city,'kvk',i.kvk,
  'vat_number',i.vat_number,'street',i.street,'postal_code',i.postal_code,'email',i.email,'phone',i.phone)
 into before from public.sponsors s left join public.sponsor_internal i on i.sponsor_id=s.id where s.id=r.sponsor_id;
 update public.sponsors set
  name=case when p ? 'name' then p->>'name' else name end,
  trading_name=case when p ? 'trading_name' then nullif(p->>'trading_name','') else trading_name end,
  website=case when p ? 'website' then nullif(p->>'website','') else website end,
  city=case when p ? 'city' then nullif(p->>'city','') else city end
 where id=r.sponsor_id;
 update public.sponsor_internal set
  kvk=case when p ? 'kvk' then nullif(p->>'kvk','') else kvk end,
  vat_number=case when p ? 'vat_number' then nullif(p->>'vat_number','') else vat_number end,
  street=case when p ? 'street' then nullif(p->>'street','') else street end,
  postal_code=case when p ? 'postal_code' then nullif(p->>'postal_code','') else postal_code end,
  email=case when p ? 'email' then nullif(p->>'email','') else email end,
  phone=case when p ? 'phone' then nullif(p->>'phone','') else phone end
 where sponsor_id=r.sponsor_id;
 update public.sponsor_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),
  answer=nullif(btrim(reply),''),previous=(select jsonb_object_agg(k,before->k) from jsonb_object_keys(p) k)
 where id=target;
end;$$;

-- Collega's uitnodigen --------------------------------------------------------------
create table public.sponsor_invitations (
 id uuid primary key default gen_random_uuid(),
 sponsor_id uuid not null references public.sponsors(id) on delete restrict,
 email text not null check(email=lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(email)<=254),
 invited_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_user_id uuid references auth.users(id) on delete restrict,
 accepted_at timestamptz,
 check((accepted_user_id is null)=(accepted_at is null))
);
create index on public.sponsor_invitations(sponsor_id,created_at);
create index on public.sponsor_invitations(accepted_user_id);
alter table public.sponsor_invitations enable row level security;
revoke all on public.sponsor_invitations from public,anon,authenticated;
grant select on public.sponsor_invitations to authenticated;
create policy invitations_read on public.sponsor_invitations for select to authenticated using (
 (select private.is_internal()) or (select private.is_sponsor_of(sponsor_id)));
create trigger invitations_audit after insert or update on public.sponsor_invitations for each row execute function private.audit_crm();

create function public.portal_create_invitation(invitee text) returns uuid
language plpgsql security definer set search_path='' as $$
declare company uuid:=private.require_sponsor(); clean text:=lower(btrim(invitee)); result uuid;
begin
 perform 1 from public.sponsors where id=company and archived_at is null for update;
 if not found then raise exception 'Bedrijf niet beschikbaar' using errcode='P0002'; end if;
 if (select count(*) from public.sponsor_invitations where sponsor_id=company and created_at>now()-interval '1 day')>=10 then
  raise exception 'Maximaal 10 uitnodigingen per dag' using errcode='23514';
 end if;
 insert into public.sponsor_invitations(sponsor_id,email) values(company,clean) returning id into result;
 return result;
end;$$;

-- Koppelt uitsluitend een account dat door deze uitnodiging nieuw is aangemaakt:
-- zelfde e-mail, aangemaakt na de uitnodiging, zonder bestaande rol of machtiging.
create function public.portal_accept_invitation(invitation uuid, target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare company uuid:=private.require_sponsor(); inv public.sponsor_invitations;
begin
 select * into inv from public.sponsor_invitations where id=invitation for update;
 if not found or inv.sponsor_id<>company or inv.accepted_at is not null or inv.expires_at<now() then
  raise exception 'Uitnodiging niet geldig' using errcode='42501';
 end if;
 perform 1 from auth.users u where u.id=target for update;
 if not exists(select 1 from auth.users u where u.id=target and lower(u.email)=inv.email and u.created_at>=inv.created_at)
  or exists(select 1 from private.user_access where user_id=target)
  or exists(select 1 from private.sponsor_memberships where user_id=target) then
  raise exception 'Account komt niet overeen met de uitnodiging' using errcode='42501';
 end if;
 insert into private.user_access(user_id,role,is_active) values(target,'sponsor',true);
 insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values(target,company,true);
 update public.sponsor_invitations set accepted_user_id=target,accepted_at=now() where id=invitation;
end;$$;

create function public.portal_members() returns table(user_id uuid, email text, is_active boolean, is_self boolean)
language plpgsql stable security definer set search_path='' as $$
declare company uuid:=private.require_sponsor();
begin
 return query select m.user_id,u.email::text,m.is_active,m.user_id=auth.uid()
  from private.sponsor_memberships m join auth.users u on u.id=m.user_id
  where m.sponsor_id=company order by m.is_active desc,u.email;
end;$$;

create function public.portal_revoke_member(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare company uuid:=private.require_sponsor();
begin
 if target=auth.uid() then raise exception 'Eigen toegang niet intrekken' using errcode='42501'; end if;
 update private.sponsor_memberships set is_active=false where user_id=target and sponsor_id=company and is_active;
 if not found then raise exception 'Gebruiker niet gevonden bij dit bedrijf' using errcode='P0002'; end if;
end;$$;

do $$
declare f text;
begin
 foreach f in array array['submit_profile_request(jsonb,text)','withdraw_request(uuid)','review_request(uuid,boolean,text)',
  'portal_create_invitation(text)','portal_accept_invitation(uuid,uuid)','portal_members()','portal_revoke_member(uuid)'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',f);
  execute format('grant execute on function public.%s to authenticated',f);
 end loop;
end$$;
