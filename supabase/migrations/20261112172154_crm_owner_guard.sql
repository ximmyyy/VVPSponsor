create or replace function private.check_crm_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and (private.current_app_role() is null or private.current_app_role() not in ('super_admin','sponsorcommissie')) then raise insufficient_privilege;end if;
 if new.owner_id is not null and (tg_op='INSERT' or new.owner_id is distinct from old.owner_id) and not exists(
 select 1 from private.user_access where user_id=new.owner_id and is_active and role in ('super_admin','sponsorcommissie')) then raise exception 'Ongeldige eigenaar';end if;
 return new;
end;$$;
