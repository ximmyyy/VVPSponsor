begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- Uitsluitend fictieve TEST-fixtures; alles rolt terug.
insert into auth.users(id,email) values
 ('a0000000-0000-0000-0000-000000000001','f-admin@finance.example'),
 ('a0000000-0000-0000-0000-000000000002','f-commissie@finance.example'),
 ('a0000000-0000-0000-0000-000000000003','f-bestuur@finance.example'),
 ('a0000000-0000-0000-0000-000000000004','f-sponsor-a@finance.example'),
 ('a0000000-0000-0000-0000-000000000005','f-sponsor-b@finance.example'),
 ('a0000000-0000-0000-0000-000000000006','f-inactief@finance.example');
insert into private.user_access(user_id,role,is_active) values
 ('a0000000-0000-0000-0000-000000000001','super_admin',true),
 ('a0000000-0000-0000-0000-000000000002','sponsorcommissie',true),
 ('a0000000-0000-0000-0000-000000000003','clubbestuur',true),
 ('a0000000-0000-0000-0000-000000000004','sponsor',true),
 ('a0000000-0000-0000-0000-000000000005','sponsor',true),
 ('a0000000-0000-0000-0000-000000000006','sponsor',false);
insert into public.sponsors(id,name) values
 ('b0000000-0000-0000-0000-00000000000a','TEST — Financieel A'),
 ('b0000000-0000-0000-0000-00000000000b','TEST — Financieel B');
insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values
 ('a0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-00000000000a',true),
 ('a0000000-0000-0000-0000-000000000005','b0000000-0000-0000-0000-00000000000b',true),
 ('a0000000-0000-0000-0000-000000000006','b0000000-0000-0000-0000-00000000000a',true);
create temporary table ids(k text primary key, v uuid);
create temporary table nums(k text primary key, v text);
grant all on ids,nums to authenticated;
create function pg_temp.id(key text) returns uuid language sql as $$ select v from ids where k=key $$;
create function pg_temp.seq(key text) returns integer language sql as $$ select split_part(v,'-',3)::integer from nums where k=key $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
-- Contract A: 1210,00 + 500,00 incl. BTW.
insert into ids select 'c',public.create_contract('b0000000-0000-0000-0000-00000000000a','{"title":"TEST — Financieel","starts_on":"2026-07-01","ends_on":"2027-06-30"}');
insert into ids select 'cl1',public.add_contract_line(pg_temp.id('c'),'{"title":"TEST — Hoofdregel","quantity":"1","unit_price":"1210","vat_rate":"21"}');
insert into ids select 'cl2',public.add_contract_line(pg_temp.id('c'),'{"title":"TEST — Extra","quantity":"2","unit_price":"250"}');
select throws_ok($q$select public.create_invoice('b0000000-0000-0000-0000-00000000000a',jsonb_build_object('contract_id',pg_temp.id('c')))$q$,'23503',null,'geen factuur op conceptcontract');
select lives_ok($q$select public.confirm_contract(pg_temp.id('c'))$q$,'contract bevestigd');

-- Afronding inclusief BTW ---------------------------------------------------------
insert into ids select 'r',public.create_invoice('b0000000-0000-0000-0000-00000000000a','{}');
insert into ids select 'r1',public.add_invoice_line(pg_temp.id('r'),'{"description":"TEST","quantity":"1","unit_price":"1210"}');
insert into ids select 'r2',public.add_invoice_line(pg_temp.id('r'),'{"description":"TEST","quantity":"3","unit_price":"33.3333","vat_rate":"21"}');
insert into ids select 'r3',public.add_invoice_line(pg_temp.id('r'),'{"description":"TEST","quantity":"1","unit_price":"99.99","vat_rate":"9"}');
select is((select vat_rate from public.invoice_lines where id=pg_temp.id('r1')),21.00::numeric(5,2),'standaard 21% BTW');
select is((select vat_amount from public.invoice_lines where id=pg_temp.id('r1')),210.00::numeric(14,2),'1210 incl. → 210 BTW');
select is((select line_total from public.invoice_lines where id=pg_temp.id('r2')),100.00::numeric(14,2),'regeltotaal afgerond op centen');
select is((select vat_amount from public.invoice_lines where id=pg_temp.id('r2')),17.36::numeric(14,2),'BTW uit afgerond regeltotaal');
select is((select vat_amount from public.invoice_lines where id=pg_temp.id('r3')),8.26::numeric(14,2),'9% uit 99,99');
select is((select total_excl_vat from public.invoice_balances where invoice_id=pg_temp.id('r')),(1409.99-235.62)::numeric(14,2),'excl. = incl. − BTW');
select lives_ok($q$select public.delete_invoice_draft(pg_temp.id('r'))$q$,'concept verwijderbaar');
select is((select count(*)::int from public.invoices where id=pg_temp.id('r')),0,'concept weg zonder nummer');

-- Termijnfacturen en gatenvrije nummering -------------------------------------------
insert into ids select 'f1',public.create_invoice('b0000000-0000-0000-0000-00000000000a',jsonb_build_object('contract_id',pg_temp.id('c'),'reference','Termijn 1'));
select lives_ok($q$select public.add_invoice_line(pg_temp.id('f1'),jsonb_build_object('contract_line_id',pg_temp.id('cl1'),'unit_price','605'))$q$,'termijnregel uit contract');
select throws_ok($q$select public.issue_invoice(pg_temp.id('f1'),'{}')$q$,'23514',null,'vervaldatum verplicht');
select throws_ok($q$select public.issue_invoice(pg_temp.id('f1'),'{"issue_date":"2999-01-01","due_on":"2999-02-01"}')$q$,'23514',null,'factuurdatum niet in de toekomst');
select throws_ok($q$select public.issue_invoice(pg_temp.id('f1'),jsonb_build_object('due_on',(current_date-1)::text))$q$,'23514',null,'vervaldatum niet vóór factuurdatum');
insert into nums select 'f1',public.issue_invoice(pg_temp.id('f1'),jsonb_build_object('due_on',(current_date+30)::text));
select matches((select v from nums where k='f1'),'^F-[0-9]{4}-[0-9]{4}$','factuurnummer F-JJJJ-NNNN');
select is((select billing_snapshot->>'name' from public.invoices where id=pg_temp.id('f1')),'TEST — Financieel A','factuuradres als momentopname');
insert into ids select 'f2',public.create_invoice('b0000000-0000-0000-0000-00000000000a',jsonb_build_object('contract_id',pg_temp.id('c'),'reference','Termijn 2'));
select lives_ok($q$select public.add_invoice_line(pg_temp.id('f2'),jsonb_build_object('contract_line_id',pg_temp.id('cl1'),'unit_price','605'))$q$,'tweede termijn');
insert into nums select 'f2',public.issue_invoice(pg_temp.id('f2'),jsonb_build_object('due_on',(current_date+30)::text));
select is(pg_temp.seq('f2'),pg_temp.seq('f1')+1,'opeenvolgend nummer');
insert into ids select 'f3',public.create_invoice('b0000000-0000-0000-0000-00000000000a','{}');
insert into ids select 'f3l',public.add_invoice_line(pg_temp.id('f3'),jsonb_build_object('contract_line_id',pg_temp.id('cl1'),'unit_price','0.01'));
select throws_ok($q$select public.issue_invoice(pg_temp.id('f3'),jsonb_build_object('due_on',(current_date+30)::text))$q$,'23514',null,'niet meer factureren dan de contractregel');
select is((select status from public.invoices where id=pg_temp.id('f3')),'draft','mislukt uitreiken laat concept intact');
select lives_ok($q$select public.remove_invoice_line(pg_temp.id('f3l'))$q$,'regel uit concept');
select lives_ok($q$select public.add_invoice_line(pg_temp.id('f3'),'{"description":"TEST — Losse post","quantity":"1","unit_price":"100"}')$q$,'losse regel zonder contract');
insert into nums select 'f3',public.issue_invoice(pg_temp.id('f3'),jsonb_build_object('due_on',(current_date+14)::text));
select is(pg_temp.seq('f3'),pg_temp.seq('f2')+1,'gatenvrij na mislukte uitreiking');
select is((select contract_value from public.contract_invoicing where contract_id=pg_temp.id('c')),1710.00::numeric(14,2),'contractwaarde');
select is((select invoiced_net from public.contract_invoicing where contract_id=pg_temp.id('c')),1210.00::numeric(14,2),'gefactureerd ≠ contractwaarde');
select is((select to_invoice from public.contract_invoicing where contract_id=pg_temp.id('c')),500.00::numeric(14,2),'nog te factureren');

-- Onveranderlijkheid -------------------------------------------------------------
select throws_ok($q$select public.update_invoice_draft(pg_temp.id('f1'),'{"reference":"x"}')$q$,'42501',null,'uitgereikte factuur niet bewerkbaar');
select throws_ok($q$select public.add_invoice_line(pg_temp.id('f1'),'{"description":"x","unit_price":"1"}')$q$,'42501',null,'geen regel op uitgereikte factuur');
select throws_ok($q$select public.delete_invoice_draft(pg_temp.id('f1'))$q$,'42501',null,'uitgereikte factuur niet verwijderbaar');
select throws_ok($q$update public.invoices set reference='x'$q$,'42501',null,'geen directe factuurmutatie');
select throws_ok($q$insert into public.payments(sponsor_id,received_on,amount,method) values('b0000000-0000-0000-0000-00000000000a',current_date,1,'bank')$q$,'42501',null,'geen directe betaling');

-- Betalingen, deelbetaling, onverdeeld, overtoewijzing ---------------------------------
insert into ids select 'p1',public.register_payment('b0000000-0000-0000-0000-00000000000a',jsonb_build_object('received_on',current_date::text,'amount','1000.00','reference','TEST-REF-1'));
select throws_ok($q$select public.register_payment('b0000000-0000-0000-0000-00000000000a',jsonb_build_object('received_on',current_date::text,'amount','1000.00','reference','TEST-REF-1'))$q$,'23505',null,'dubbele registratie gesignaleerd');
insert into ids select 'pdup',public.register_payment('b0000000-0000-0000-0000-00000000000a',jsonb_build_object('received_on',current_date::text,'amount','1000.00','reference','TEST-REF-1','allow_duplicate',true));
select throws_ok($q$select public.register_payment('b0000000-0000-0000-0000-00000000000a',jsonb_build_object('received_on','2999-01-01','amount','1'))$q$,'23514',null,'geen ontvangst in de toekomst');
select is((select unallocated from public.payment_balances where payment_id=pg_temp.id('p1')),1000.00::numeric(14,2),'onverdeelde betaling zichtbaar');
select lives_ok($q$select public.allocate_payment(pg_temp.id('p1'),pg_temp.id('f1'),605)$q$,'volledige toewijzing termijn 1');
insert into ids select 'a2',public.allocate_payment(pg_temp.id('p1'),pg_temp.id('f2'),395);
select is((select open_amount from public.invoice_balances where invoice_id=pg_temp.id('f1')),0.00::numeric(14,2),'termijn 1 betaald');
select is((select open_amount from public.invoice_balances where invoice_id=pg_temp.id('f2')),210.00::numeric(14,2),'deelbetaling termijn 2');
select throws_ok($q$select public.allocate_payment(pg_temp.id('p1'),pg_temp.id('f3'),1)$q$,'23514',null,'niet meer toewijzen dan betaald');
select throws_ok($q$select public.allocate_payment(pg_temp.id('pdup'),pg_temp.id('f2'),210.01)$q$,'23514',null,'niet meer toewijzen dan openstaat');
select throws_ok($q$select public.allocate_payment(pg_temp.id('pdup'),pg_temp.id('f2'),0.001)$q$,'23514',null,'geen fracties van centen');
select lives_ok($q$select public.reverse_payment(pg_temp.id('pdup'),'TEST — dubbel ingevoerd')$q$,'dubbele betaling teruggedraaid');
select is((select unallocated from public.payment_balances where payment_id=pg_temp.id('pdup')),0.00::numeric(14,2),'teruggedraaide betaling telt niet');
select throws_ok($q$select public.reverse_payment(pg_temp.id('p1'),'')$q$,'23514',null,'terugdraaien vereist reden');
select lives_ok($q$select public.reverse_allocation(pg_temp.id('a2'),'payment')$q$,'toewijzing teruggedraaid');
select is((select open_amount from public.invoice_balances where invoice_id=pg_temp.id('f2')),605.00::numeric(14,2),'open bedrag hersteld');
select is((select unallocated from public.payment_balances where payment_id=pg_temp.id('p1')),395.00::numeric(14,2),'bedrag weer onverdeeld');
select lives_ok($q$select public.allocate_payment(pg_temp.id('p1'),pg_temp.id('f2'),395)$q$,'opnieuw toegewezen');
select throws_ok($q$select public.reverse_allocation(pg_temp.id('a2'),'payment')$q$,'P0002',null,'niet dubbel terugdraaien');

-- Creditnota, verrekening en restitutie -----------------------------------------------
select throws_ok($q$select public.create_credit_note(pg_temp.id('r'),'{}')$q$,'P0002',null,'geen credit op onbekende factuur');
insert into ids select 'c1',public.create_credit_note(pg_temp.id('f2'),'{}');
select is((select count(*)::int from public.invoice_lines where invoice_id=pg_temp.id('c1')),1,'volledige credit kopieert regels');
insert into nums select 'c1',public.issue_invoice(pg_temp.id('c1'),'{}');
select matches((select v from nums where k='c1'),'^C-[0-9]{4}-[0-9]{4}$','eigen creditreeks C-JJJJ-NNNN');
select is((select open_amount from public.invoice_balances where invoice_id=pg_temp.id('f2')),0.00::numeric(14,2),'credit verrekend met oorspronkelijke factuur');
select is((select open_amount from public.invoice_balances where invoice_id=pg_temp.id('c1')),395.00::numeric(14,2),'resterend tegoed zichtbaar');
select is((select invoiced_net from public.contract_invoicing where contract_id=pg_temp.id('c')),605.00::numeric(14,2),'credit verlaagt gefactureerd bedrag');
insert into ids select 'c2',public.create_credit_note(pg_temp.id('f2'),'{}');
select throws_ok($q$select public.issue_invoice(pg_temp.id('c2'),'{}')$q$,'23514',null,'niet meer crediteren dan gefactureerd');
select lives_ok($q$select public.delete_invoice_draft(pg_temp.id('c2'))$q$,'overbodige creditconcept verwijderd');
select lives_ok($q$select public.allocate_credit(pg_temp.id('c1'),pg_temp.id('f3'),100)$q$,'tegoed verrekend met andere factuur');
select throws_ok($q$select public.allocate_credit(pg_temp.id('c1'),pg_temp.id('f1'),1)$q$,'23514',null,'niet verrekenen met betaalde factuur');
insert into ids select 'refund',public.register_payment('b0000000-0000-0000-0000-00000000000a',jsonb_build_object('received_on',current_date::text,'amount','295','direction','out','reference','TEST-RESTITUTIE'));
select throws_ok($q$select public.allocate_payment(pg_temp.id('refund'),pg_temp.id('f3'),1)$q$,'42501',null,'terugbetaling niet op gewone factuur');
select throws_ok($q$select public.allocate_payment(pg_temp.id('p1'),pg_temp.id('c1'),1)$q$,'42501',null,'ontvangst niet op creditnota');
select lives_ok($q$select public.allocate_payment(pg_temp.id('refund'),pg_temp.id('c1'),295)$q$,'restitutie apart geregistreerd');
select is((select open_amount from public.invoice_balances where invoice_id=pg_temp.id('c1')),0.00::numeric(14,2),'tegoed volledig afgewikkeld');
select is((select sum(open_amount) from public.invoice_balances where sponsor_id='b0000000-0000-0000-0000-00000000000a' and kind='invoice' and status='issued'),0.00::numeric(14,2),'reconciliatie: alles afgewikkeld');

-- Bedrijfsgrenzen ------------------------------------------------------------------
insert into ids select 'fb',public.create_invoice('b0000000-0000-0000-0000-00000000000b','{}');
select throws_ok($q$select public.add_invoice_line(pg_temp.id('fb'),jsonb_build_object('contract_line_id',pg_temp.id('cl2')))$q$,'23503',null,'geen contractregel van ander bedrijf');
select throws_ok($q$select public.create_invoice('b0000000-0000-0000-0000-00000000000b',jsonb_build_object('contract_id',pg_temp.id('c')))$q$,'23503',null,'geen contract van ander bedrijf');
insert into ids select 'pb',public.register_payment('b0000000-0000-0000-0000-00000000000b',jsonb_build_object('received_on',current_date::text,'amount','10'));
select throws_ok($q$select public.allocate_payment(pg_temp.id('pb'),pg_temp.id('f3'),1)$q$,'23503',null,'betaling B niet op factuur A');
select lives_ok($q$select public.add_invoice_line(pg_temp.id('fb'),'{"description":"TEST — Concept B","unit_price":"10"}')$q$,'concept B');

reset role;
select throws_ok($q$update public.invoice_lines set unit_price=1 where invoice_id=pg_temp.id('f1')$q$,'42501',null,'trigger beschermt uitgereikte regels');
select throws_ok($q$delete from public.invoices where id=pg_temp.id('f1')$q$,'42501',null,'trigger beschermt uitgereikte factuur');
select throws_ok($q$update public.payments set amount=1 where id=pg_temp.id('p1')$q$,'42501',null,'trigger beschermt betaling');
select throws_ok($q$delete from public.payment_allocations$q$,'42501',null,'toewijzingshistorie blijft');
select ok((select count(*) from private.finance_audit where actor='a0000000-0000-0000-0000-000000000002')>20,'financiële mutaties geaudit');

-- Sponsor A -------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.invoices),4,'sponsor ziet eigen uitgereikte facturen/credits');
select is((select count(*)::int from public.invoices where status='draft'),0,'geen concepten');
select is((select count(*)::int from public.invoice_lines),4,'eigen factuurregels');
select is((select count(*)::int from public.payments),2,'eigen niet-teruggedraaide betalingen');
select is((select count(*)::int from public.payment_allocations),3,'eigen actieve toewijzingen');
select is((select sum(open_amount) from public.invoice_balances where kind='invoice'),0.00::numeric(14,2),'eigen saldo');
select throws_ok($q$select public.register_payment('b0000000-0000-0000-0000-00000000000a',jsonb_build_object('received_on',current_date::text,'amount','1'))$q$,'42501',null,'sponsor registreert geen betaling');
select throws_ok($q$select public.issue_invoice(pg_temp.id('fb'),'{}')$q$,'42501',null,'sponsor reikt niets uit');
-- Sponsor B, inactief, bestuur, anon -----------------------------------------------------
select set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
select is((select count(*)::int from public.invoices),0,'sponsor B: geen facturen van A en geen eigen concept');
select is((select count(*)::int from public.payments),1,'sponsor B: alleen eigen betaling');
select is((select count(*)::int from public.invoice_balances),0,'sponsor B: geen saldi van A');
select is((select count(*)::int from public.contract_invoicing),0,'sponsor B: geen contractfacturatie van A');
select set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}',true);
select is((select count(*)::int from public.invoices),0,'inactief: niets');
select set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*)::int from public.invoices),0,'bestuur: inzage via rapportage (fase 7)');
select is((select count(*)::int from public.payments),0,'bestuur: geen betalingen');
select throws_ok($q$select public.create_invoice('b0000000-0000-0000-0000-00000000000a','{}')$q$,'42501',null,'bestuur muteert niets');
reset role;
set local role anon;
select throws_ok('select count(*) from public.invoices','42501',null,'anon geen facturen');
select throws_ok('select count(*) from public.invoice_balances','42501',null,'anon geen saldi');
reset role;
select * from finish();
rollback;
