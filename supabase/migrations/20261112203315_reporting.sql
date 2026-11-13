-- Fase 7: intern dashboard en rapportages.
-- Actieve sponsor = door de commissie gemarkeerd als betalend én relatiestatus actief.
-- Seizoen loopt van 1 juli t/m 30 juni. Bestuur mag alle cijfers zien, maar geen
-- interne notities of contactpersonen: alleen via deze begrensde rapportfunctie.

alter table public.sponsor_internal add column is_paying boolean not null default false;
grant update(is_paying) on public.sponsor_internal to authenticated;
create index sponsor_internal_paying on public.sponsor_internal(status,is_paying);

-- save_sponsor uitgebreid met de betalende-sponsorvlag; verder ongewijzigd.
create or replace function public.save_sponsor(target uuid, details jsonb) returns uuid language plpgsql set search_path='' as $$
declare result uuid;
begin
 if private.current_app_role() not in ('super_admin','sponsorcommissie') or private.current_app_role() is null then raise insufficient_privilege;end if;
 if target is null then
 insert into public.sponsors(name,trading_name,website,city) values(details->>'name',nullif(details->>'trading_name',''),nullif(details->>'website',''),nullif(details->>'city','')) returning id into result;
 else
 update public.sponsors set name=details->>'name',trading_name=nullif(details->>'trading_name',''),website=nullif(details->>'website',''),city=nullif(details->>'city','') where id=target and archived_at is null returning id into result;
 if result is null then raise exception 'Bedrijf niet beschikbaar';end if;
 end if;
 insert into public.sponsor_internal(sponsor_id,status,kvk,vat_number,street,postal_code,email,phone,notes,owner_id,is_paying)
 values(result,coalesce(details->>'status','prospect'),nullif(details->>'kvk',''),nullif(details->>'vat_number',''),nullif(details->>'street',''),nullif(details->>'postal_code',''),nullif(details->>'email',''),nullif(details->>'phone',''),nullif(details->>'notes',''),nullif(details->>'owner_id','')::uuid,coalesce((details->>'is_paying')::boolean,false))
 on conflict(sponsor_id) do update set status=excluded.status,kvk=excluded.kvk,vat_number=excluded.vat_number,street=excluded.street,postal_code=excluded.postal_code,email=excluded.email,phone=excluded.phone,notes=excluded.notes,owner_id=excluded.owner_id,is_paying=excluded.is_paying;
 return result;
end;$$;
revoke all on function public.save_sponsor(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_sponsor(uuid,jsonb) to authenticated;

create function private.require_reporting() returns void language plpgsql stable set search_path='' as $$
begin
 if coalesce(private.current_app_role() in ('super_admin','sponsorcommissie','clubbestuur'),false) is not true then
  raise insufficient_privilege;
 end if;
end;$$;
revoke all on function private.require_reporting() from public,anon,authenticated;

create function private.current_season() returns integer language sql stable set search_path='' as $$
 select case when extract(month from private.today())>=7 then extract(year from private.today())::integer
  else extract(year from private.today())::integer-1 end;
$$;
revoke all on function private.current_season() from public,anon,authenticated;

-- Contractwaarde per seizoen naar rato van looptijddagen; bij beëindiging tot de
-- einddatum van beëindiging. Contractwaarde ≠ facturatie ≠ ontvangst.
create function private.season_contract_values(season integer) returns table(
 contract_id uuid, sponsor_id uuid, contract_number text, title text, status text,
 starts_on date, ends_on date, notice_deadline date, terminated_on date,
 total_value numeric, season_value numeric)
language sql stable security definer set search_path='' as $$
 select c.id,c.sponsor_id,c.contract_number,c.title,c.status,c.starts_on,c.ends_on,c.notice_deadline,c.terminated_on,
  t.current_total,
  round(t.current_total*greatest(0,
   least(case when c.status='terminated' then least(c.ends_on,c.terminated_on) else c.ends_on end,make_date(season+1,6,30))
   -greatest(c.starts_on,make_date(season,7,1))+1)::numeric/(c.ends_on-c.starts_on+1),2)
 from public.contracts c join public.contract_totals t on t.contract_id=c.id
 where c.status<>'draft';
$$;
revoke all on function private.season_contract_values(integer) from public,anon,authenticated;

create function private.season_money(season integer) returns table(invoiced numeric, received numeric)
language sql stable security definer set search_path='' as $$
 select
  coalesce((select sum(case when b.kind='invoice' then b.total else -b.total end) from public.invoice_balances b
   where b.status='issued' and b.issue_date between make_date(season,7,1) and make_date(season+1,6,30)),0),
  coalesce((select sum(case when p.direction='in' then p.amount else -p.amount end) from public.payments p
   where p.status='registered' and p.received_on between make_date(season,7,1) and make_date(season+1,6,30)),0);
$$;
revoke all on function private.season_money(integer) from public,anon,authenticated;

create function public.report_dashboard(season integer default null, detailed boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s integer:=coalesce(season,private.current_season()); s_start date; s_end date; today date:=private.today();
 result jsonb;
begin
 perform private.require_reporting();
 if s<2000 or s>2100 then raise exception 'Ongeldig seizoen' using errcode='22023'; end if;
 s_start:=make_date(s,7,1); s_end:=make_date(s+1,6,30);
 with paying as (
  select sp.id from public.sponsors sp join public.sponsor_internal i on i.sponsor_id=sp.id
  where i.status='active' and i.is_paying and sp.archived_at is null),
 cv as (select * from private.season_contract_values(s)),
 money as (select * from private.season_money(s)),
 open_inv as (select b.* from public.invoice_balances b where b.kind='invoice' and b.status='issued' and b.open_amount>0),
 expiring as (
  select c.id,c.contract_number,c.title,c.ends_on,c.notice_deadline,sp.name,sp.id as sponsor_id,t.current_total,
   exists(select 1 from public.contracts n where n.predecessor_contract_id=c.id) as has_successor
  from public.contracts c join public.sponsors sp on sp.id=c.sponsor_id join public.contract_totals t on t.contract_id=c.id
  where c.status='confirmed' and c.ends_on between today and today+180)
 select jsonb_build_object(
  'season',s,'season_start',s_start,'season_end',s_end,'today',today,'current_season',private.current_season(),
  'kpis',jsonb_build_object(
   'active_paying',(select count(*) from paying),
   'budget_paying',(select coalesce(sum(season_value),0) from cv where sponsor_id in (select id from paying)),
   'contract_value',(select coalesce(sum(season_value),0) from cv),
   'invoiced',(select invoiced from money),
   'received',(select received from money),
   'open_now',(select coalesce(sum(open_amount),0) from open_inv),
   'overdue_now',(select coalesce(sum(open_amount),0) from open_inv where due_on<today),
   'expiring_90',(select count(*) from expiring where ends_on<=today+90 and not has_successor),
   'expiring_value_90',(select coalesce(sum(current_total),0) from expiring where ends_on<=today+90 and not has_successor),
   'notice_60',(select count(*) from public.contracts where status='confirmed' and notice_deadline between today and today+60),
   'prospects',(select count(*) from public.sponsor_internal i join public.sponsors sp on sp.id=i.sponsor_id where i.status='prospect' and sp.archived_at is null)),
  'seasons',(select coalesce(jsonb_agg(jsonb_build_object('season',y,
     'contract_value',(select coalesce(sum(season_value),0) from private.season_contract_values(y)),
     'invoiced',(select invoiced from private.season_money(y)),
     'received',(select received from private.season_money(y))) order by y),'[]'::jsonb)
   from generate_series(s-4,s) y),
  'monthly',(select coalesce(jsonb_agg(jsonb_build_object('month',m,'invoiced',inv,'received',rec,
     'invoiced_cumulative',sum(inv) over (order by m),'received_cumulative',sum(rec) over (order by m)) order by m),'[]'::jsonb)
   from (select m::date as m,
     coalesce((select sum(case when b.kind='invoice' then b.total else -b.total end) from public.invoice_balances b
      where b.status='issued' and date_trunc('month',b.issue_date)=m),0) as inv,
     coalesce((select sum(case when p.direction='in' then p.amount else -p.amount end) from public.payments p
      where p.status='registered' and date_trunc('month',p.received_on)=m),0) as rec
    from generate_series(s_start,s_end,interval '1 month') m) months),
  'sponsors',(select coalesce(jsonb_agg(x order by (x->>'contract_value')::numeric desc,x->>'name'),'[]'::jsonb) from (
    select jsonb_build_object('sponsor_id',sp.id,'name',sp.name,'status',i.status,'is_paying',i.is_paying,'archived',sp.archived_at is not null,
     'contract_value',(select coalesce(sum(season_value),0) from cv where cv.sponsor_id=sp.id),
     'invoiced',coalesce((select sum(case when b.kind='invoice' then b.total else -b.total end) from public.invoice_balances b
       where b.sponsor_id=sp.id and b.status='issued' and b.issue_date between s_start and s_end),0),
     'received',coalesce((select sum(case when p.direction='in' then p.amount else -p.amount end) from public.payments p
       where p.sponsor_id=sp.id and p.status='registered' and p.received_on between s_start and s_end),0),
     'open_now',coalesce((select sum(open_amount) from open_inv o where o.sponsor_id=sp.id),0)) as x
    from public.sponsors sp join public.sponsor_internal i on i.sponsor_id=sp.id
    where (i.status='active' and i.is_paying and sp.archived_at is null)
     or exists(select 1 from cv where cv.sponsor_id=sp.id and cv.season_value<>0)
     or exists(select 1 from public.invoices v where v.sponsor_id=sp.id and v.status='issued' and v.issue_date between s_start and s_end)
     or exists(select 1 from open_inv o where o.sponsor_id=sp.id)) q),
  'expiring',(select coalesce(jsonb_agg(jsonb_build_object('contract_id',id,'contract_number',contract_number,'title',title,
     'sponsor_id',sponsor_id,'sponsor',name,'ends_on',ends_on,'notice_deadline',notice_deadline,'value',current_total,
     'has_successor',has_successor) order by ends_on),'[]'::jsonb) from expiring),
  'prospects',(select coalesce(jsonb_agg(jsonb_build_object('sponsor_id',sp.id,'name',sp.name,'city',sp.city,'updated_at',i.updated_at)
     order by i.updated_at desc),'[]'::jsonb)
   from public.sponsor_internal i join public.sponsors sp on sp.id=i.sponsor_id where i.status='prospect' and sp.archived_at is null)
 ) into result;
 if detailed then
  result:=result||jsonb_build_object(
   'contracts',(select coalesce(jsonb_agg(jsonb_build_object('contract_number',cv.contract_number,'sponsor',sp.name,'title',cv.title,
      'status',cv.status,'starts_on',cv.starts_on,'ends_on',cv.ends_on,'notice_deadline',cv.notice_deadline,'terminated_on',cv.terminated_on,
      'total_value',cv.total_value,'season_value',cv.season_value) order by sp.name,cv.contract_number),'[]'::jsonb)
    from cv join public.sponsors sp on sp.id=cv.sponsor_id
    where cv.starts_on<=s_end and cv.ends_on>=s_start),
   'invoices',(select coalesce(jsonb_agg(jsonb_build_object('invoice_number',b.invoice_number,'kind',b.kind,'sponsor',sp.name,
      'issue_date',b.issue_date,'due_on',b.due_on,'total',b.total,'vat_total',b.vat_total,'total_excl_vat',b.total_excl_vat,
      'paid',b.paid,'credited',b.credited+b.credit_applied,'open_amount',b.open_amount) order by b.invoice_number),'[]'::jsonb)
    from public.invoice_balances b join public.sponsors sp on sp.id=b.sponsor_id
    where b.status='issued' and b.issue_date between s_start and s_end),
   'payments',(select coalesce(jsonb_agg(jsonb_build_object('received_on',p.received_on,'sponsor',sp.name,'direction',p.direction,
      'method',p.method,'reference',p.reference,'amount',p.amount,'allocated',pb.allocated,'unallocated',pb.unallocated) order by p.received_on,p.id),'[]'::jsonb)
    from public.payments p join public.payment_balances pb on pb.payment_id=p.id join public.sponsors sp on sp.id=p.sponsor_id
    where p.status='registered' and p.received_on between s_start and s_end));
 end if;
 return result;
end;$$;
revoke all on function public.report_dashboard(integer,boolean) from public,anon,authenticated;
grant execute on function public.report_dashboard(integer,boolean) to authenticated;

-- Exports worden gelogd (wie, welk seizoen, wanneer); geen inhoud.
create table private.report_exports (
 id bigint generated always as identity primary key,
 actor uuid not null references auth.users(id),
 season integer not null,
 created_at timestamptz not null default now()
);
alter table private.report_exports enable row level security;
revoke all on private.report_exports from public,anon,authenticated;
create function public.log_report_export(season integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_reporting();
 insert into private.report_exports(actor,season) values(auth.uid(),season);
end;$$;
revoke all on function public.log_report_export(integer) from public,anon,authenticated;
grant execute on function public.log_report_export(integer) to authenticated;
