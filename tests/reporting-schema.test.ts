import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSeason,
  safeText,
  seasonLabel,
} from "../src/modules/reporting/schema.ts";
import { companySchema, blankCompany } from "../src/modules/crm/schema.ts";

test("seizoen loopt van juli tot juni en wordt veilig geparsed", () => {
  assert.equal(seasonLabel(2026), "2026/27");
  assert.equal(seasonLabel(2099), "2099/00");
  assert.equal(parseSeason("2025", 2026), 2025);
  for (const bad of ["abc", "1999", "2101", "2025.5", undefined, ["2025"]])
    assert.equal(parseSeason(bad, 2026), 2026, String(bad));
});

test("exporttekst die op een formule lijkt wordt geneutraliseerd", () => {
  for (const evil of ["=1+1", "+31 6", "-2", "@SUM(A1)", "\t=x"])
    assert.ok(safeText(evil).startsWith("'"), evil);
  assert.equal(safeText("TEST — Bedrijf"), "TEST — Bedrijf");
  assert.equal(safeText(null), "");
});

test("CRM-vlag betalende sponsor is verplicht boolean", () => {
  assert.equal(
    companySchema.parse({ ...blankCompany, name: "TEST" }).is_paying,
    false,
  );
  assert.equal(
    companySchema.safeParse({ ...blankCompany, name: "TEST", is_paying: "ja" })
      .success,
    false,
  );
});
