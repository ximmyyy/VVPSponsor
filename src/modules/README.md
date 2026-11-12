# Modulegrenzen

Routes in `src/app` zijn adapters; validatie, domeinservices en datatoegang horen in de eigen module.
Toekomstige modules: auth, sponsors, packages, contracts, finance, rights, documents,
acquisition, tasks, events, notifications, reporting, public-site en settings.
Aanwezig: `auth`, `crm` (fase 4) en `contracts` (fase 5: pakketten, contracten,
rechten en contract-/bewijsdocumenten). Maak een module pas aan in de opgedragen fase. Modules krijgen geen service-role-client.
Gedeelde technische primitives staan in `src/lib`; gedeelde UI volgt in fase 2.
