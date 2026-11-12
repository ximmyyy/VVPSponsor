alter table private.access_audit add column before_state jsonb, add column after_state jsonb;
create function private.audit_access_change() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
 insert into private.access_audit(actor,target,operation,after_state) values(auth.uid(),new.user_id,tg_table_name||'_INSERT',to_jsonb(new));
 elsif new is distinct from old then
 insert into private.access_audit(actor,target,operation,before_state,after_state) values(auth.uid(),new.user_id,tg_table_name||'_UPDATE',to_jsonb(old),to_jsonb(new));
 end if;
 return new;
end;
$$;
revoke all on function private.audit_access_change() from public,anon,authenticated;
create trigger user_access_audit after insert or update on private.user_access for each row execute function private.audit_access_change();
create trigger membership_audit after insert or update on private.sponsor_memberships for each row execute function private.audit_access_change();
