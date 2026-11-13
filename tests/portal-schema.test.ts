import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactHref,
  inviteSchema,
  profileFields,
  profileRequestSchema,
} from "../src/modules/portal/schema.ts";

const base = Object.fromEntries(profileFields.map(([k]) => [k, ""])) as Record<
  string,
  string
>;

test("wijzigingsverzoek valideert dezelfde regels als het CRM", () => {
  assert.equal(
    profileRequestSchema.safeParse({ ...base, name: "TEST", message: "" })
      .success,
    true,
  );
  for (const bad of [
    { name: "" },
    { kvk: "123" },
    { website: "javascript:alert(1)" },
    { email: "geen" },
  ])
    assert.equal(
      profileRequestSchema.safeParse({
        ...base,
        name: "TEST",
        message: "",
        ...bad,
      }).success,
      false,
      JSON.stringify(bad),
    );
});

test("alleen logische bedrijfsvelden zijn aanvraagbaar", () => {
  const keys = profileFields.map(([k]) => k);
  for (const internal of ["notes", "status", "is_paying", "owner_id"])
    assert.equal(keys.includes(internal as never), false);
});

test("contactlink gebruikt uitsluitend het ingestelde adres", () => {
  assert.equal(contactHref(null, "TEST"), null);
  const href = contactHref("sponsoring@club.example", "TEST & Co");
  assert.ok(href!.startsWith("mailto:sponsoring@club.example?subject="));
  assert.equal(
    decodeURIComponent(href!.split("subject=")[1]),
    "Sponsorportaal — TEST & Co",
  );
});

test("uitnodiging vereist geldig e-mailadres", () => {
  assert.equal(
    inviteSchema.safeParse({ email: "collega@bedrijf.example" }).success,
    true,
  );
  assert.equal(inviteSchema.safeParse({ email: "geen-adres" }).success, false);
});
