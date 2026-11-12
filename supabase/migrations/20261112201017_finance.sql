-- Fase 6: financieel beheer. Contractwaarde, facturatie, credits en ontvangsten
-- blijven gescheiden. Prijzen zijn inclusief BTW (standaard 21%); de BTW wordt
-- per regel uit het regelbedrag gerekend. Nummering F-/C-JJJJ-NNNN gatenvrij bij
-- uitreiken. Schrijven uitsluitend via begrensde RPC's; triggers bewaken historie.

alter table public.documents drop constraint documents_category_check;
alter table public.documents add constraint documents_category_check check(category in ('general','contract','evidence','invoice'));

create table private.invoice_counters (
 kind text not null check(kind in ('F','C')),
 year integer not null check(year between 2000 and 9999),
 last_value integer not null check(last_value>0),
 primary key(kind,year)
);
alter table private.invoice_counters enable row level security;
revoke all on private.invoice_counters from public,anon,authenticated;

create table public.invoices (
 id uuid primary key default gen_random_uuid(),
 sponsor_id uuid not null references public.sponsors(id) on delete restrict,
 kind text not null default 'invoice' check(kind in ('invoice','credit')),
 status text not null default 'draft' check(status in ('draft','issued')),
 invoice_number text unique check(invoice_number ~ '^[FC]-[0-9]{4}-[0-9]{4,}$'),
 contract_id uuid,
 original_invoice_id uuid,
 reference text check(length(reference)<=200),
 issue_date date,
 due_on date,
 currency text not null default 'EUR' check(currency='EUR'),
 prices_include_vat boolean not null default true check(prices_include_vat),
 billing_snapshot jsonb check(billing_snapshot is null or jsonb_typeof(billing_snapshot)='object'),
 issued_at timestamptz,
 issued_by uuid references auth.users(id) on delete restrict,
 created_by uuid references auth.users(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,sponsor_id),
 check((kind='credit')=(original_invoice_id is not null)),
 check(original_invoice_id is null or original_invoice_id<>id),
 check((status='issued')=(invoice_number is not null and issue_date is not null and due_on is not null and billing_snapshot is not null and issued_at is not null)),
 check(due_on is null or issue_date is null or due_on>=issue_date),
 check(invoice_number is null or left(invoice_number,1)=case kind when 'invoice' then 'F' else 'C' end),
 foreign key(contract_id,sponsor_id) references public.contracts(id,sponsor_id) on delete restrict,
 foreign key(original_invoice_id,sponsor_id) references public.invoices(id,sponsor_id) on delete restrict
);
create index invoices_sponsor_due on public.invoices(sponsor_id,due_on);
create index on public.invoices(sponsor_id,status);
create index on public.invoices(contract_id);
create index on public.invoices(original_invoice_id);
create trigger invoices_timestamp before update on public.invoices for each row execute function private.set_updated_at();

create table public.invoice_lines (
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null,
 sponsor_id uuid not null,
 contract_line_id uuid,
 position integer not null default 0,
 description text not null check(length(btrim(description)) between 1 and 500),
 quantity numeric(12,2) not null check(quantity>0),
 unit_price numeric(14,4) not null check(abs(unit_price)<10000000000),
 vat_rate numeric(5,2) not null default 21 check(vat_rate between 0 and 100),
 -- Bedrag inclusief BTW; BTW-deel per regel afgerond op centen.
 line_total numeric(14,2) generated always as (round(quantity*unit_price,2)) stored,
 vat_amount numeric(14,2) generated always as (round(round(quantity*unit_price,2)*vat_rate/(100+vat_rate),2)) stored,
 created_at timestamptz not null default now(),
 foreign key(invoice_id,sponsor_id) references public.invoices(id,sponsor_id) on delete restrict,
 foreign key(contract_line_id,sponsor_id) references public.contract_lines(id,sponsor_id) on delete restrict
);
create index on public.invoice_lines(invoice_id);
create index on public.invoice_lines(contract_line_id);
create index on public.invoice_lines(sponsor_id);

create table public.payments (
 id uuid primary key default gen_random_uuid(),
 sponsor_id uuid not null references public.sponsors(id) on delete restrict,
 direction text not null default 'in' check(direction in ('in','out')),
 received_on date not null,
 amount numeric(14,2) not null check(amount>0 and amount<1000000000000),
 currency text not null default 'EUR' check(currency='EUR'),
 method text not null check(method in ('bank','cash','other')),
 reference text check(length(reference)<=200),
 status text not null default 'registered' check(status in ('registered','reversed')),
 reversed_at timestamptz,
 reversed_by uuid references auth.users(id) on delete restrict,
 reversal_reason text check(length(reversal_reason)<=2000),
 registered_by uuid references auth.users(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),
 unique(id,sponsor_id),
 check((status='reversed')=(reversed_at is not null and reversal_reason is not null))
);
create index payments_sponsor_date on public.payments(sponsor_id,received_on);

create table public.payment_allocations (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null,
 invoice_id uuid not null,
 sponsor_id uuid not null,
 amount numeric(14,2) not null check(amount>0),
 created_by uuid references auth.users(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),
 reversed_at timestamptz,
 reversed_by uuid references auth.users(id) on delete restrict,
 foreign key(payment_id,sponsor_id) references public.payments(id,sponsor_id) on delete restrict,
 foreign key(invoice_id,sponsor_id) references public.invoices(id,sponsor_id) on delete restrict
);
create index on public.payment_allocations(payment_id);
create index on public.payment_allocations(invoice_id);
create index on public.payment_allocations(sponsor_id);

create table public.credit_allocations (
 id uuid primary key default gen_random_uuid(),
 credit_invoice_id uuid not null,
 target_invoice_id uuid not null,
 sponsor_id uuid not null,
 amount numeric(14,2) not null check(amount>0),
 created_by uuid references auth.users(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),
 reversed_at timestamptz,
 reversed_by uuid references auth.users(id) on delete restrict,
 check(credit_invoice_id<>target_invoice_id),
 foreign key(credit_invoice_id,sponsor_id) references public.invoices(id,sponsor_id) on delete restrict,
 foreign key(target_invoice_id,sponsor_id) references public.invoices(id,sponsor_id) on delete restrict
);
create index on public.credit_allocations(credit_invoice_id);
create index on public.credit_allocations(target_invoice_id);
create index on public.credit_allocations(sponsor_id);

create table public.invoice_documents (
 invoice_id uuid not null,
 document_id uuid not null,
 sponsor_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(invoice_id,document_id),
 foreign key(invoice_id,sponsor_id) references public.invoices(id,sponsor_id) on delete restrict,
 foreign key(document_id,sponsor_id) references public.documents(id,sponsor_id) on delete restrict
);
create index on public.invoice_documents(document_id);
create index on public.invoice_documents(sponsor_id);
create trigger invoice_documents_append_only before update or delete on public.invoice_documents for each row execute function private.guard_append_only();

-- Historiebewaking ------------------------------------------------------------
create function private.guard_invoice() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.status='draft' then return old; end if;
  raise exception 'Uitgereikte facturen worden niet verwijderd' using errcode='42501';
 end if;
 if new.sponsor_id<>old.sponsor_id or new.kind<>old.kind or new.original_invoice_id is distinct from old.original_invoice_id then
  raise exception 'Bedrijf, soort en oorspronkelijke factuur zijn onveranderlijk' using errcode='42501';
 end if;
 if old.status='draft' then return new; end if;
 if (to_jsonb(new)-'updated_at')<>(to_jsonb(old)-'updated_at') then
  raise exception 'Uitgereikte factuur is onveranderlijk; corrigeer met een creditnota' using errcode='42501';
 end if;
 return new;
end;$$;
revoke all on function private.guard_invoice() from public,anon,authenticated;
create trigger invoices_guard before update or delete on public.invoices for each row execute function private.guard_invoice();

create function private.guard_invoice_line() returns trigger language plpgsql set search_path='' as $$
declare target uuid:=case when tg_op='DELETE' then old.invoice_id else new.invoice_id end;
begin
 if tg_op='UPDATE' and (new.invoice_id<>old.invoice_id or new.sponsor_id<>old.sponsor_id) then
  raise exception 'Regel niet verplaatsen' using errcode='42501';
 end if;
 if not exists(select 1 from public.invoices where id=target and status='draft') then
  raise exception 'Regels van een uitgereikte factuur zijn onveranderlijk' using errcode='42501';
 end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
revoke all on function private.guard_invoice_line() from public,anon,authenticated;
create trigger invoice_lines_guard before insert or update or delete on public.invoice_lines for each row execute function private.guard_invoice_line();

create function private.guard_payment() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Betalingen worden niet verwijderd; draai terug met reden' using errcode='42501'; end if;
 if old.status='registered' and new.status='reversed'
  and (to_jsonb(new)-'status'-'reversed_at'-'reversed_by'-'reversal_reason')=(to_jsonb(old)-'status'-'reversed_at'-'reversed_by'-'reversal_reason') then
  return new;
 end if;
 raise exception 'Geregistreerde betaling is onveranderlijk' using errcode='42501';
end;$$;
revoke all on function private.guard_payment() from public,anon,authenticated;
create trigger payments_guard before update or delete on public.payments for each row execute function private.guard_payment();

create function private.guard_allocation() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Toewijzingen worden niet verwijderd; draai terug' using errcode='42501'; end if;
 if old.reversed_at is null and new.reversed_at is not null
  and (to_jsonb(new)-'reversed_at'-'reversed_by')=(to_jsonb(old)-'reversed_at'-'reversed_by') then
  return new;
 end if;
 raise exception 'Toewijzing is onveranderlijk' using errcode='42501';
end;$$;
revoke all on function private.guard_allocation() from public,anon,authenticated;
create trigger payment_allocations_guard before update or delete on public.payment_allocations for each row execute function private.guard_allocation();
create trigger credit_allocations_guard before update or delete on public.credit_allocations for each row execute function private.guard_allocation();

-- RLS en grants -----------------------------------------------------------------
do $$
declare t text;
begin
 foreach t in array array['invoices','invoice_lines','payments','payment_allocations','credit_allocations','invoice_documents'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end$$;
-- Sponsor: alleen eigen uitgereikte facturen en eigen niet-teruggedraaide betalingen.
-- Bestuur krijgt financiële inzage via rapportages (fase 7).
create policy invoices_read on public.invoices for select to authenticated using (
 (select private.is_internal()) or (status='issued' and (select private.is_sponsor_of(sponsor_id))));
create policy invoice_lines_read on public.invoice_lines for select to authenticated using (
 (select private.is_internal()) or ((select private.is_sponsor_of(sponsor_id))
  and exists(select 1 from public.invoices i where i.id=invoice_id and i.status='issued')));
create policy payments_read on public.payments for select to authenticated using (
 (select private.is_internal()) or (status='registered' and (select private.is_sponsor_of(sponsor_id))));
create policy payment_allocations_read on public.payment_allocations for select to authenticated using (
 (select private.is_internal()) or (reversed_at is null and (select private.is_sponsor_of(sponsor_id))
  and exists(select 1 from public.payments p where p.id=payment_id)
  and exists(select 1 from public.invoices i where i.id=invoice_id)));
create policy credit_allocations_read on public.credit_allocations for select to authenticated using (
 (select private.is_internal()) or (reversed_at is null and (select private.is_sponsor_of(sponsor_id))
  and exists(select 1 from public.invoices i where i.id=credit_invoice_id)
  and exists(select 1 from public.invoices i where i.id=target_invoice_id)));
create policy invoice_documents_read on public.invoice_documents for select to authenticated using (
 (select private.is_internal()) or ((select private.is_sponsor_of(sponsor_id))
  and exists(select 1 from public.documents d where d.id=document_id)
  and exists(select 1 from public.invoices i where i.id=invoice_id)));

-- Centrale afgeleide bedragen (views volgen RLS van de lezer) -----------------------
create view public.invoice_balances with (security_invoker=true) as
 select i.id as invoice_id, i.sponsor_id, i.kind, i.status, i.invoice_number, i.issue_date, i.due_on,
  coalesce(l.total,0)::numeric(14,2) as total,
  coalesce(l.vat,0)::numeric(14,2) as vat_total,
  (coalesce(l.total,0)-coalesce(l.vat,0))::numeric(14,2) as total_excl_vat,
  coalesce(p.paid,0)::numeric(14,2) as paid,
  coalesce(ct.credited,0)::numeric(14,2) as credited,
  coalesce(cs.applied,0)::numeric(14,2) as credit_applied,
  (coalesce(l.total,0)-coalesce(p.paid,0)-coalesce(ct.credited,0)-coalesce(cs.applied,0))::numeric(14,2) as open_amount
 from public.invoices i
 left join lateral (select sum(line_total) as total,sum(vat_amount) as vat from public.invoice_lines where invoice_id=i.id) l on true
 left join lateral (select sum(amount) as paid from public.payment_allocations a where a.invoice_id=i.id and a.reversed_at is null) p on true
 left join lateral (select sum(amount) as credited from public.credit_allocations c where c.target_invoice_id=i.id and c.reversed_at is null) ct on true
 left join lateral (select sum(amount) as applied from public.credit_allocations c where c.credit_invoice_id=i.id and c.reversed_at is null) cs on true;
create view public.payment_balances with (security_invoker=true) as
 select p.id as payment_id, p.sponsor_id, p.direction, p.status, p.received_on, p.amount,
  coalesce(sum(a.amount) filter (where a.reversed_at is null),0)::numeric(14,2) as allocated,
  (case when p.status='reversed' then 0 else p.amount-coalesce(sum(a.amount) filter (where a.reversed_at is null),0) end)::numeric(14,2) as unallocated
 from public.payments p left join public.payment_allocations a on a.payment_id=p.id
 group by p.id;
create view public.contract_invoicing with (security_invoker=true) as
 select c.id as contract_id, c.sponsor_id, t.current_total as contract_value,
  coalesce(sum(case when i.kind='invoice' then il.line_total else -il.line_total end) filter (where i.status='issued'),0)::numeric(14,2) as invoiced_net,
  (t.current_total-coalesce(sum(case when i.kind='invoice' then il.line_total else -il.line_total end) filter (where i.status='issued'),0))::numeric(14,2) as to_invoice
 from public.contracts c
 join public.contract_totals t on t.contract_id=c.id
 left join public.contract_lines cl on cl.contract_id=c.id
 left join public.invoice_lines il on il.contract_line_id=cl.id
 left join public.invoices i on i.id=il.invoice_id
 group by c.id,c.sponsor_id,t.current_total;
revoke all on public.invoice_balances,public.payment_balances,public.contract_invoicing from public,anon,authenticated;
grant select on public.invoice_balances,public.payment_balances,public.contract_invoicing to authenticated;

-- Audit -------------------------------------------------------------------------
create table private.finance_audit (
 id bigint generated always as identity primary key,
 actor uuid references auth.users(id),
 sponsor_id uuid references public.sponsors(id),
 entity text not null,
 entity_id uuid not null,
 operation text not null,
 created_at timestamptz not null default now()
);
create index on private.finance_audit(sponsor_id);
alter table private.finance_audit enable row level security;
revoke all on private.finance_audit from public,anon,authenticated;
create function private.audit_finance() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb:=to_jsonb(case when tg_op='DELETE' then old else new end);
begin
 insert into private.finance_audit(actor,sponsor_id,entity,entity_id,operation)
 values(auth.uid(),(row_data->>'sponsor_id')::uuid,tg_table_name,coalesce((row_data->>'id')::uuid,(row_data->>'document_id')::uuid),tg_op);
 return null;
end;$$;
revoke all on function private.audit_finance() from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array['invoices','invoice_lines','payments','payment_allocations','credit_allocations','invoice_documents'] loop
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_finance()',t||'_finance_audit',t);
 end loop;
end$$;

-- Hulpfuncties ------------------------------------------------------------------
create function private.today() returns date language sql stable set search_path='' as $$
 select (now() at time zone 'Europe/Amsterdam')::date;
$$;
revoke all on function private.today() from public,anon,authenticated;

create function private.lock_invoice(target uuid) returns public.invoices
language plpgsql security definer set search_path='' as $$
declare i public.invoices;
begin
 select * into i from public.invoices where id=target for update;
 if not found then raise exception 'Factuur niet gevonden' using errcode='P0002'; end if;
 return i;
end;$$;
revoke all on function private.lock_invoice(uuid) from public,anon,authenticated;

-- Open bedrag na vergrendeling van de factuurrij; alle mutaties lopen via die lock.
create function private.invoice_open(target uuid) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce((select sum(line_total) from public.invoice_lines where invoice_id=target),0)
  -coalesce((select sum(amount) from public.payment_allocations where invoice_id=target and reversed_at is null),0)
  -coalesce((select sum(amount) from public.credit_allocations where target_invoice_id=target and reversed_at is null),0)
  -coalesce((select sum(amount) from public.credit_allocations where credit_invoice_id=target and reversed_at is null),0);
$$;
revoke all on function private.invoice_open(uuid) from public,anon,authenticated;

-- RPC's: facturen ----------------------------------------------------------------
create function public.create_invoice(company uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; contract uuid:=nullif(details->>'contract_id','')::uuid;
begin
 perform private.require_internal();
 perform 1 from public.sponsors where id=company and archived_at is null;
 if not found then raise exception 'Bedrijf niet beschikbaar' using errcode='P0002'; end if;
 if contract is not null and not exists(select 1 from public.contracts where id=contract and sponsor_id=company and status<>'draft') then
  raise exception 'Alleen een vastgelegd contract van dit bedrijf' using errcode='23503';
 end if;
 insert into public.invoices(sponsor_id,contract_id,reference,due_on)
 values(company,contract,nullif(btrim(details->>'reference'),''),nullif(details->>'due_on','')::date)
 returning id into result;
 return result;
end;$$;

create function public.update_invoice_draft(target uuid, details jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare i public.invoices;
begin
 perform private.require_internal();
 i:=private.lock_invoice(target);
 if i.status<>'draft' then raise exception 'Alleen een concept is bewerkbaar' using errcode='42501'; end if;
 update public.invoices set reference=nullif(btrim(details->>'reference'),''),due_on=nullif(details->>'due_on','')::date where id=target;
end;$$;

create function public.add_invoice_line(invoice uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.invoices; result uuid; cl record; source uuid:=nullif(details->>'contract_line_id','')::uuid;
begin
 perform private.require_internal();
 i:=private.lock_invoice(invoice);
 if i.status<>'draft' then raise exception 'Alleen een concept is bewerkbaar' using errcode='42501'; end if;
 if source is not null then
  select l.title,l.quantity,l.unit_price,l.vat_rate,c.status into cl
  from public.contract_lines l join public.contracts c on c.id=l.contract_id where l.id=source and l.sponsor_id=i.sponsor_id;
  if not found then raise exception 'Contractregel hoort niet bij dit bedrijf' using errcode='23503'; end if;
  if cl.status='draft' then raise exception 'Alleen regels van een vastgelegd contract' using errcode='42501'; end if;
 end if;
 insert into public.invoice_lines(invoice_id,sponsor_id,contract_line_id,position,description,quantity,unit_price,vat_rate)
 values(invoice,i.sponsor_id,source,(select count(*)::integer from public.invoice_lines where invoice_id=invoice)+1,
  coalesce(nullif(btrim(details->>'description'),''),cl.title),
  coalesce(nullif(details->>'quantity','')::numeric,cl.quantity,1),
  coalesce(nullif(details->>'unit_price','')::numeric,cl.unit_price),
  coalesce(nullif(details->>'vat_rate','')::numeric,cl.vat_rate,21))
 returning id into result;
 return result;
end;$$;

create function public.remove_invoice_line(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare inv uuid;
begin
 perform private.require_internal();
 select invoice_id into inv from public.invoice_lines where id=target;
 if inv is null then raise exception 'Regel niet gevonden' using errcode='P0002'; end if;
 perform private.lock_invoice(inv);
 delete from public.invoice_lines where id=target;
end;$$;

create function public.delete_invoice_draft(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare i public.invoices;
begin
 perform private.require_internal();
 i:=private.lock_invoice(target);
 if i.status<>'draft' then raise exception 'Alleen een concept kan worden verwijderd' using errcode='42501'; end if;
 delete from public.invoice_lines where invoice_id=target;
 delete from public.invoices where id=target;
end;$$;

create function public.create_credit_note(original uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.invoices; result uuid;
begin
 perform private.require_internal();
 o:=private.lock_invoice(original);
 if o.kind<>'invoice' or o.status<>'issued' then raise exception 'Alleen een uitgereikte factuur crediteren' using errcode='42501'; end if;
 insert into public.invoices(sponsor_id,kind,original_invoice_id,contract_id,reference)
 values(o.sponsor_id,'credit',o.id,o.contract_id,coalesce(nullif(btrim(details->>'reference'),''),'Creditnota op '||o.invoice_number))
 returning id into result;
 if coalesce((details->>'full')::boolean,true) then
  insert into public.invoice_lines(invoice_id,sponsor_id,contract_line_id,position,description,quantity,unit_price,vat_rate)
  select result,o.sponsor_id,contract_line_id,position,description,quantity,unit_price,vat_rate from public.invoice_lines where invoice_id=o.id;
 end if;
 return result;
end;$$;

create function public.issue_invoice(target uuid, details jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare i public.invoices; o public.invoices; total numeric; issued date:=coalesce(nullif(details->>'issue_date','')::date,private.today());
 due date; number text; seq integer; prefix text; snapshot jsonb; prior numeric; over record; apply numeric;
begin
 perform private.require_internal();
 i:=private.lock_invoice(target);
 if i.status<>'draft' then raise exception 'Factuur is al uitgereikt' using errcode='42501'; end if;
 select coalesce(sum(line_total),0) into total from public.invoice_lines where invoice_id=target;
 if not exists(select 1 from public.invoice_lines where invoice_id=target) or total<=0 then
  raise exception 'Een factuur vereist regels met een positief totaal' using errcode='23514';
 end if;
 if issued>private.today() then raise exception 'Factuurdatum ligt in de toekomst' using errcode='23514'; end if;
 due:=case when i.kind='credit' then coalesce(nullif(details->>'due_on','')::date,issued) else nullif(details->>'due_on','')::date end;
 if due is null or due<issued then raise exception 'Vervaldatum ontbreekt of ligt vóór de factuurdatum' using errcode='23514'; end if;
 if i.kind='invoice' then
  -- Niet meer factureren dan per (positieve) contractregel is afgesproken.
  for over in
   select cl.id,cl.line_total,
    coalesce((select sum(case when x.kind='invoice' then il.line_total else -il.line_total end) from public.invoice_lines il join public.invoices x on x.id=il.invoice_id
     where il.contract_line_id=cl.id and (x.status='issued' or x.id=target)),0) as invoiced
   from public.contract_lines cl where cl.id in (select contract_line_id from public.invoice_lines where invoice_id=target and contract_line_id is not null)
  loop
   if over.line_total>=0 and over.invoiced>over.line_total then
    raise exception 'Gefactureerd bedrag overschrijdt de contractregel' using errcode='23514';
   end if;
  end loop;
 else
  o:=private.lock_invoice(i.original_invoice_id);
  select coalesce(sum(il.line_total),0) into prior from public.invoice_lines il join public.invoices x on x.id=il.invoice_id
   where x.original_invoice_id=o.id and x.status='issued';
  if total>(select coalesce(sum(line_total),0) from public.invoice_lines where invoice_id=o.id)-prior then
   raise exception 'Creditbedrag overschrijdt het nog te crediteren bedrag' using errcode='23514';
  end if;
 end if;
 select jsonb_build_object('name',s.name,'trading_name',s.trading_name,'street',n.street,'postal_code',n.postal_code,'city',s.city,
  'kvk',n.kvk,'vat_number',n.vat_number,'email',n.email,'captured_at',now())
 into snapshot from public.sponsors s left join public.sponsor_internal n on n.sponsor_id=s.id where s.id=i.sponsor_id;
 prefix:=case when i.kind='invoice' then 'F' else 'C' end;
 -- Rij-lock op de teller: gatenvrij, want een rollback draait ook de teller terug.
 insert into private.invoice_counters(kind,year,last_value) values(prefix,extract(year from issued)::integer,1)
 on conflict(kind,year) do update set last_value=private.invoice_counters.last_value+1 returning last_value into seq;
 number:=prefix||'-'||extract(year from issued)::integer||'-'||lpad(seq::text,4,'0');
 update public.invoices set status='issued',invoice_number=number,issue_date=issued,due_on=due,billing_snapshot=snapshot,issued_at=now(),issued_by=auth.uid() where id=target;
 if i.kind='credit' then
  apply:=least(total,greatest(private.invoice_open(o.id),0));
  if apply>0 then
   insert into public.credit_allocations(credit_invoice_id,target_invoice_id,sponsor_id,amount) values(target,o.id,i.sponsor_id,apply);
  end if;
 end if;
 return number;
end;$$;

-- RPC's: betalingen en toewijzingen ------------------------------------------------
create function public.register_payment(company uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; v_amount numeric:=(details->>'amount')::numeric; v_received date:=(details->>'received_on')::date;
 v_ref text:=nullif(btrim(details->>'reference'),''); v_dir text:=coalesce(nullif(details->>'direction',''),'in');
begin
 perform private.require_internal();
 perform 1 from public.sponsors where id=company for share;
 if not found then raise exception 'Bedrijf niet gevonden' using errcode='P0002'; end if;
 if v_received is null or v_received>private.today() then raise exception 'Ontvangstdatum ligt in de toekomst' using errcode='23514'; end if;
 if not coalesce((details->>'allow_duplicate')::boolean,false) and exists(
  select 1 from public.payments p where p.sponsor_id=company and p.status='registered' and p.direction=v_dir
   and p.amount=v_amount and p.received_on=v_received and p.reference is not distinct from v_ref) then
  raise exception 'Mogelijk dubbele registratie' using errcode='23505';
 end if;
 insert into public.payments(sponsor_id,direction,received_on,amount,method,reference)
 values(company,v_dir,v_received,v_amount,coalesce(nullif(details->>'method',''),'bank'),v_ref) returning id into result;
 return result;
end;$$;

create function public.allocate_payment(payment uuid, invoice uuid, amount numeric) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.payments; i public.invoices; available numeric; result uuid;
begin
 perform private.require_internal();
 if amount is null or amount<=0 or amount<>round(amount,2) then raise exception 'Ongeldig bedrag' using errcode='23514'; end if;
 select * into p from public.payments where id=payment for update;
 if not found or p.status<>'registered' then raise exception 'Betaling niet beschikbaar' using errcode='P0002'; end if;
 i:=private.lock_invoice(invoice);
 if i.sponsor_id<>p.sponsor_id then raise exception 'Factuur hoort bij een ander bedrijf' using errcode='23503'; end if;
 if i.status<>'issued' or (p.direction='in' and i.kind<>'invoice') or (p.direction='out' and i.kind<>'credit') then
  raise exception 'Ontvangst alleen op factuur, terugbetaling alleen op creditnota' using errcode='42501';
 end if;
 select p.amount-coalesce(sum(a.amount),0) into available from public.payment_allocations a where a.payment_id=payment and a.reversed_at is null;
 if amount>available then raise exception 'Bedrag overschrijdt het niet-toegewezen deel van de betaling' using errcode='23514'; end if;
 if amount>private.invoice_open(invoice) then raise exception 'Bedrag overschrijdt het openstaande bedrag' using errcode='23514'; end if;
 insert into public.payment_allocations(payment_id,invoice_id,sponsor_id,amount) values(payment,invoice,p.sponsor_id,amount) returning id into result;
 return result;
end;$$;

create function public.allocate_credit(credit uuid, target uuid, amount numeric) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.invoices; t public.invoices; result uuid;
begin
 perform private.require_internal();
 if amount is null or amount<=0 or amount<>round(amount,2) then raise exception 'Ongeldig bedrag' using errcode='23514'; end if;
 c:=private.lock_invoice(credit);
 if c.kind<>'credit' or c.status<>'issued' then raise exception 'Alleen een uitgereikte creditnota' using errcode='42501'; end if;
 t:=private.lock_invoice(target);
 if t.sponsor_id<>c.sponsor_id then raise exception 'Factuur hoort bij een ander bedrijf' using errcode='23503'; end if;
 if t.kind<>'invoice' or t.status<>'issued' then raise exception 'Alleen een uitgereikte factuur' using errcode='42501'; end if;
 if amount>private.invoice_open(credit) or amount>private.invoice_open(target) then
  raise exception 'Bedrag overschrijdt het beschikbare krediet of het openstaande bedrag' using errcode='23514';
 end if;
 insert into public.credit_allocations(credit_invoice_id,target_invoice_id,sponsor_id,amount) values(credit,target,c.sponsor_id,amount) returning id into result;
 return result;
end;$$;

create function public.reverse_allocation(target uuid, kind text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_internal();
 if kind='payment' then
  update public.payment_allocations set reversed_at=now(),reversed_by=auth.uid() where id=target and reversed_at is null;
 elsif kind='credit' then
  update public.credit_allocations set reversed_at=now(),reversed_by=auth.uid() where id=target and reversed_at is null;
 else raise exception 'Ongeldige soort' using errcode='22023';
 end if;
 if not found then raise exception 'Toewijzing niet actief' using errcode='P0002'; end if;
end;$$;

create function public.reverse_payment(target uuid, reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_internal();
 if nullif(btrim(reason),'') is null then raise exception 'Reden vereist' using errcode='23514'; end if;
 perform 1 from public.payments where id=target and status='registered' for update;
 if not found then raise exception 'Betaling niet actief' using errcode='P0002'; end if;
 update public.payment_allocations set reversed_at=now(),reversed_by=auth.uid() where payment_id=target and reversed_at is null;
 update public.payments set status='reversed',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=btrim(reason) where id=target;
end;$$;

-- Documenten: factuur-PDF als derde koppelsoort ---------------------------------------
create or replace function public.register_document(company uuid, details jsonb, link jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare doc uuid:=gen_random_uuid(); contract uuid:=nullif(link->>'contract_id','')::uuid;
 fulfillment uuid:=nullif(link->>'fulfillment_id','')::uuid; invoice uuid:=nullif(link->>'invoice_id','')::uuid;
begin
 perform private.require_internal();
 if (contract is not null)::integer+(fulfillment is not null)::integer+(invoice is not null)::integer<>1 then
  raise exception 'Precies één koppeling vereist' using errcode='22023';
 end if;
 perform 1 from public.sponsors where id=company and archived_at is null;
 if not found then raise exception 'Bedrijf niet beschikbaar' using errcode='P0002'; end if;
 insert into public.documents(id,sponsor_id,object_path,title,sponsor_shared,board_shared,category,mime_type,size_bytes,checksum,upload_status)
 values(doc,company,company::text||'/'||doc::text,btrim(details->>'title'),coalesce((details->>'sponsor_shared')::boolean,false),
  coalesce((details->>'board_shared')::boolean,false),
  case when contract is not null then 'contract' when invoice is not null then 'invoice' else 'evidence' end,
  details->>'mime_type',(details->>'size_bytes')::integer,details->>'checksum','pending');
 if contract is not null then
  insert into public.contract_documents(contract_id,document_id,sponsor_id,document_role) values(contract,doc,company,coalesce(nullif(link->>'role',''),'contract'));
 elsif invoice is not null then
  insert into public.invoice_documents(invoice_id,document_id,sponsor_id) values(invoice,doc,company);
 else
  insert into public.fulfillment_evidence(right_fulfillment_id,document_id,sponsor_id) values(fulfillment,doc,company);
 end if;
 return doc;
end;$$;

do $$
declare f text;
begin
 foreach f in array array['create_invoice(uuid,jsonb)','update_invoice_draft(uuid,jsonb)','add_invoice_line(uuid,jsonb)',
  'remove_invoice_line(uuid)','delete_invoice_draft(uuid)','create_credit_note(uuid,jsonb)','issue_invoice(uuid,jsonb)',
  'register_payment(uuid,jsonb)','allocate_payment(uuid,uuid,numeric)','allocate_credit(uuid,uuid,numeric)',
  'reverse_allocation(uuid,text)','reverse_payment(uuid,text)','register_document(uuid,jsonb,jsonb)'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',f);
  execute format('grant execute on function public.%s to authenticated',f);
 end loop;
end$$;

comment on table public.invoices is 'Facturen en creditnota''s. Prijzen inclusief BTW. Uitgereikt = onveranderlijk; correctie via creditnota.';
comment on table public.payments is 'Handmatig geregistreerde ontvangsten (in) en terugbetalingen (out); los van facturen, toewijzing apart.';
