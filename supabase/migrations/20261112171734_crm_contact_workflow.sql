create function public.save_sponsor_contact(target uuid,company uuid,details jsonb) returns uuid language plpgsql set search_path='' as $$
declare result uuid;
begin
 if private.current_app_role() not in ('super_admin','sponsorcommissie') or private.current_app_role() is null then raise insufficient_privilege;end if;
 perform 1 from public.sponsors where id=company and archived_at is null for update;
 if not found then raise exception 'Bedrijf niet beschikbaar';end if;
 if target is not null and not exists(select 1 from public.sponsor_contacts where id=target and sponsor_id=company and archived_at is null) then raise exception 'Contact niet beschikbaar';end if;
 if (details->>'is_primary')::boolean then update public.sponsor_contacts set is_primary=false where sponsor_id=company and is_primary and archived_at is null;end if;
 if target is null then
 insert into public.sponsor_contacts(sponsor_id,name,position,email,phone,is_primary) values(company,details->>'name',nullif(details->>'position',''),nullif(details->>'email',''),nullif(details->>'phone',''),coalesce((details->>'is_primary')::boolean,false)) returning id into result;
 else
 update public.sponsor_contacts set name=details->>'name',position=nullif(details->>'position',''),email=nullif(details->>'email',''),phone=nullif(details->>'phone',''),is_primary=coalesce((details->>'is_primary')::boolean,false) where id=target and sponsor_id=company returning id into result;
 end if;
 return result;
end;$$;
revoke all on function public.save_sponsor_contact(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_sponsor_contact(uuid,uuid,jsonb) to authenticated;
