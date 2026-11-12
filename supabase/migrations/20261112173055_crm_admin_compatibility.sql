-- Expliciete Super Admin-herkoppeling mag geen oude contact-FK meenemen.
create or replace function public.set_user_access(target uuid, new_role text, active boolean, company uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if private.current_app_role() is distinct from 'super_admin' then raise insufficient_privilege; end if;
 if target=auth.uid() then raise exception 'Eigen rechten niet via deze functie wijzigen'; end if;
 if new_role not in ('super_admin','sponsorcommissie','clubbestuur','sponsor') or active is null then raise exception 'Ongeldige rol of status'; end if;
 if (new_role='sponsor' and active and company is null) or (new_role<>'sponsor' and company is not null) then raise exception 'Ongeldige bedrijfskoppeling'; end if;
 -- FK-check ook bij een ingetrokken koppeling; alles in één transactie.
 insert into private.user_access(user_id,role,is_active) values(target,new_role::private.app_role,active)
 on conflict(user_id) do update set role=excluded.role,is_active=excluded.is_active;
 update private.sponsor_memberships set is_active=false where user_id=target;
 if company is not null then
 insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values(target,company,active)
 on conflict(user_id) do update set sponsor_id=excluded.sponsor_id,is_active=excluded.is_active,contact_id=case when sponsor_memberships.sponsor_id=excluded.sponsor_id then sponsor_memberships.contact_id else null end;
 end if;
 insert into private.access_audit(actor,target,operation) values(auth.uid(),target,'set_user_access');
end;
$$;
revoke all on function public.set_user_access(uuid,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.set_user_access(uuid,text,boolean,uuid) to authenticated;
