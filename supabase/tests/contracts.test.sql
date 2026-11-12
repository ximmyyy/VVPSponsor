begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- Uitsluitend fictieve TEST-fixtures; alles rolt terug.
insert into auth.users(id,email) values
 ('70000000-0000-0000-0000-000000000001','c-admin@contract.example'),
 ('70000000-0000-0000-0000-000000000002','c-commissie@contract.example'),
 ('70000000-0000-0000-0000-000000000003','c-bestuur@contract.example'),
 ('70000000-0000-0000-0000-000000000004','c-sponsor-a@contract.example'),
 ('70000000-0000-0000-0000-000000000005','c-sponsor-b@contract.example'),
 ('70000000-0000-0000-0000-000000000006','c-inactief@contract.example'),
 ('70000000-0000-0000-0000-000000000007','c-sponsor-a2@contract.example');
insert into private.user_access(user_id,role,is_active) values
 ('70000000-0000-0000-0000-000000000001','super_admin',true),
 ('70000000-0000-0000-0000-000000000002','sponsorcommissie',true),
 ('70000000-0000-0000-0000-000000000003','clubbestuur',true),
 ('70000000-0000-0000-0000-000000000004','sponsor',true),
 ('70000000-0000-0000-0000-000000000005','sponsor',true),
 ('70000000-0000-0000-0000-000000000006','sponsor',false),
 ('70000000-0000-0000-0000-000000000007','sponsor',true);
insert into public.sponsors(id,name) values
 ('80000000-0000-0000-0000-00000000000a','TEST — Contract A'),
 ('80000000-0000-0000-0000-00000000000b','TEST — Contract B');
insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values
 ('70000000-0000-0000-0000-000000000004','80000000-0000-0000-0000-00000000000a',true),
 ('70000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-00000000000b',true),
 ('70000000-0000-0000-0000-000000000006','80000000-0000-0000-0000-00000000000a',true),
 ('70000000-0000-0000-0000-000000000007','80000000-0000-0000-0000-00000000000a',true);
create temporary table ids(k text primary key, v uuid);
grant all on ids to authenticated;

-- Commissie: pakket en versie --------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
insert into ids select 'p',public.save_package(null,'{"name":"TEST — Pakket Brons","description":"Fictief"}');
insert into ids select 'v1',public.save_package_version(null,(select v from ids where k='p'),
 '{"description":"v1","list_price":"1000.00","vat_rate":"21","rights":[{"description":"TEST — Bordreclame","quantity":"1","unit":"bord"},{"description":"TEST — Social post","quantity":"4","unit":"post"}]}');
select is((select count(*)::int from public.package_right_templates where package_version_id=(select v from ids where k='v1')),2,'conceptversie met twee rechttemplates');
select throws_ok($q$select public.save_package(null,'{"name":"  test — pakket   brons "}')$q$,'23505',null,'genormaliseerde pakketnaam uniek');
select lives_ok($q$select public.publish_package_version((select v from ids where k='v1'))$q$,'versie publiceren');
select throws_ok($q$select public.save_package_version((select v from ids where k='v1'),(select v from ids where k='p'),'{"list_price":"1"}')$q$,'42501',null,'gepubliceerde versie niet bewerkbaar via RPC');
select throws_ok($q$update public.package_versions set list_price=1$q$,'42501',null,'geen directe versiemutatie');
select throws_ok($q$insert into public.package_right_templates(package_version_id,description,quantity,unit) values((select v from ids where k='v1'),'x',1,'x')$q$,'42501',null,'geen directe templatemutatie');

-- Contract A1 vanuit pakketversie ----------------------------------------------
insert into ids select 'c1',public.create_contract('80000000-0000-0000-0000-00000000000a','{"title":"TEST — Seizoen 1","starts_on":"2026-07-01","ends_on":"2027-06-30","notice_deadline":"2027-03-31"}');
select matches((select contract_number from public.contracts where id=(select v from ids where k='c1')),'^SC-[0-9]{4}-[0-9]{4}$','contractnummer toegekend');
insert into ids select 'l1',public.add_contract_line((select v from ids where k='c1'),jsonb_build_object('package_version_id',(select v from ids where k='v1')));
select is((select unit_price from public.contract_lines where id=(select v from ids where k='l1')),1000.0000::numeric(14,4),'prijs als momentopname uit versie');
select is((select count(*)::int from public.contract_rights where contract_id=(select v from ids where k='c1')),2,'rechten als eigen afspraken gekopieerd');
insert into ids select 'r1',id from public.contract_rights where contract_id=(select v from ids where k='c1') and description='TEST — Bordreclame';
insert into ids select 'r2',id from public.contract_rights where contract_id=(select v from ids where k='c1') and description='TEST — Social post';
select throws_ok($q$select public.create_contract('80000000-0000-0000-0000-00000000000a','{"title":"x","starts_on":"2027-01-01","ends_on":"2026-01-01"}')$q$,'23514',null,'einddatum voor begindatum geweigerd');
insert into ids select 'empty',public.create_contract('80000000-0000-0000-0000-00000000000a','{"title":"TEST — Leeg","starts_on":"2026-07-01","ends_on":"2027-06-30"}');
select throws_ok($q$select public.confirm_contract((select v from ids where k='empty'))$q$,'23514',null,'bevestigen zonder regel geweigerd');
select is((select status from public.contracts where id=(select v from ids where k='empty')),'draft','mislukte bevestiging laat concept intact');
select lives_ok($q$select public.confirm_contract((select v from ids where k='c1'))$q$,'contract atomair bevestigd');
select is((select party_snapshot->>'name' from public.contracts where id=(select v from ids where k='c1')),'TEST — Contract A','partijmomentopname vastgelegd');
select throws_ok($q$select public.confirm_contract((select v from ids where k='c1'))$q$,'42501',null,'dubbel bevestigen geweigerd');
select throws_ok($q$select public.add_contract_line((select v from ids where k='c1'),'{"title":"x","unit_price":"1"}')$q$,'42501',null,'geen regel toevoegen na bevestiging');
select throws_ok($q$select public.remove_contract_line((select v from ids where k='l1'))$q$,'42501',null,'geen regel verwijderen na bevestiging');
select throws_ok($q$select public.update_contract_draft((select v from ids where k='c1'),'{"title":"x","starts_on":"2026-01-01","ends_on":"2026-02-01"}')$q$,'42501',null,'bevestigd contract niet als concept te wijzigen');
select throws_ok($q$update public.contracts set title='x'$q$,'42501',null,'geen directe contractmutatie');
select throws_ok($q$delete from public.contracts$q$,'42501',null,'geen contractverwijdering');

-- Nieuwe pakketversie verandert het oude contract niet ----------------------------
insert into ids select 'v2',public.save_package_version(null,(select v from ids where k='p'),'{"list_price":"1500.00","rights":[{"description":"TEST — Alleen v2","quantity":"1","unit":"stuk"}]}');
select lives_ok($q$select public.publish_package_version((select v from ids where k='v2'))$q$,'nieuwe versie publiceren');
select is((select status from public.package_versions where id=(select v from ids where k='v1')),'retired','vorige versie uitgefaseerd');
select is((select list_price from public.package_versions where id=(select v from ids where k='v1')),1000.00::numeric(14,2),'oude versie-inhoud onveranderd');
select is((select current_total from public.contract_totals where contract_id=(select v from ids where k='c1')),1000.00::numeric(14,2),'oude contractwaarde ongewijzigd');
select is((select count(*)::int from public.contract_rights where contract_id=(select v from ids where k='c1') and description='TEST — Alleen v2'),0,'nieuwe templates niet in oud contract');
select throws_ok($q$select public.add_contract_line((select v from ids where k='empty'),jsonb_build_object('package_version_id',(select v from ids where k='v1')))$q$,'42501',null,'uitgefaseerde versie niet meer kiesbaar');

-- Recht- en uitvoeringsbeheer ---------------------------------------------------
select throws_ok($q$select public.update_contract_right((select v from ids where k='r1'),'{"responsible_id":"70000000-0000-0000-0000-000000000004","status":"open"}')$q$,'23514',null,'sponsor kan geen verantwoordelijke zijn');
select lives_ok($q$select public.update_contract_right((select v from ids where k='r1'),'{"responsible_id":"70000000-0000-0000-0000-000000000002","status":"in_progress","deadline":"2026-09-01"}')$q$,'operationele velden bijwerken');
insert into ids select 'f1',public.register_fulfillment((select v from ids where k='r1'),'{"fulfilled_on":"2026-08-01","quantity":"1","description":"TEST — Bord geplaatst","portal_visible":true}');
insert into ids select 'f2',public.register_fulfillment((select v from ids where k='r1'),'{"fulfilled_on":"2026-08-02","quantity":"1","description":"TEST — Foutieve registratie","portal_visible":true}');
select throws_ok($q$select public.register_fulfillment((select v from ids where k='r1'),'{"fulfilled_on":"2999-01-01","quantity":"1","description":"x"}')$q$,'23514',null,'uitvoering in de toekomst geweigerd');
select lives_ok($q$select public.review_fulfillment((select v from ids where k='f1'),'verify')$q$,'uitvoering gecontroleerd');
select throws_ok($q$select public.review_fulfillment((select v from ids where k='f1'),'verify')$q$,'23514',null,'niet dubbel controleren');
select throws_ok($q$select public.review_fulfillment((select v from ids where k='f2'),'void','')$q$,'22023',null,'ongedaan maken vereist reden');
select lives_ok($q$select public.review_fulfillment((select v from ids where k='f2'),'void','TEST — dubbel')$q$,'uitvoering ongedaan met reden');
select throws_ok($q$select public.review_fulfillment((select v from ids where k='f2'),'share')$q$,'P0002',null,'ongedaan gemaakte registratie bevroren');

-- Amendement --------------------------------------------------------------------
select throws_ok($q$select public.add_contract_amendment((select v from ids where k='c1'),'{"effective_on":"2026-10-01","reason":"x"}')$q$,'23514',null,'leeg amendement geweigerd');
insert into ids select 'a1',public.add_contract_amendment((select v from ids where k='c1'),jsonb_build_object('effective_on','2026-10-01','reason','TEST — Uitbreiding','ends_on','2027-12-31',
 'add_lines',jsonb_build_array(jsonb_build_object('title','TEST — Korting','quantity','1','unit_price','-100')),
 'add_rights',jsonb_build_array(jsonb_build_object('description','TEST — Extra recht','quantity','2','unit','stuk')),
 'cancel_rights',jsonb_build_array((select v from ids where k='r2'))));
select is((select baseline_total from public.contract_totals where contract_id=(select v from ids where k='c1')),1000.00::numeric(14,2),'baseline blijft reconstrueerbaar');
select is((select current_total from public.contract_totals where contract_id=(select v from ids where k='c1')),900.00::numeric(14,2),'actuele waarde inclusief amendement');
select is((select changes#>>'{previous,ends_on}' from public.contract_amendments where id=(select v from ids where k='a1')),'2027-06-30','vorige einddatum vastgelegd');
select is((select ends_on from public.contracts where id=(select v from ids where k='c1')),'2027-12-31'::date,'einddatum via amendement');
select is((select status from public.contract_rights where id=(select v from ids where k='r2')),'cancelled','recht geannuleerd via amendement');
select is((select count(*)::int from public.contract_rights where amendment_id=(select v from ids where k='a1')),1,'nieuw recht herleidbaar naar amendement');
select is(current_setting('vvp.amendment',true),'','amendementcontext afgesloten');
select throws_ok($q$select public.register_fulfillment((select v from ids where k='r2'),'{"fulfilled_on":"2026-08-01","quantity":"1","description":"x"}')$q$,'42501',null,'geen uitvoering op geannuleerd recht');
select throws_ok($q$select public.update_contract_right((select v from ids where k='r2'),'{"status":"open"}')$q$,'42501',null,'geannuleerd recht bevroren');
select throws_ok($q$select public.update_contract_right((select v from ids where k='r1'),'{"status":"cancelled"}')$q$,'23514',null,'annuleren alleen via amendement');
select throws_ok($q$select public.add_contract_line((select v from ids where k='empty'),'{"title":"x","unit_price":"-1"}')$q$,'23514',null,'negatieve regel alleen via amendement');

-- Meerdere contracten, verlenging, beëindiging -------------------------------------
insert into ids select 'c2',public.create_contract('80000000-0000-0000-0000-00000000000a','{"title":"TEST — Maatwerk","starts_on":"2026-09-01","ends_on":"2026-12-31"}');
select lives_ok($q$select public.add_contract_line((select v from ids where k='c2'),'{"title":"TEST — Maatwerkregel","quantity":"2","unit_price":"125.50"}')$q$,'maatwerkregel zonder pakket');
select lives_ok($q$select public.confirm_contract((select v from ids where k='c2'))$q$,'tweede contract bevestigd');
select is((select count(*)::int from public.contracts where sponsor_id='80000000-0000-0000-0000-00000000000a' and status='confirmed'),2,'één bedrijf met meerdere lopende contracten');
insert into ids select 'c3',public.renew_contract((select v from ids where k='c1'),'{"starts_on":"2028-01-01","ends_on":"2028-12-31"}');
select is((select predecessor_contract_id from public.contracts where id=(select v from ids where k='c3')),(select v from ids where k='c1'),'verlenging verwijst naar voorganger');
select is((select status from public.contracts where id=(select v from ids where k='c3')),'draft','verlenging start als concept');
select is((select count(*)::int from public.contract_lines where contract_id=(select v from ids where k='c3')),1,'alleen positieve regels gekopieerd');
select is((select count(*)::int from public.contract_rights where contract_id=(select v from ids where k='c3')),2,'niet-geannuleerde rechten gekopieerd');
select throws_ok($q$select public.renew_contract((select v from ids where k='c1'),'{"starts_on":"2028-01-01","ends_on":"2028-12-31"}')$q$,'23505',null,'geen tweede opvolger');
select throws_ok($q$select public.terminate_contract((select v from ids where k='c2'),'{"terminated_on":"2026-11-01"}')$q$,'23514',null,'beëindigen vereist reden');
select lives_ok($q$select public.terminate_contract((select v from ids where k='c2'),'{"terminated_on":"2026-11-01","reason":"TEST — opgezegd"}')$q$,'contract beëindigd');
select is((select current_total from public.contract_totals where contract_id=(select v from ids where k='c2')),251.00::numeric(14,2),'historische waarde na beëindiging behouden');

-- Bedrijfsgrenzen ---------------------------------------------------------------
insert into ids select 'cb',public.create_contract('80000000-0000-0000-0000-00000000000b','{"title":"TEST — B","starts_on":"2026-07-01","ends_on":"2027-06-30"}');
select throws_ok($q$select public.add_contract_right((select v from ids where k='cb'),jsonb_build_object('description','x','quantity','1','unit','x','contract_line_id',(select v from ids where k='l1')))$q$,'23503',null,'geen regel van ander contract/bedrijf koppelen');
select throws_ok($q$select public.renew_contract((select v from ids where k='cb'),'{"starts_on":"2028-01-01","ends_on":"2028-12-31"}')$q$,'42501',null,'concept niet verlengbaar');

-- Documenten ------------------------------------------------------------------------
insert into ids select 'd1',public.register_document('80000000-0000-0000-0000-00000000000a',
 '{"title":"TEST — Contract-PDF","mime_type":"application/pdf","size_bytes":10,"checksum":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sponsor_shared":true}',
 jsonb_build_object('contract_id',(select v from ids where k='c1')));
insert into ids select 'd2',public.register_document('80000000-0000-0000-0000-00000000000a',
 '{"title":"TEST — Bewijsfoto","mime_type":"image/png","size_bytes":10,"checksum":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","sponsor_shared":true}',
 jsonb_build_object('fulfillment_id',(select v from ids where k='f1')));
select throws_ok($q$select public.register_document('80000000-0000-0000-0000-00000000000b','{"title":"x","mime_type":"application/pdf","size_bytes":1}',jsonb_build_object('contract_id',(select v from ids where k='c1')))$q$,'23503',null,'document niet aan contract van ander bedrijf');
select throws_ok($q$select public.finalize_document((select v from ids where k='d1'))$q$,'23514',null,'zonder bestand niet beschikbaar');
select throws_ok($q$insert into public.documents(id,sponsor_id,object_path,title,upload_status) values('90000000-0000-0000-0000-000000000099','80000000-0000-0000-0000-00000000000a','80000000-0000-0000-0000-00000000000a/90000000-0000-0000-0000-000000000099','x','available')$q$,'42501',null,'uploadstatus niet zelf zetten');
select throws_ok($q$update public.documents set sponsor_id='80000000-0000-0000-0000-00000000000b'$q$,'42501',null,'document niet naar ander bedrijf verplaatsen');
reset role;
insert into storage.objects(bucket_id,name,metadata) select 'private-documents',object_path,'{"size":10}' from public.documents where id in ((select v from ids where k='d1'),(select v from ids where k='d2'));
-- Verdediging in de diepte: ook de eigenaar kan de baseline niet stil herschrijven.
select throws_ok($q$update public.contract_lines set unit_price=1 where id=(select v from ids where k='l1')$q$,'42501',null,'trigger beschermt bevestigde regel');
select throws_ok($q$update public.contract_rights set description='x' where id=(select v from ids where k='r1')$q$,'42501',null,'trigger beschermt afgesproken recht');
select throws_ok($q$update public.contract_amendments set reason='x'$q$,'42501',null,'amendement append-only');
select throws_ok($q$update public.package_right_templates set quantity=9 where package_version_id=(select v from ids where k='v1')$q$,'42501',null,'trigger beschermt gepubliceerde templates');
select throws_ok($q$update public.right_fulfillments set description='x' where id=(select v from ids where k='f1')$q$,'42501',null,'uitvoering onveranderlijk');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($q$select public.finalize_document((select v from ids where k='d1'))$q$,'gecontroleerd bestand beschikbaar');
select lives_ok($q$select public.finalize_document((select v from ids where k='d2'))$q$,'bewijs beschikbaar');
reset role;
select ok((select count(*) from private.contract_audit where actor='70000000-0000-0000-0000-000000000002')>20,'mutaties zijn geaudit met actor');

-- Sponsor A ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000004","role":"authenticated","user_metadata":{"role":"super_admin"}}',true);
select is((select count(*)::int from public.contracts),2,'sponsor ziet alleen eigen vastgelegde contracten');
select is((select count(*)::int from public.contracts where status='draft'),0,'geen concepten voor sponsor');
select is((select count(*)::int from public.contract_lines),3,'eigen regels van vastgelegde contracten');
select is((select count(*)::int from public.contract_rights where contract_id=(select v from ids where k='c1')),3,'eigen portaalrechten');
select is((select count(*)::int from public.right_fulfillments),1,'alleen gedeelde, geldige uitvoering');
select is((select count(*)::int from public.contract_amendments),1,'eigen amendementhistorie');
select is((select count(*)::int from public.documents),2,'gedeelde beschikbare documenten');
select is((select count(*)::int from public.contract_documents),1,'eigen contractdocumentkoppeling');
select is((select count(*)::int from public.fulfillment_evidence),1,'eigen bewijskoppeling');
select is((select count(*)::int from public.sponsorship_packages),0,'pakketcatalogus intern');
select is((select count(*)::int from public.package_versions),0,'pakketversies intern');
select is((select count(*)::int from public.contract_totals),2,'totalen volgen RLS');
select throws_ok($q$select public.create_contract('80000000-0000-0000-0000-00000000000a','{"title":"x","starts_on":"2026-01-01","ends_on":"2026-02-01"}')$q$,'42501',null,'sponsor maakt geen contract');
select throws_ok($q$select public.register_fulfillment((select v from ids where k='r1'),'{"fulfilled_on":"2026-08-01","quantity":"1","description":"x"}')$q$,'42501',null,'sponsor registreert geen uitvoering');
select throws_ok($q$select public.review_fulfillment((select v from ids where k='f1'),'unshare')$q$,'42501',null,'sponsor wijzigt geen zichtbaarheid');
select throws_ok($q$insert into public.contracts(sponsor_id,contract_number,title,starts_on,ends_on) values('80000000-0000-0000-0000-00000000000a','SC-2026-9999','x','2026-01-01','2026-02-01')$q$,'42501',null,'geen directe insert');
select throws_ok($q$select public.finalize_document((select v from ids where k='d1'))$q$,'42501',null,'sponsor beheert geen documenten');
-- Tweede gemachtigde van hetzelfde bedrijf ziet dezelfde afspraken.
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select is((select count(*)::int from public.contracts),2,'meerdere gemachtigden per bedrijf');

-- Sponsor B, inactief, bestuur ----------------------------------------------------------
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
select is((select count(*)::int from public.contracts),0,'sponsor B ziet geen contracten van A en geen concept');
select is((select count(*)::int from public.contract_rights),0,'sponsor B geen rechten van A');
select is((select count(*)::int from public.right_fulfillments),0,'sponsor B geen uitvoering van A');
select is((select count(*)::int from public.documents),0,'sponsor B geen documenten van A');
select is((select count(*)::int from public.contract_totals),0,'sponsor B geen totalen van A');
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000006","role":"authenticated"}',true);
select is((select count(*)::int from public.contracts),0,'inactief account ziet niets');
select set_config('request.jwt.claims','{"sub":"70000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*)::int from public.contracts),0,'bestuur: contractoverzicht volgt via rapportage');
select is((select count(*)::int from public.sponsorship_packages),0,'bestuur: geen pakketbeheer');
select throws_ok($q$select public.save_package(null,'{"name":"x"}')$q$,'42501',null,'bestuur muteert geen pakketten');
reset role;
set local role anon;
select throws_ok('select count(*) from public.contracts','42501',null,'anon heeft geen contracttoegang');
select throws_ok('select count(*) from public.contract_totals','42501',null,'anon heeft geen totalen');
select throws_ok($q$select public.save_package(null,'{"name":"x"}')$q$,'42501',null,'anon roept geen RPC aan');
reset role;
select * from finish();
rollback;
