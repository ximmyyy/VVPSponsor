-- MFA is optioneel; wie een factor verifieert mag die niet via aal1 omzeilen.
create or replace function private.current_app_role() returns text
language sql stable security definer set search_path='' as $$
 select role::text from private.user_access
 where user_id=(select auth.uid()) and is_active and (
 (select auth.jwt()->>'aal')='aal2' or not exists(
 select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified'));
$$;
