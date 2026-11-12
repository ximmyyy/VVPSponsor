import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amendmentSchema,
  contractPhase,
  contractSchema,
  decimal,
  lineSchema,
  versionSchema,
} from "../src/modules/contracts/schema.ts";
import {
  MAX_UPLOAD_BYTES,
  validateUpload,
} from "../src/modules/contracts/files.ts";

test("bedragen blijven exacte decimale tekst, geen floats", () => {
  assert.equal(decimal(2).parse(" 1250,50 "), "1250.50");
  assert.equal(decimal(4).parse("0.1234"), "0.1234");
  for (const bad of ["1e3", "12.345", "-5", "abc", "", "12345678901"])
    assert.equal(decimal(2).safeParse(bad).success, false, bad);
  assert.equal(decimal(4, { negative: true }).parse("-100"), "-100");
});

test("contractperiode en opzegdatum worden gecontroleerd", () => {
  const base = {
    title: "TEST — Contract",
    starts_on: "2026-07-01",
    ends_on: "2027-06-30",
    notice_deadline: "",
    renewal_terms: "",
    terms: "",
  };
  assert.equal(contractSchema.safeParse(base).success, true);
  assert.equal(
    contractSchema.safeParse({ ...base, ends_on: "2026-01-01" }).success,
    false,
  );
  assert.equal(
    contractSchema.safeParse({ ...base, notice_deadline: "2027-07-01" })
      .success,
    false,
  );
  assert.equal(
    contractSchema.safeParse({ ...base, starts_on: "2026-02-30" }).success,
    false,
  );
});

test("regel vereist pakketversie of titel en prijs; negatief alleen via amendement", () => {
  const custom = {
    package_version_id: "",
    title: "TEST — Maatwerk",
    description: "",
    quantity: "1",
    unit_price: "100",
    vat_rate: "",
  };
  assert.equal(lineSchema.safeParse(custom).success, true);
  assert.equal(
    lineSchema.safeParse({ ...custom, unit_price: "" }).success,
    false,
  );
  assert.equal(
    lineSchema.safeParse({ ...custom, unit_price: "-1" }).success,
    false,
  );
  assert.equal(
    lineSchema.safeParse({ ...custom, quantity: "0" }).success,
    false,
  );
  assert.equal(
    lineSchema.safeParse({ ...custom, vat_rate: "101" }).success,
    false,
  );
  const amendment = {
    effective_on: "2026-10-01",
    reason: "TEST",
    ends_on: "",
    notice_deadline: "",
    add_lines: [
      {
        title: "Korting",
        description: "",
        quantity: "1",
        unit_price: "-50",
        vat_rate: "",
      },
    ],
    add_rights: [],
    cancel_rights: [],
  };
  assert.equal(amendmentSchema.safeParse(amendment).success, true);
  assert.equal(
    amendmentSchema.safeParse({ ...amendment, add_lines: [] }).success,
    false,
    "leeg amendement",
  );
});

test("pakketversie begrenst rechtenlijst", () => {
  const right = {
    description: "TEST",
    quantity: "1",
    unit: "stuk",
    timing: "",
  };
  const base = { description: "", list_price: "", vat_rate: "" };
  assert.equal(
    versionSchema.safeParse({ ...base, rights: [right] }).success,
    true,
  );
  assert.equal(
    versionSchema.safeParse({ ...base, rights: Array(51).fill(right) }).success,
    false,
  );
});

test("afgeleide contractfase gebruikt opgeslagen status", () => {
  const c = {
    status: "confirmed",
    starts_on: "2026-01-01",
    ends_on: "2026-12-31",
  };
  assert.equal(contractPhase(c, "2026-06-01"), "Bevestigd · lopend");
  assert.equal(
    contractPhase(c, "2027-01-01"),
    "Bevestigd · looptijd verstreken",
  );
  assert.equal(
    contractPhase({ ...c, status: "draft" }, "2026-06-01"),
    "Concept",
  );
});

test("uploads: inhoud moet overeenkomen met PDF/PNG/JPEG en het gemelde type", () => {
  const pdf = new TextEncoder().encode("%PDF-1.4\nTEST");
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0,
  ]);
  assert.deepEqual(validateUpload(pdf, "application/pdf"), {
    ok: true,
    type: "application/pdf",
  });
  assert.equal(validateUpload(png, "image/png").ok, true);
  assert.equal(validateUpload(pdf, "image/png").ok, false, "type vervalst");
  assert.equal(
    validateUpload(
      new TextEncoder().encode("<svg onload=alert(1)>"),
      "image/svg+xml",
    ).ok,
    false,
  );
  assert.equal(validateUpload(new Uint8Array(), "application/pdf").ok, false);
  const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
  big.set(pdf);
  assert.equal(validateUpload(big, "application/pdf").ok, false);
});
