-- Performance (fase 10-voorbereiding): sponsorbeleid evalueerde per rij een helperfunctie
-- (rol, MFA-niveau en machtiging opnieuw opgezocht). Semantisch identiek, nu één keer per
-- query: vergelijk sponsor_id met de eigen actieve machtiging (InitPlan), wat ook indexgebruik
-- mogelijk maakt. current_sponsor() geeft uitsluitend het eigen bedrijfs-ID (of null) en vereist
-- dezelfde actieve sponsorrol en aal2-controle als voorheen.
grant execute on function private.current_sponsor() to authenticated;

alter policy amendments_read on public.contract_amendments using ((( SELECT private.is_internal() AS is_internal) OR (contract_amendments.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor))));
alter policy contract_documents_read on public.contract_documents using ((( SELECT private.is_internal() AS is_internal) OR ((contract_documents.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE (d.id = contract_documents.document_id))) AND (EXISTS ( SELECT 1
   FROM contracts c
  WHERE (c.id = contract_documents.contract_id))))));
alter policy lines_read on public.contract_lines using ((( SELECT private.is_internal() AS is_internal) OR ((contract_lines.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)) AND (EXISTS ( SELECT 1
   FROM contracts c
  WHERE ((c.id = contract_lines.contract_id) AND (c.status <> 'draft'::text)))))));
alter policy rights_read on public.contract_rights using ((( SELECT private.is_internal() AS is_internal) OR (portal_visible AND (contract_rights.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)) AND (EXISTS ( SELECT 1
   FROM contracts c
  WHERE ((c.id = contract_rights.contract_id) AND (c.status <> 'draft'::text)))))));
alter policy contracts_read on public.contracts using ((( SELECT private.is_internal() AS is_internal) OR ((status <> 'draft'::text) AND (contracts.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)))));
alter policy credit_allocations_read on public.credit_allocations using ((( SELECT private.is_internal() AS is_internal) OR ((reversed_at IS NULL) AND (credit_allocations.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)) AND (EXISTS ( SELECT 1
   FROM invoices i
  WHERE (i.id = credit_allocations.credit_invoice_id))) AND (EXISTS ( SELECT 1
   FROM invoices i
  WHERE (i.id = credit_allocations.target_invoice_id))))));
alter policy documents_read on public.documents using ((( SELECT private.is_internal() AS is_internal) OR ((upload_status = 'available'::text) AND (( SELECT private.current_app_role() AS current_app_role) = 'clubbestuur'::text) AND board_shared) OR ((upload_status = 'available'::text) AND sponsor_shared AND (documents.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)))));
alter policy evidence_read on public.fulfillment_evidence using ((( SELECT private.is_internal() AS is_internal) OR ((fulfillment_evidence.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE (d.id = fulfillment_evidence.document_id))) AND (EXISTS ( SELECT 1
   FROM right_fulfillments f
  WHERE (f.id = fulfillment_evidence.right_fulfillment_id))))));
alter policy invoice_documents_read on public.invoice_documents using ((( SELECT private.is_internal() AS is_internal) OR ((invoice_documents.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE (d.id = invoice_documents.document_id))) AND (EXISTS ( SELECT 1
   FROM invoices i
  WHERE (i.id = invoice_documents.invoice_id))))));
alter policy invoice_lines_read on public.invoice_lines using ((( SELECT private.is_internal() AS is_internal) OR ((invoice_lines.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)) AND (EXISTS ( SELECT 1
   FROM invoices i
  WHERE ((i.id = invoice_lines.invoice_id) AND (i.status = 'issued'::text)))))));
alter policy invoices_read on public.invoices using ((( SELECT private.is_internal() AS is_internal) OR ((status = 'issued'::text) AND (invoices.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)))));
alter policy payment_allocations_read on public.payment_allocations using ((( SELECT private.is_internal() AS is_internal) OR ((reversed_at IS NULL) AND (payment_allocations.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)) AND (EXISTS ( SELECT 1
   FROM payments p
  WHERE (p.id = payment_allocations.payment_id))) AND (EXISTS ( SELECT 1
   FROM invoices i
  WHERE (i.id = payment_allocations.invoice_id))))));
alter policy payments_read on public.payments using ((( SELECT private.is_internal() AS is_internal) OR ((status = 'registered'::text) AND (payments.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)))));
alter policy fulfillments_read on public.right_fulfillments using ((( SELECT private.is_internal() AS is_internal) OR (portal_visible AND (voided_at IS NULL) AND (right_fulfillments.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)) AND (EXISTS ( SELECT 1
   FROM contract_rights r
  WHERE (r.id = right_fulfillments.contract_right_id))))));
alter policy invitations_read on public.sponsor_invitations using ((( SELECT private.is_internal() AS is_internal) OR (sponsor_invitations.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor))));
alter policy requests_read on public.sponsor_requests using ((( SELECT private.is_internal() AS is_internal) OR (sponsor_requests.sponsor_id = ( SELECT private.current_sponsor() AS current_sponsor)))
);
alter policy sponsors_read on public.sponsors using (
 ( SELECT private.is_internal() AS is_internal)
 OR (( SELECT private.current_app_role() AS current_app_role) = 'clubbestuur'::text)
 OR (id = ( SELECT private.current_sponsor() AS current_sponsor)));
