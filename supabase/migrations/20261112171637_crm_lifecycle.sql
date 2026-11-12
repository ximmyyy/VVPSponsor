insert into public.sponsor_internal(sponsor_id) select id from public.sponsors on conflict(sponsor_id) do nothing;
create function private.initialize_sponsor() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.sponsor_internal(sponsor_id) values(new.id);return new;end;$$;
revoke all on function private.initialize_sponsor() from public,anon,authenticated;
create trigger company_defaults after insert on public.sponsors for each row execute function private.initialize_sponsor();
create function private.contact_company_active() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.current_app_role() not in ('super_admin','sponsorcommissie') or private.current_app_role() is null then raise insufficient_privilege;end if;
 perform 1 from public.sponsors where id=new.sponsor_id and archived_at is null for update;
 if not found then raise exception 'Bedrijf niet beschikbaar';end if;
 return new;
end;$$;
revoke all on function private.contact_company_active() from public,anon,authenticated;
create trigger contact_company_active before insert or update on public.sponsor_contacts for each row execute function private.contact_company_active();
