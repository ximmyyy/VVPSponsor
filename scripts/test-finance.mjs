// Fase 6-integratie: uitsluitend de lokale standaardstack, eigen willekeurige
// TEST-fixtures en .example-accounts. Geen reset; ruimt alleen eigen data op.
import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const status = JSON.parse(
  execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:54321");
const app = "http://127.0.0.1:3000";
const admin = createClient(status.API_URL, status.SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const make = () =>
  createClient(status.API_URL, status.PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const sql = (s) =>
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_VVPSponsor",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      s,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
const password = randomBytes(24).toString("base64url");
const marker = randomUUID();
const users = [];
const clients = [];
const companies = [randomUUID(), randomUUID()];
let browser;
let page;
let stage = "fixtures";
const pdf = Buffer.from("%PDF-1.4\n% TEST — fictieve factuur\n%%EOF\n");
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
}).format(new Date());
const inDays = (n) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function login(context, email) {
  const p = await context.newPage();
  p.on("dialog", (d) => d.accept());
  await p.goto(`${app}/inloggen`);
  await p.getByLabel("E-mailadres", { exact: true }).fill(email);
  await p.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Inloggen", exact: true }).click();
  await p.waitForURL("**/account");
  return p;
}
async function checkResponsive() {
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `geen horizontale overflow op ${width}px`,
    );
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(
      report.violations.map((v) => v.id),
      [],
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
const statusText = (text) => page.getByRole("status").filter({ hasText: text });
const balance = async (id) =>
  (
    await clients[0]
      .from("invoice_balances")
      .select("*")
      .eq("invoice_id", id)
      .single()
  ).data;
const ok = async (promise, label) => {
  const r = await promise;
  assert.equal(r.error, null, `${label}: ${r.error?.message}`);
  return r.data;
};

try {
  // 0 commissie, 1 sponsor A, 2 sponsor B, 3 bestuur
  for (const role of [
    "sponsorcommissie",
    "sponsor",
    "sponsor",
    "clubbestuur",
  ]) {
    const email = `test-${randomUUID()}@finance.example`;
    const result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(result.error, null);
    users.push({ id: result.data.user.id, email, role });
    sql(
      `insert into private.user_access(user_id,role,is_active) values('${result.data.user.id}','${role}',true);`,
    );
  }
  sql(
    `insert into public.sponsors(id,name) values('${companies[0]}','TEST — Financieel ${marker} A'),('${companies[1]}','TEST — Financieel ${marker} B');` +
      `insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values('${users[1].id}','${companies[0]}',true),('${users[2].id}','${companies[1]}',true);`,
  );
  for (const u of users) {
    const client = make();
    assert.equal(
      (await client.auth.signInWithPassword({ email: u.email, password }))
        .error,
      null,
    );
    clients.push(client);
  }
  const second = make();
  assert.equal(
    (await second.auth.signInWithPassword({ email: users[0].email, password }))
      .error,
    null,
  );

  stage = "contract als bron";
  const contract = await ok(
    clients[0].rpc("create_contract", {
      company: companies[0],
      details: {
        title: `TEST — Contract ${marker}`,
        starts_on: "2026-07-01",
        ends_on: "2027-06-30",
      },
    }),
    "contract",
  );
  const line = await ok(
    clients[0].rpc("add_contract_line", {
      contract,
      details: {
        title: "TEST — Hoofdsponsoring",
        quantity: "1",
        unit_price: "1210",
        vat_rate: "21",
      },
    }),
    "contractregel",
  );
  await ok(
    clients[0].rpc("confirm_contract", { target: contract }),
    "bevestigen",
  );

  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  });
  const internal = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await login(internal, users[0].email);
  page.on("pageerror", (e) =>
    console.log("Browserfout:", String(e.message).split("\n")[0]),
  );

  stage = "termijnfactuur via UI";
  await page
    .getByRole("link", { name: "Financiën", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Financiën", exact: true }),
  ).toBeVisible();
  await page.goto(
    `${app}/account/financien/facturen/nieuw?sponsor=${companies[0]}&contract=${contract}`,
  );
  await page
    .getByLabel("Kenmerk / omschrijving", { exact: true })
    .fill("Termijn 1");
  await page.getByRole("button", { name: "Conceptfactuur maken" }).click();
  await page.waitForURL(/\/account\/financien\/facturen\/[0-9a-f-]{36}$/);
  const f1 = new URL(page.url()).pathname.split("/").pop();
  await page.locator("summary", { hasText: "Regel uit contract" }).click();
  await page.getByLabel("Contractregel *").selectOption(line);
  await page.getByLabel("Prijs incl. BTW (termijn)").fill("605");
  await page.getByRole("button", { name: "Contractregel toevoegen" }).click();
  await expect(statusText("Regel toegevoegd.")).toBeVisible();
  assert.equal(
    (await clients[1].from("invoices").select("id")).data.length,
    0,
    "sponsor ziet geen concept",
  );
  await page.reload();
  const issueForm = page
    .getByRole("button", { name: "Factuur uitreiken" })
    .locator("xpath=ancestor::form");
  await issueForm.getByRole("button", { name: "Factuur uitreiken" }).click();
  assert.equal(
    await issueForm
      .getByLabel("Vervaldatum *", { exact: true })
      .evaluate((e) => !e.checkValidity()),
    true,
    "vervaldatum verplicht",
  );
  assert.equal((await balance(f1)).status, "draft");
  await issueForm.getByLabel("Vervaldatum *", { exact: true }).fill(inDays(30));
  await issueForm.getByRole("button", { name: "Factuur uitreiken" }).click();
  await expect(
    page.getByRole("heading", { name: /^F-\d{4}-\d{4,}$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: /^Openstaand$/ }),
  ).toBeVisible();
  let b1 = await balance(f1);
  assert.equal(Number(b1.total), 605);
  assert.equal(Number(b1.vat_total), 105, "21% BTW uit 605 incl.");
  assert.equal(Number(b1.total_excl_vat), 500);
  await checkResponsive();

  stage = "betaling registreren en toewijzen via UI";
  await page.goto(
    `${app}/account/financien/betalingen/nieuw?sponsor=${companies[0]}`,
  );
  await page.getByLabel("Bedrag (EUR) *", { exact: true }).fill("1000");
  await page.getByLabel(/^Kenmerk/).fill(`TEST-${marker}`);
  await page.getByRole("button", { name: "Betaling registreren" }).click();
  await page.waitForURL(/\/account\/financien\/betalingen\/[0-9a-f-]{36}$/);
  const p1 = new URL(page.url()).pathname.split("/").pop();
  await page.getByLabel("Openstaande factuur *").selectOption(f1);
  await page.getByLabel("Bedrag (EUR) *", { exact: true }).fill("605");
  await page.getByRole("button", { name: "Toewijzen", exact: true }).click();
  await expect(page.getByText(/^F-\d{4}-\d{4,}:\s€\s605,00$/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/^€\s395,00$/)).toBeVisible();
  b1 = await balance(f1);
  assert.equal(Number(b1.open_amount), 0, "factuur voldaan");
  await checkResponsive();

  stage = "dubbele registratie";
  await page.goto(
    `${app}/account/financien/betalingen/nieuw?sponsor=${companies[0]}`,
  );
  await page.getByLabel("Bedrag (EUR) *", { exact: true }).fill("1000");
  await page.getByLabel(/^Kenmerk/).fill(`TEST-${marker}`);
  await page.getByRole("button", { name: "Betaling registreren" }).click();
  await expect(
    statusText("Er bestaat al een gelijke registratie"),
  ).toBeVisible();

  stage = "gelijktijdige toewijzing";
  const f2 = await ok(
    clients[0].rpc("create_invoice", {
      company: companies[0],
      details: { contract_id: contract },
    }),
    "f2",
  );
  await ok(
    clients[0].rpc("add_invoice_line", {
      invoice: f2,
      details: { contract_line_id: line, unit_price: "605" },
    }),
    "f2 regel",
  );
  await ok(
    clients[0].rpc("issue_invoice", {
      target: f2,
      details: { due_on: inDays(14) },
    }),
    "f2 uitreiken",
  );
  const overInvoice = await ok(
    clients[0].rpc("create_invoice", { company: companies[0], details: {} }),
    "f3",
  );
  await ok(
    clients[0].rpc("add_invoice_line", {
      invoice: overInvoice,
      details: { contract_line_id: line, unit_price: "0.01" },
    }),
    "f3 regel",
  );
  assert.equal(
    (
      await clients[0].rpc("issue_invoice", {
        target: overInvoice,
        details: { due_on: inDays(14) },
      })
    ).error?.code,
    "23514",
    "niet meer dan contractregel factureren",
  );
  const pay = (amount, reference) =>
    ok(
      clients[0].rpc("register_payment", {
        company: companies[0],
        details: {
          received_on: today,
          amount,
          reference: `${reference}-${marker}`,
        },
      }),
      reference,
    );
  const p2 = await pay("300", "P2");
  const race1 = await Promise.all([
    clients[0].rpc("allocate_payment", {
      payment: p2,
      invoice: f2,
      amount: "300",
    }),
    second.rpc("allocate_payment", { payment: p2, invoice: f2, amount: "300" }),
  ]);
  assert.deepEqual(
    race1.map((r) => r.error?.code ?? "ok").sort(),
    ["23514", "ok"],
    "één betaling niet dubbel toewijzen",
  );
  const [p3, p4] = [await pay("200", "P3"), await pay("200", "P4")];
  const race2 = await Promise.all([
    clients[0].rpc("allocate_payment", {
      payment: p3,
      invoice: f2,
      amount: "200",
    }),
    second.rpc("allocate_payment", { payment: p4, invoice: f2, amount: "200" }),
  ]);
  assert.deepEqual(
    race2.map((r) => r.error?.code ?? "ok").sort(),
    ["23514", "ok"],
    "factuur niet overbetalen",
  );
  assert.equal(Number((await balance(f2)).open_amount), 105);
  const leftover = (
    await clients[0]
      .from("payment_balances")
      .select("unallocated")
      .in("payment_id", [p3, p4])
  ).data;
  assert.deepEqual(
    leftover.map((r) => Number(r.unallocated)).sort(),
    [0, 200],
    "onverdeeld bedrag zichtbaar",
  );

  stage = "creditnota via UI";
  await page.goto(`${app}/account/financien/facturen/${f1}`);
  await page
    .getByRole("button", { name: "Volledige creditnota opstellen" })
    .click();
  await page.waitForURL(
    (url) =>
      !url.pathname.endsWith(f1) &&
      /facturen\/[0-9a-f-]{36}$/.test(url.pathname),
  );
  const c1 = new URL(page.url()).pathname.split("/").pop();
  await page.getByRole("button", { name: "Creditnota uitreiken" }).click();
  await expect(
    page.getByRole("heading", { name: /^C-\d{4}-\d{4,}$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: /^Tegoed beschikbaar$/ }),
  ).toBeVisible();
  assert.equal(
    Number((await balance(c1)).open_amount),
    605,
    "betaalde factuur: volledig tegoed",
  );
  await page.getByLabel("Openstaande factuur *").selectOption(f2);
  await page.getByLabel("Bedrag (EUR) *", { exact: true }).fill("105");
  await page.getByRole("button", { name: "Verrekenen", exact: true }).click();
  await expect(
    page.getByText(/^Verrekend met factuur F-\d{4}-\d{4,}:\s€\s105,00$/),
  ).toBeVisible();
  assert.equal(Number((await balance(f2)).open_amount), 0);
  assert.equal(Number((await balance(c1)).open_amount), 500);
  const refund = await ok(
    clients[0].rpc("register_payment", {
      company: companies[0],
      details: {
        received_on: today,
        amount: "500",
        direction: "out",
        reference: `RESTITUTIE-${marker}`,
      },
    }),
    "restitutie",
  );
  await ok(
    clients[0].rpc("allocate_payment", {
      payment: refund,
      invoice: c1,
      amount: "500",
    }),
    "restitutie toewijzen",
  );
  assert.equal(Number((await balance(c1)).open_amount), 0);
  const inv = (
    await clients[0]
      .from("contract_invoicing")
      .select("*")
      .eq("contract_id", contract)
      .single()
  ).data;
  assert.equal(Number(inv.contract_value), 1210, "contractwaarde");
  assert.equal(Number(inv.invoiced_net), 605, "gefactureerd na credit");
  await checkResponsive();

  stage = "factuur-PDF en sponsorinzage";
  await page.goto(`${app}/account/financien/facturen/${f1}`);
  await page.locator("summary", { hasText: "Factuur-PDF uploaden" }).click();
  await page.getByLabel(/Bestand/).setInputFiles({
    name: "factuur.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.getByLabel("Delen met de sponsor", { exact: true }).check();
  await page.getByRole("button", { name: "PDF uploaden" }).click();
  await expect(
    statusText("Factuur-PDF opgeslagen en gedeeld met de sponsor."),
  ).toBeVisible();
  const doc = (
    await clients[0]
      .from("invoice_documents")
      .select("document_id")
      .eq("invoice_id", f1)
      .single()
  ).data.document_id;
  assert.equal(
    (await clients[1].from("invoices").select("id")).data.length,
    3,
    "sponsor A: F1, F2, C1; geen concept",
  );
  assert.equal(
    (await clients[1].from("payments").select("id")).data.length,
    5,
    "sponsor A: eigen geregistreerde betalingen",
  );
  assert.equal(
    (await clients[1].from("invoice_documents").select("document_id")).data
      .length,
    1,
  );
  for (const table of [
    "invoices",
    "invoice_lines",
    "payments",
    "payment_allocations",
    "invoice_balances",
    "contract_invoicing",
  ])
    assert.equal(
      (await clients[2].from(table).select("*")).data.length,
      0,
      `sponsor B: ${table}`,
    );
  assert.equal(
    (await clients[3].from("invoices").select("id")).data.length,
    0,
    "bestuur via rapportage (fase 7)",
  );
  assert.equal(
    (await make().from("invoices").select("id")).error?.code,
    "42501",
    "anon",
  );
  assert.equal(
    (
      await clients[1].rpc("register_payment", {
        company: companies[0],
        details: { received_on: today, amount: "1" },
      })
    ).error?.code,
    "42501",
  );
  const sponsorA = await browser.newContext();
  await login(sponsorA, users[1].email);
  const dl = await sponsorA.request.get(`${app}/account/documenten/${doc}`, {
    maxRedirects: 0,
  });
  assert.equal(dl.status(), 307, "sponsor downloadt eigen factuur-PDF");
  const sponsorB = await browser.newContext();
  await login(sponsorB, users[2].email);
  assert.equal(
    (
      await sponsorB.request.get(`${app}/account/documenten/${doc}`, {
        maxRedirects: 0,
      })
    ).status(),
    404,
  );

  stage = "betaling terugdraaien via UI";
  await page.goto(`${app}/account/financien/betalingen/${p1}`);
  await page
    .getByLabel("Reden *", { exact: true })
    .fill("TEST — foutief geboekt");
  await page.getByRole("button", { name: "Betaling terugdraaien" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Teruggedraaid/ }),
  ).toBeVisible();
  assert.equal(
    Number((await balance(f1)).open_amount),
    605,
    "factuur weer open na terugdraaien",
  );
  assert.equal(
    (await clients[1].from("payments").select("id")).data.length,
    4,
    "teruggedraaide betaling niet in sponsoroverzicht",
  );

  stage = "overzicht";
  await page.goto(`${app}/account/financien?sponsor=${companies[0]}`);
  await expect(page.getByText("4 resultaten", { exact: true })).toBeVisible();
  await checkResponsive();
  if (process.env.VVP_SCREENSHOT_DIR) {
    await page.goto(`${app}/account/financien/facturen/${f2}`);
    await expect(
      page.getByRole("heading", { name: /^F-\d{4}-\d{4,}$/ }),
    ).toBeVisible();
    await page.screenshot({
      path: `${process.env.VVP_SCREENSHOT_DIR}/invoice-1440.png`,
      fullPage: true,
    });
  }

  console.log(
    "PASS: termijnfactuur uit contract, BTW incl. 21%, validatie vervaldatum, gatenvrij F/C-nummer, onveranderlijk na uitreiken, deelbetaling, onverdeeld bedrag, dubbele registratie, gelijktijdige toewijzing (betaling én factuur), over-facturatie geweigerd, creditnota met tegoed, verrekening, restitutie, contractwaarde ≠ gefactureerd ≠ ontvangen, factuur-PDF, sponsor A/B/bestuur/anon-isolatie, terugdraaien, 360/1440px en axe.",
  );
} catch (error) {
  console.error(
    "FAIL financiële fase:",
    stage,
    String(error.message)
      .split("\n")
      .slice(0, 3)
      .join(" ")
      .replaceAll(password, "[redacted]"),
    page
      ? await page
          .getByRole("status")
          .allTextContents()
          .catch(() => [])
      : [],
  );
  if (page)
    await page
      .screenshot({ path: "/tmp/vvp-phase6-failure.png", fullPage: true })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  const ids = users.map((u) => `'${u.id}'`).join(",") || "null";
  const list = companies.map((id) => `'${id}'`).join(",");
  // Alleen eigen fixtures; historie-triggers uitsluitend in deze lokale sessie uit.
  // Nummertellers worden niet teruggezet: lokaal ontstaan daardoor gaten.
  sql(
    `set session_replication_role=replica;` +
      `delete from storage.objects where bucket_id='private-documents' and name like any(array[${companies.map((c) => `'${c}/%'`).join(",")}]);` +
      `delete from public.invoice_documents where sponsor_id in (${list});delete from public.credit_allocations where sponsor_id in (${list});` +
      `delete from public.payment_allocations where sponsor_id in (${list});delete from public.payments where sponsor_id in (${list});` +
      `delete from public.invoice_lines where sponsor_id in (${list});delete from public.invoices where sponsor_id in (${list});` +
      `delete from public.fulfillment_evidence where sponsor_id in (${list});delete from public.contract_documents where sponsor_id in (${list});` +
      `delete from public.documents where sponsor_id in (${list});delete from public.right_fulfillments where sponsor_id in (${list});` +
      `delete from public.contract_rights where sponsor_id in (${list});delete from public.contract_lines where sponsor_id in (${list});` +
      `delete from public.contract_amendments where sponsor_id in (${list});delete from public.contracts where sponsor_id in (${list});` +
      `delete from private.finance_audit where sponsor_id in (${list}) or actor in (${ids});delete from private.contract_audit where sponsor_id in (${list}) or actor in (${ids});` +
      `delete from private.crm_audit where sponsor_id in (${list}) or actor in (${ids});` +
      `delete from private.sponsor_memberships where user_id in (${ids});delete from private.access_audit where target in (${ids}) or actor in (${ids});` +
      `delete from public.sponsor_internal where sponsor_id in (${list});delete from public.sponsors where id in (${list});` +
      `delete from private.user_access where user_id in (${ids});`,
  );
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
}
