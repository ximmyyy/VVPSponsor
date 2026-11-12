-- Expliciete jsonb-casts (SQL-lint); gedrag ongewijzigd.
create or replace function public.add_contract_amendment(target uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.contracts; result uuid; seq integer; item jsonb; created_lines jsonb:='[]'::jsonb; created_rights jsonb:='[]'::jsonb;
 cancelled jsonb:='[]'::jsonb; previous jsonb:='{}'::jsonb; cancel_id uuid;
 lines jsonb:=coalesce(details->'add_lines','[]'::jsonb); rights jsonb:=coalesce(details->'add_rights','[]'::jsonb); cancels jsonb:=coalesce(details->'cancel_rights','[]'::jsonb);
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
revoke all on function public.add_contract_amendment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.add_contract_amendment(uuid,jsonb) to authenticated;
