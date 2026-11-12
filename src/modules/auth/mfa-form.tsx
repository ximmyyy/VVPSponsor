"use client";
import { useActionState } from "react";
import { verifyMfa } from "./actions";
import { Button } from "@/components/ui/button";
export function MfaForm() {
  const [state, action, pending] = useActionState(verifyMfa, { message: "" });
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        Authenticatorcode
        <input
          className="mt-2 block rounded border p-3"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          required
        />
      </label>
      {state.message && <p role="status">{state.message}</p>}
      <Button disabled={pending}>Code controleren</Button>
    </form>
  );
}
