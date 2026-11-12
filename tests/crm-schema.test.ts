import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankCompany,
  companySchema,
  contactSchema,
} from "../src/modules/crm/schema.ts";
test("CRM accepteert lege optionele velden en normaliseert bedrijfsnaam", () => {
  const parsed = companySchema.parse({
    ...blankCompany,
    name: "  TEST — Bedrijf  ",
  });
  assert.equal(parsed.name, "TEST — Bedrijf");
  assert.equal(parsed.status, "prospect");
});
test("CRM weigert ongeldige en onveilige invoer zonder URL-excepties", () => {
  for (const website of [
    "ongeldig",
    "javascript:alert(1)",
    "https://user:secret@crm.example",
  ])
    assert.equal(
      companySchema.safeParse({ ...blankCompany, name: "TEST", website })
        .success,
      false,
    );
  for (const override of [
    { name: "" },
    { kvk: "123" },
    { status: "ongekend" },
    { email: "ongeldig" },
    { owner_id: "geen-id" },
    { notes: "x".repeat(10001) },
  ])
    assert.equal(
      companySchema.safeParse({ ...blankCompany, name: "TEST", ...override })
        .success,
      false,
    );
});
test("contactgegevens staan los van accounts en vereisen gevalideerde waarden", () => {
  assert.equal(
    contactSchema.safeParse({
      name: "TEST — Contact",
      position: "",
      email: "persoon@crm.example",
      phone: "",
      is_primary: true,
    }).success,
    true,
  );
  assert.equal(
    contactSchema.safeParse({
      name: "",
      position: "",
      email: "ongeldig",
      phone: "",
      is_primary: "true",
    }).success,
    false,
  );
});
