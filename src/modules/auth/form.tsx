"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { login, recover, setPassword } from "./actions";
export function AuthForm({
  mode,
}: {
  mode: "login" | "recovery" | "password";
}) {
  const [state, action, pending] = useActionState(
    mode === "login" ? login : mode === "recovery" ? recover : setPassword,
    { message: "" },
  );
  return (
    <form action={action} className="space-y-5">
      {mode !== "password" && (
        <label className="block text-sm font-medium">
          E-mailadres
          <input
            className="mt-2 block w-full rounded-md border border-border p-3"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
      )}
      {mode !== "recovery" && (
        <label className="block text-sm font-medium">
          Wachtwoord
          <input
            className="mt-2 block w-full rounded-md border border-border p-3"
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "password" ? 12 : 1}
            maxLength={128}
          />
        </label>
      )}
      {mode === "password" && (
        <label className="block text-sm font-medium">
          Herhaal wachtwoord
          <input
            className="mt-2 block w-full rounded-md border border-border p-3"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
          />
        </label>
      )}
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending
          ? "Even wachten…"
          : mode === "login"
            ? "Inloggen"
            : mode === "recovery"
              ? "Herstelmail aanvragen"
              : "Wachtwoord opslaan"}
      </Button>
      {mode === "login" && (
        <Link className="block text-sm underline" href="/herstellen">
          Wachtwoord vergeten?
        </Link>
      )}
    </form>
  );
}
