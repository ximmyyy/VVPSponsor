import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  invoiceLineSchema,
  issueSchema,
  paymentSchema,
  paymentState,
} from "../src/modules/finance/schema.ts";

test("bedragen in centen als exacte tekst", () => {
  assert.equal(cents.parse("1.210,00".replace(".", "")), "1210.00");
  for (const bad of ["0", "-1", "1.001", "abc", ""])
    assert.equal(cents.safeParse(bad).success, false, bad);
});

test("factuurregel vereist contractregel of omschrijving met bedrag", () => {
  const free = {
    contract_line_id: "",
    description: "TEST — Losse post",
    quantity: "1",
    unit_price: "121",
    vat_rate: "21",
  };
  assert.equal(invoiceLineSchema.safeParse(free).success, true);
  assert.equal(
    invoiceLineSchema.safeParse({ ...free, unit_price: "" }).success,
    false,
  );
  assert.equal(
    invoiceLineSchema.safeParse({ ...free, description: "" }).success,
    false,
  );
  assert.equal(
    invoiceLineSchema.safeParse({ ...free, vat_rate: "121" }).success,
    false,
  );
  assert.equal(
    invoiceLineSchema.safeParse({
      ...free,
      contract_line_id: "00000000-0000-4000-8000-000000000000",
      description: "",
      unit_price: "",
      quantity: "",
    }).success,
    true,
    "contractregel levert standaardwaarden",
  );
});

test("uitreiken: factuur vereist vervaldatum, credit niet", () => {
  assert.equal(
    issueSchema.safeParse({
      kind: "invoice",
      issue_date: "2026-11-12",
      due_on: "",
    }).success,
    false,
  );
  assert.equal(
    issueSchema.safeParse({
      kind: "credit",
      issue_date: "2026-11-12",
      due_on: "",
    }).success,
    true,
  );
  assert.equal(
    issueSchema.safeParse({
      kind: "invoice",
      issue_date: "2026-11-12",
      due_on: "2026-11-11",
    }).success,
    false,
  );
});

test("betaling: richting, methode en bedrag gevalideerd", () => {
  const base = {
    direction: "in",
    received_on: "2026-11-12",
    amount: "500",
    method: "bank",
    reference: "",
  };
  assert.equal(paymentSchema.parse(base).allow_duplicate, false);
  assert.equal(
    paymentSchema.parse({ ...base, allow_duplicate: "on" }).allow_duplicate,
    true,
  );
  assert.equal(
    paymentSchema.safeParse({ ...base, direction: "sideways" }).success,
    false,
  );
  assert.equal(
    paymentSchema.safeParse({ ...base, amount: "0" }).success,
    false,
  );
});

test("afgeleide betaalstatus", () => {
  const b = {
    kind: "invoice",
    status: "issued",
    total: 100,
    open_amount: 100,
    due_on: "2026-12-01",
  };
  assert.equal(paymentState(b, "2026-11-12"), "Openstaand");
  assert.equal(
    paymentState({ ...b, open_amount: 40 }, "2026-11-12"),
    "Deels betaald",
  );
  assert.equal(paymentState(b, "2026-12-02"), "Vervallen");
  assert.equal(paymentState({ ...b, open_amount: 0 }, "2026-12-02"), "Voldaan");
  assert.equal(
    paymentState({ ...b, kind: "credit", open_amount: 5 }, "2026-11-12"),
    "Tegoed beschikbaar",
  );
  assert.equal(
    paymentState({ ...b, status: "draft" }, "2026-11-12"),
    "Concept",
  );
});
