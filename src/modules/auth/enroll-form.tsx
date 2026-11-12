"use client";
import { useActionState } from "react";
import { enroll, confirmEnrollment } from "./enroll";
import { Button } from "@/components/ui/button";
export function EnrollForm() {
  const [setup, start, pending] = useActionState(enroll, {
    message: "",
    factorId: "",
    secret: "",
  });
  const [state, confirm, checking] = useActionState(confirmEnrollment, {
    message: "",
  });
  return (
    <div className="max-w-md space-y-6">
      <p>
        MFA is optioneel. Na activeren is bij iedere nieuwe login de extra code
        nodig. Bewaar je authenticator zorgvuldig; herstel verloopt via de
        vertrouwde clubbeheerder.
      </p>
      <form action={start}>
        <Button disabled={pending}>Authenticator instellen</Button>
      </form>
      {setup.message && <p role="status">{setup.message}</p>}
      {setup.secret && (
        <>
          <code className="block break-all">{setup.secret}</code>
          <form action={confirm} className="space-y-4">
            <input type="hidden" name="factorId" value={setup.factorId} />
            <label className="block">
              Authenticatorcode
              <input
                className="block rounded border p-3"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
              />
            </label>
            {state.message && <p role="status">{state.message}</p>}
            <Button disabled={checking}>Authenticator bevestigen</Button>
          </form>
        </>
      )}
    </div>
  );
}
