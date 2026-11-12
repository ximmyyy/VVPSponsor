-- Losse factuurregels zonder contractregel lazen een niet-toegewezen record.
create or replace function public.add_invoice_line(invoice uuid, details jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.invoices; result uuid; source uuid:=nullif(details->>'contract_line_id','')::uuid;
 c_title text; c_quantity numeric; c_price numeric; c_vat numeric; c_status text;
begin
 perform private.require_internal();
 i:=private.lock_invoice(invoice);
 if i.status<>'draft' then raise exception 'Alleen een concept is bewerkbaar' using errcode='42501'; end if;
 if source is not null then
  select l.title,l.quantity,l.unit_price,l.vat_rate,c.status into c_title,c_quantity,c_price,c_vat,c_status
  from public.contract_lines l join public.contracts c on c.id=l.contract_id where l.id=source and l.sponsor_id=i.sponsor_id;
  if not found then raise exception 'Contractregel hoort niet bij dit bedrijf' using errcode='23503'; end if;
  if c_status='draft' then raise exception 'Alleen regels van een vastgelegd contract' using errcode='42501'; end if;
 end if;
 insert into public.invoice_lines(invoice_id,sponsor_id,contract_line_id,position,description,quantity,unit_price,vat_rate)
 values(invoice,i.sponsor_id,source,(select count(*)::integer from public.invoice_lines where invoice_id=invoice)+1,
  coalesce(nullif(btrim(details->>'description'),''),c_title),
  coalesce(nullif(details->>'quantity','')::numeric,c_quantity,1),
  coalesce(nullif(details->>'unit_price','')::numeric,c_price),
  coalesce(nullif(details->>'vat_rate','')::numeric,c_vat,21))
 returning id into result;
 return result;
end;$$;
revoke all on function public.add_invoice_line(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.add_invoice_line(uuid,jsonb) to authenticated;
