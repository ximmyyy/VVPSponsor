begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- Uitsluitend fictieve TEST-fixtures; alles rolt terug.
insert into auth.users(id,email) values
 ('c0000000-0000-0000-0000-000000000001','r-commissie@report.example'),
 ('c0000000-0000-0000-0000-000000000002','r-bestuur@report.example'),
 ('c0000000-0000-0000-0000-000000000003','r-sponsor@report.example'),
 ('c0000000-0000-0000-0000-000000000004','r-inactief@report.example'),
 ('c0000000-0000-0000-0000-000000000005','r-admin@report.example');
insert into private.user_access(user_id,role,is_active) values
 ('c0000000-0000-0000-0000-000000000001','sponsorcommissie',true),
 ('c0000000-0000-0000-0000-000000000002','clubbestuur',true),
 ('c0000000-0000-0000-0000-000000000003','sponsor',true),
 ('c0000000-0000-0000-0000-000000000004','clubbestuur',false),
 ('c0000000-0000-0000-0000-000000000005','super_admin',true);
insert into public.sponsors(id,name) values
 ('d0000000-0000-0000-0000-00000000000a','TEST — Rapport A'),
 ('d0000000-0000-0000-0000-00000000000b','TEST — Rapport B'),
 ('d0000000-0000-0000-0000-00000000000c','TEST — Rapport C'),
 ('d0000000-0000-0000-0000-00000000000d','TEST — Rapport D');
insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values
 ('c0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-00000000000a',true);
create temporary table ids(k text primary key, v uuid);
grant all on ids to authenticated;
create function pg_temp.id(key text) returns uuid language sql as $$ select v from ids where k=key $$;
create function pg_temp.kpi(key text, s integer default null) returns numeric language sql as $$ select (public.report_dashboard(s)->'kpis'->>key)::numeric $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
-- Vlaggen: A betalend+actief, B actief niet betalend, C prospect, D betalend maar gearchiveerd.
select lives_ok($q$select public.save_sponsor('d0000000-0000-0000-0000-00000000000a','{"name":"TEST — Rapport A","status":"active","is_paying":true,"notes":"TEST — Geheime notitie"}')$q$,'betalende sponsor markeren');
select is((select is_paying from public.sponsor_internal where sponsor_id='d0000000-0000-0000-0000-00000000000a'),true,'vlag opgeslagen');
select lives_ok($q$select public.save_sponsor('d0000000-0000-0000-0000-00000000000b','{"name":"TEST — Rapport B","status":"active"}')$q$,'actief, niet betalend');
select lives_ok($q$select public.save_sponsor('d0000000-0000-0000-0000-00000000000d','{"name":"TEST — Rapport D","status":"active","is_paying":true}')$q$,'D betalend');
update public.sponsors set archived_at=now() where id='d0000000-0000-0000-0000-00000000000d';
select is((select is_paying from public.sponsor_internal where sponsor_id='d0000000-0000-0000-0000-00000000000b'),false,'standaard niet betalend');

-- Contracten met vaste data in seizoen 2025/2026.
insert into ids select 'a1',public.create_contract('d0000000-0000-0000-0000-00000000000a','{"title":"A1","starts_on":"2026-07-01","ends_on":"2027-06-30"}');
select public.add_contract_line(pg_temp.id('a1'),'{"title":"x","unit_price":"1210"}');
select public.confirm_contract(pg_temp.id('a1'));
insert into ids select 'a2',public.create_contract('d0000000-0000-0000-0000-00000000000a','{"title":"A2","starts_on":"2025-07-01","ends_on":"2027-06-30"}');
select public.add_contract_line(pg_temp.id('a2'),'{"title":"x","unit_price":"2000"}');
select public.confirm_contract(pg_temp.id('a2'));
insert into ids select 'a3',public.create_contract('d0000000-0000-0000-0000-00000000000a','{"title":"A3","starts_on":"2026-07-01","ends_on":"2027-06-30"}');
select public.add_contract_line(pg_temp.id('a3'),'{"title":"x","unit_price":"365"}');
select public.confirm_contract(pg_temp.id('a3'));
select public.terminate_contract(pg_temp.id('a3'),'{"terminated_on":"2026-07-10","reason":"TEST"}');
-- B: loopt binnenkort af (relatief aan vandaag) met opzegdatum binnen 60 dagen.
insert into ids select 'b1',public.create_contract('d0000000-0000-0000-0000-00000000000b',jsonb_build_object('title','B1','starts_on',(current_date-10)::text,'ends_on',(current_date+40)::text,'notice_deadline',(current_date+20)::text));
select public.add_contract_line(pg_temp.id('b1'),'{"title":"x","unit_price":"500"}');
select public.confirm_contract(pg_temp.id('b1'));
-- Conceptcontract telt nergens mee.
insert into ids select 'draft',public.create_contract('d0000000-0000-0000-0000-00000000000a','{"title":"Concept","starts_on":"2026-07-01","ends_on":"2027-06-30"}');
select public.add_contract_line(pg_temp.id('draft'),'{"title":"x","unit_price":"99999"}');

-- Geld: facturen en betalingen vandaag (huidig seizoen) en een vervallen factuur.
insert into ids select 'fa',public.create_invoice('d0000000-0000-0000-0000-00000000000a','{}');
select public.add_invoice_line(pg_temp.id('fa'),'{"description":"x","unit_price":"605"}');
select public.issue_invoice(pg_temp.id('fa'),jsonb_build_object('due_on',(current_date+30)::text));
insert into ids select 'fb',public.create_invoice('d0000000-0000-0000-0000-00000000000b','{}');
select public.add_invoice_line(pg_temp.id('fb'),'{"description":"x","unit_price":"100"}');
select public.issue_invoice(pg_temp.id('fb'),jsonb_build_object('issue_date',(current_date-20)::text,'due_on',(current_date-5)::text));
insert into ids select 'p',public.register_payment('d0000000-0000-0000-0000-00000000000a',jsonb_build_object('received_on',current_date::text,'amount','500'));
select public.allocate_payment(pg_temp.id('p'),pg_temp.id('fa'),500);
insert into ids select 'conc',public.create_invoice('d0000000-0000-0000-0000-00000000000a','{}');
select public.add_invoice_line(pg_temp.id('conc'),'{"description":"concept","unit_price":"77777"}');

-- Definities ------------------------------------------------------------------------
select is(pg_temp.kpi('active_paying',2026),1::numeric,'actieve sponsor = betalend + actief + niet gearchiveerd');
select is(pg_temp.kpi('budget_paying',2026),2220.00::numeric,'budget betalende sponsors: 1210 + helft 2000 + 10 dagen van 365');
select is(pg_temp.kpi('contract_value',2025),1000.00::numeric,'meerjarig contract naar rato over seizoenen');
select ok(pg_temp.kpi('contract_value',2026)>=pg_temp.kpi('budget_paying',2026),'totale contractwaarde omvat niet-betalende sponsors');
select is(pg_temp.kpi('contract_value',2024),0::numeric,'leeg seizoen');
select is(pg_temp.kpi('invoiced'),705.00::numeric,'gefactureerd in huidig seizoen, zonder concepten');
select is(pg_temp.kpi('received'),500.00::numeric,'ontvangen in huidig seizoen');
select is(pg_temp.kpi('open_now'),205.00::numeric,'openstaand nu');
select is(pg_temp.kpi('overdue_now'),100.00::numeric,'vervallen nu');
select is(pg_temp.kpi('expiring_90'),1::numeric,'binnenkort aflopend zonder opvolger');
select is(pg_temp.kpi('expiring_value_90'),500.00::numeric,'waarde aflopende contracten');
select is(pg_temp.kpi('notice_60'),1::numeric,'opzegdatum binnen 60 dagen');
select is(pg_temp.kpi('prospects'),1::numeric,'prospects als kansen');
select is((public.report_dashboard()->>'season')::integer,(case when extract(month from current_date)>=7 then extract(year from current_date) else extract(year from current_date)-1 end)::integer,'standaard huidig seizoen (1 juli – 30 juni)');
select is(jsonb_array_length(public.report_dashboard(2026)->'seasons'),5,'vijf seizoenen voor vergelijking');
select is(jsonb_array_length(public.report_dashboard(2026)->'monthly'),12,'twaalf maanden');
select is((public.report_dashboard(2026)->'monthly'->0->>'month'),'2026-07-01','seizoen start in juli');
select is((select (m->>'invoiced_cumulative')::numeric from jsonb_array_elements(public.report_dashboard()->'monthly') m order by m->>'month' desc limit 1),705.00::numeric,'cumulatief klopt met seizoenstotaal');
select is((public.report_dashboard(2026)->'sponsors'->0->>'name'),'TEST — Rapport A','sponsors gesorteerd op contractwaarde');
select ok(not (public.report_dashboard(2026)->'sponsors')::text like '%Rapport C%','prospect zonder cijfers niet in sponsorlijst');
select ok((public.report_dashboard(2026)->'prospects')::text like '%Rapport C%','prospect in kansenlijst');
select throws_ok($q$select public.report_dashboard(1999)$q$,'22023',null,'ongeldig seizoen');
-- Eenmalig voorbereiden: opvolger maakt het contract geen verlengkans meer.
insert into ids select 'b2',public.renew_contract(pg_temp.id('b1'),jsonb_build_object('starts_on',(current_date+41)::text,'ends_on',(current_date+400)::text));
select is(pg_temp.kpi('expiring_90'),0::numeric,'verlengd contract telt niet meer als aflopend');

-- Bestuur: alle cijfers, geen interne notities ---------------------------------------
select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is(pg_temp.kpi('budget_paying',2026),2220.00::numeric,'bestuur ziet dezelfde cijfers');
select is(jsonb_array_length(public.report_dashboard(null,true)->'invoices'),2,'bestuur: factuurdetail voor export');
select ok(jsonb_array_length(public.report_dashboard(2026,true)->'contracts')>=4,'bestuur: contractdetail voor export');
select ok(public.report_dashboard(2026,true)::text not like '%Geheime notitie%','geen interne notities in rapportage');
select ok(public.report_dashboard(2026,true)::text not like '%report.example%','geen accountgegevens in rapportage');
select is((select count(*)::int from public.sponsor_internal),0,'bestuur leest nog steeds geen interne tabel');
select is((select count(*)::int from public.invoices),0,'bestuur leest geen ruwe financiële tabellen');
select lives_ok($q$select public.log_report_export(2026)$q$,'bestuur mag exporteren (gelogd)');
select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
select lives_ok($q$select public.report_dashboard()$q$,'super admin');
-- Geweigerd -------------------------------------------------------------------------
select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select throws_ok($q$select public.report_dashboard()$q$,'42501',null,'sponsor geen rapportage');
select throws_ok($q$select public.log_report_export(2026)$q$,'42501',null,'sponsor geen export');
with changed as(update public.sponsor_internal set is_paying=true returning sponsor_id) select is((select count(*)::int from changed),0,'sponsor zet geen vlag (RLS)');
select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select throws_ok($q$select public.report_dashboard()$q$,'42501',null,'inactief bestuur geen rapportage');
reset role;
select is((select count(*)::int from private.report_exports where actor='c0000000-0000-0000-0000-000000000002'),1,'export gelogd');
set local role anon;
select throws_ok($q$select public.report_dashboard()$q$,'42501',null,'anon geen rapportage');
reset role;
select * from finish();
rollback;
