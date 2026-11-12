begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- Uitsluitend fictieve TEST-fixtures; alles rolt terug.
insert into auth.users(id,email,created_at) values
 ('e0000000-0000-0000-0000-000000000001','p-commissie@portal.example',now()),
 ('e0000000-0000-0000-0000-000000000002','p-a1@portal.example',now()),
 ('e0000000-0000-0000-0000-000000000003','p-a2@portal.example',now()),
 ('e0000000-0000-0000-0000-000000000004','p-b@portal.example',now()),
 ('e0000000-0000-0000-0000-000000000005','p-bestuur@portal.example',now()),
 ('e0000000-0000-0000-0000-000000000007','oud-account@portal.example','2020-01-01'),
 ('e0000000-0000-0000-0000-000000000009','p-admin@portal.example',now());
insert into private.user_access(user_id,role,is_active) values
 ('e0000000-0000-0000-0000-000000000001','sponsorcommissie',true),
 ('e0000000-0000-0000-0000-000000000002','sponsor',true),
 ('e0000000-0000-0000-0000-000000000003','sponsor',true),
 ('e0000000-0000-0000-0000-000000000004','sponsor',true),
 ('e0000000-0000-0000-0000-000000000005','clubbestuur',true),
 ('e0000000-0000-0000-0000-000000000009','super_admin',true);
insert into public.sponsors(id,name,city) values
 ('f0000000-0000-0000-0000-00000000000a','TEST — Portaal A','Pernis'),
 ('f0000000-0000-0000-0000-00000000000b','TEST — Portaal B',null);
update public.sponsor_internal set kvk='11111111',notes='TEST — Geheim',status='active',is_paying=true where sponsor_id='f0000000-0000-0000-0000-00000000000a';
update public.sponsor_internal set kvk='22222222' where sponsor_id='f0000000-0000-0000-0000-00000000000b';
insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values
 ('e0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-00000000000a',true),
 ('e0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-00000000000a',true),
 ('e0000000-0000-0000-0000-000000000004','f0000000-0000-0000-0000-00000000000b',true);
create temporary table ids(k text primary key, v uuid);
grant all on ids to authenticated;
create function pg_temp.id(key text) returns uuid language sql as $$ select v from ids where k=key $$;
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true) $$;

set local role authenticated;
-- Bedrijfsgegevens --------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-000000000002');
select is(public.portal_company()->>'name','TEST — Portaal A','sponsor ziet eigen bedrijf');
select is(public.portal_company()->>'kvk','11111111','logische zakelijke velden zichtbaar');
select ok(not (public.portal_company() ?| array['notes','status','is_paying','owner_id']),'geen interne velden');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000004');
select is(public.portal_company()->>'name','TEST — Portaal B','sponsor B ziet alleen B');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000001');
select throws_ok('select public.portal_company()','42501',null,'intern account heeft geen portaalbedrijf');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000005');
select throws_ok('select public.portal_company()','42501',null,'bestuur geen portaal');

-- Wijzigingsverzoeken ------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-000000000002');
select throws_ok($q$select public.submit_profile_request('{"city":"Rotterdam","notes":"x"}')$q$,'42501',null,'interne velden niet aanvraagbaar');
select throws_ok($q$select public.submit_profile_request('{"is_paying":"true"}')$q$,'42501',null,'betaalvlag niet aanvraagbaar');
select throws_ok($q$select public.submit_profile_request('{"kvk":"123"}')$q$,'23514',null,'KvK-formaat gecontroleerd');
select throws_ok($q$select public.submit_profile_request('{"website":"javascript:alert(1)"}')$q$,'23514',null,'website-formaat gecontroleerd');
select throws_ok($q$select public.submit_profile_request('{"name":""}')$q$,'23514',null,'naam niet leeg');
select throws_ok($q$select public.submit_profile_request('{"city":"Pernis"}')$q$,'23514',null,'geen verzoek zonder wijziging');
insert into ids select 'r1',public.submit_profile_request('{"city":"Rotterdam","kvk":"87654321","name":"TEST — Portaal A"}','TEST — Verhuisd');
select is((select proposed from public.sponsor_requests where id=pg_temp.id('r1')),'{"city":"Rotterdam","kvk":"87654321"}'::jsonb,'alleen werkelijk gewijzigde velden vastgelegd');
select is((select sponsor_id from public.sponsor_requests where id=pg_temp.id('r1')),'f0000000-0000-0000-0000-00000000000a'::uuid,'bedrijf uit machtiging, niet uit client');
select throws_ok($q$insert into public.sponsor_requests(sponsor_id,proposed) values('f0000000-0000-0000-0000-00000000000b','{"name":"x"}')$q$,'42501',null,'geen directe insert');
insert into ids select 'r2',public.submit_profile_request('{"kvk":"22222222"}');
insert into ids select 'r3',public.submit_profile_request('{"phone":"010-0000000"}');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.sponsor_requests),3,'collega ziet verzoeken van eigen bedrijf');
select lives_ok($q$select public.withdraw_request(pg_temp.id('r3'))$q$,'collega trekt verzoek in');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.sponsor_requests),0,'sponsor B ziet geen verzoeken van A');
select throws_ok($q$select public.withdraw_request(pg_temp.id('r1'))$q$,'P0002',null,'B kan verzoek A niet intrekken');
select throws_ok($q$select public.review_request(pg_temp.id('r1'),true)$q$,'42501',null,'sponsor beoordeelt niet');

select pg_temp.as_user('e0000000-0000-0000-0000-000000000001');
select throws_ok($q$select public.review_request(pg_temp.id('r1'),false,'')$q$,'23514',null,'afwijzen vereist toelichting');
select lives_ok($q$select public.review_request(pg_temp.id('r1'),true,'TEST — Verwerkt')$q$,'commissie keurt goed');
select is((select city from public.sponsors where id='f0000000-0000-0000-0000-00000000000a'),'Rotterdam','profiel bijgewerkt');
select is((select kvk from public.sponsor_internal where sponsor_id='f0000000-0000-0000-0000-00000000000a'),'87654321','interne KvK bijgewerkt');
select is((select notes from public.sponsor_internal where sponsor_id='f0000000-0000-0000-0000-00000000000a'),'TEST — Geheim','overige interne velden ongemoeid');
select is((select previous from public.sponsor_requests where id=pg_temp.id('r1')),'{"city":"Pernis","kvk":"11111111"}'::jsonb,'vorige waarden vastgelegd');
select throws_ok($q$select public.review_request(pg_temp.id('r1'),false,'x')$q$,'P0002',null,'niet dubbel beoordelen');
select throws_ok($q$select public.review_request(pg_temp.id('r2'),true)$q$,'23505',null,'dubbele KvK geweigerd');
select is((select status from public.sponsor_requests where id=pg_temp.id('r2')),'pending','mislukte goedkeuring laat verzoek open');
select is((select kvk from public.sponsor_internal where sponsor_id='f0000000-0000-0000-0000-00000000000a'),'87654321','geen halve wijziging');
select lives_ok($q$select public.review_request(pg_temp.id('r2'),false,'TEST — KvK hoort bij ander bedrijf')$q$,'afwijzen met reden');
select throws_ok($q$update public.sponsor_requests set status='approved'$q$,'42501',null,'geen directe statuswijziging');
reset role;
select throws_ok($q$update public.sponsor_requests set answer='x' where id=pg_temp.id('r2')$q$,'42501',null,'afgehandeld verzoek onveranderlijk (trigger)');
set local role authenticated;

-- Collega's uitnodigen --------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-000000000002');
insert into ids select 'inv',public.portal_create_invitation('  Collega@Invite.example ');
select is((select email from public.sponsor_invitations where id=pg_temp.id('inv')),'collega@invite.example','e-mail genormaliseerd');
insert into ids select 'inv_old',public.portal_create_invitation('oud-account@portal.example');
reset role;
insert into auth.users(id,email,created_at) values('e0000000-0000-0000-0000-000000000006','collega@invite.example',now());
set local role authenticated;
select pg_temp.as_user('e0000000-0000-0000-0000-000000000004');
select throws_ok($q$select public.portal_accept_invitation(pg_temp.id('inv'),'e0000000-0000-0000-0000-000000000006')$q$,'42501',null,'uitnodiging van ander bedrijf niet bruikbaar');
select is((select count(*)::int from public.sponsor_invitations),0,'B ziet uitnodigingen van A niet');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000002');
select throws_ok($q$select public.portal_accept_invitation(pg_temp.id('inv_old'),'e0000000-0000-0000-0000-000000000007')$q$,'42501',null,'bestaand ouder account niet kaapbaar');
select throws_ok($q$select public.portal_accept_invitation(pg_temp.id('inv'),'e0000000-0000-0000-0000-000000000003')$q$,'42501',null,'e-mail moet overeenkomen');
select throws_ok($q$select public.portal_accept_invitation(pg_temp.id('inv'),'e0000000-0000-0000-0000-000000000001')$q$,'42501',null,'geen interne rol overschrijven');
select lives_ok($q$select public.portal_accept_invitation(pg_temp.id('inv'),'e0000000-0000-0000-0000-000000000006')$q$,'nieuwe collega gekoppeld');
select throws_ok($q$select public.portal_accept_invitation(pg_temp.id('inv'),'e0000000-0000-0000-0000-000000000006')$q$,'42501',null,'uitnodiging eenmalig');
select is((select count(*)::int from public.portal_members()),3,'drie gemachtigden bij A');
select is((select count(*)::int from public.portal_members() where is_self),1,'eigen account gemarkeerd');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000006');
select is(public.portal_company()->>'name','TEST — Portaal A','collega heeft toegang tot hetzelfde bedrijf');
select is((select count(*)::int from public.sponsors),1,'collega alleen eigen bedrijf');

-- Intrekken ---------------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-000000000002');
select throws_ok($q$select public.portal_revoke_member('e0000000-0000-0000-0000-000000000002')$q$,'42501',null,'eigen toegang niet intrekken');
select throws_ok($q$select public.portal_revoke_member('e0000000-0000-0000-0000-000000000004')$q$,'P0002',null,'geen gebruiker van ander bedrijf');
select lives_ok($q$select public.portal_revoke_member('e0000000-0000-0000-0000-000000000003')$q$,'collega ingetrokken');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000003');
select throws_ok('select public.portal_company()','42501',null,'ingetrokken collega direct zonder toegang');
select is((select count(*)::int from public.sponsors),0,'ingetrokken collega ziet geen bedrijf');
select throws_ok($q$select public.portal_create_invitation('x@invite.example')$q$,'42501',null,'ingetrokken collega nodigt niet uit');

-- Contactadres ----------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-000000000009');
with changed as (update public.club_settings set contact_email='sponsoring@club.example' returning id) select is((select count(*)::int from changed),1,'Super Admin stelt contactadres in');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000002');
select is((select contact_email from public.club_settings),'sponsoring@club.example','sponsor leest contactadres');
with changed as (update public.club_settings set contact_email='x@evil.example' returning id) select is((select count(*)::int from changed),0,'sponsor wijzigt contactadres niet');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000001');
with changed as (update public.club_settings set contact_email='x@evil.example' returning id) select is((select count(*)::int from changed),0,'commissie wijzigt contactadres niet');
reset role;
set local role anon;
select throws_ok('select public.portal_company()','42501',null,'anon geen portaal');
select throws_ok('select count(*) from public.sponsor_requests','42501',null,'anon geen verzoeken');
reset role;
select ok((select count(*) from private.crm_audit where entity_id=pg_temp.id('r1'))>=2,'verzoek en beoordeling geaudit');
select * from finish();
rollback;
