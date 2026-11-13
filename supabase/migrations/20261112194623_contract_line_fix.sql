-- Maatwerkregels zonder pakketversie lazen een niet-toegewezen record.
-- Losse variabelen; gedrag voor pakketregels ongewijzigd.
create or replace function private.insert_line(c public.contracts, amendment uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; version uuid:=nullif(details->>'package_version_id','')::uuid; t record;
 v_title text; v_price numeric; v_vat numeric;
begin
 if version is not null then
  select p.name||' (versie '||pv.version_number||')',pv.list_price,pv.vat_rate into v_title,v_price,v_vat
  from public.package_versions pv join public.sponsorship_packages p on p.id=pv.package_id
  where pv.id=version and pv.status='published';
  if not found then raise exception 'Alleen een gepubliceerde pakketversie is te kiezen' using errcode='42501'; end if;
 end if;
 insert into public.contract_lines(contract_id,sponsor_id,package_version_id,amendment_id,position,title,description,quantity,unit_price,vat_rate)
 values(c.id,c.sponsor_id,version,amendment,
  (select count(*)::integer from public.contract_lines where contract_id=c.id)+1,
  coalesce(nullif(btrim(details->>'title'),''),v_title),
  nullif(btrim(details->>'description'),''),coalesce(nullif(details->>'quantity','')::numeric,1),
  coalesce(nullif(details->>'unit_price','')::numeric,v_price),
  coalesce(nullif(details->>'vat_rate','')::numeric,v_vat))
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
