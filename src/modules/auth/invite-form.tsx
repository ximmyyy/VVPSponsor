"use client";
import { useActionState } from "react";
import { invite } from "./invitations";
import { Button } from "@/components/ui/button";
export function InviteForm({
  companies,
}: {
  companies: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(invite, { message: "" });
  return (
    <form action={action} className="max-w-md space-y-5">
      <label className="block">
        E-mailadres
        <input
          name="email"
          type="email"
          required
          className="block w-full rounded border p-3"
        />
      </label>
      <label className="block" htmlFor="invite-role">
        Rol
      </label>
      <select
        id="invite-role"
        name="role"
        className="block w-full rounded border p-3"
      >
        <option value="sponsor">Sponsor</option>
        <option value="sponsorcommissie">Sponsorcommissie</option>
        <option value="clubbestuur">Clubbestuur</option>
        <option value="super_admin">Super Admin</option>
      </select>
      <label className="block" htmlFor="invite-company">
        Bedrijf (alleen bij Sponsor)
      </label>
      <select
        id="invite-company"
        name="company"
        className="block w-full rounded border p-3"
      >
        <option value="">Geen bedrijf geselecteerd</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
      {state.message && <p role="status">{state.message}</p>}
      <Button disabled={pending}>
        {pending ? "Even wachten…" : "Uitnodiging versturen"}
      </Button>
    </form>
  );
}
