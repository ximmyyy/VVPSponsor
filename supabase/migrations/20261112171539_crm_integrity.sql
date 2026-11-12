-- Generieke audit leest alleen de relevante UUIDs, zonder ontbrekende recordvelden.
create or replace function private.audit_crm() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb:=to_jsonb(new); company uuid; entity uuid;
begin
 company:=case when tg_table_name='sponsors' then (row_data->>'id')::uuid else (row_data->>'sponsor_id')::uuid end;
 entity:=coalesce((row_data->>'id')::uuid,company);
 insert into private.crm_audit(actor,sponsor_id,entity_id,operation) values(auth.uid(),company,entity,tg_table_name||'_'||tg_op);
 return new;
end;$$;
revoke update on public.sponsor_internal from authenticated;
grant update(status,kvk,vat_number,street,postal_code,email,phone,notes,owner_id) on public.sponsor_internal to authenticated;
