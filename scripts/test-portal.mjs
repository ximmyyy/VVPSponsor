// Fase 8-integratie: volledige sponsorflow op mobiel. Uitsluitend de lokale
// standaardstack, eigen willekeurige TEST-fixtures en .example-accounts.
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
      "-tAc",
      s,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
const password = randomBytes(24).toString("base64url");
const marker = randomUUID().slice(0, 8);
const users = [];
const clients = [];
const companies = [randomUUID(), randomUUID()];
const colleagueEmail = `collega-${marker}@portal.example`;
const contactEmail = `sponsoring-${marker}@club.example`;
const pdf = Buffer.from("%PDF-1.4\n% TEST — fictief\n%%EOF\n");
const objects = [];
let browser;
let page;
let stage = "fixtures";
let originalSettings = null;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
}).format(new Date());
const plus = (n) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ok = async (promise, label) => {
  const r = await promise;
  assert.equal(r.error, null, `${label}: ${r.error?.message}`);
  return r.data;
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
async function check(p, widths = [390, 1440]) {
  const original = p.viewportSize();
  for (const width of widths) {
    await p.setViewportSize({ width, height: 900 });
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `geen horizontale overflow op ${width}px (${p.url()})`,
    );
    const report = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(
      report.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`),
      [],
    );
  }
  await p.setViewportSize(original);
}
const statusText = (p, text) => p.getByRole("status").filter({ hasText: text });
async function upload(path) {
  objects.push(path);
  const r = await admin.storage
    .from("private-documents")
    .upload(path, pdf, { contentType: "application/pdf" });
  assert.equal(r.error, null);
}

try {
  // 0 super admin, 1 commissie, 2 sponsor A, 3 sponsor B
  for (const role of [
    "super_admin",
    "sponsorcommissie",
    "sponsor",
    "sponsor",
  ]) {
    const email = `test-${randomUUID()}@portal.example`;
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
  originalSettings = sql(
    `select coalesce(contact_email,'') from public.club_settings`,
  );
  sql(
    `insert into public.sponsors(id,name,city) values('${companies[0]}','TEST — Portaal ${marker} A','Pernis'),('${companies[1]}','TEST — Portaal ${marker} B',null);` +
      `insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values('${users[2].id}','${companies[0]}',true),('${users[3].id}','${companies[1]}',true);`,
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
  const c = clients[1];
  await ok(
    c.rpc("save_sponsor", {
      target: companies[0],
      details: {
        name: `TEST — Portaal ${marker} A`,
        city: "Pernis",
        status: "active",
        is_paying: true,
        kvk: String(10000000 + Math.floor(Math.random() * 89999999)),
        notes: `GEHEIM-${marker}`,
      },
    }),
    "A",
  );
  // Vorig contract (beëindigd) en lopend contract met rechten, uitvoering, bewijs en factuur.
  const old = await ok(
    c.rpc("create_contract", {
      company: companies[0],
      details: {
        title: "TEST — Vorig seizoen",
        starts_on: plus(-500),
        ends_on: plus(-140),
      },
    }),
    "oud",
  );
  await ok(
    c.rpc("add_contract_line", {
      contract: old,
      details: { title: "TEST — Oude regel", unit_price: "800" },
    }),
    "oude regel",
  );
  await ok(c.rpc("confirm_contract", { target: old }), "oud bevestigen");
  const contract = await ok(
    c.rpc("create_contract", {
      company: companies[0],
      details: {
        title: "TEST — Huidig seizoen",
        starts_on: plus(-60),
        ends_on: plus(300),
        notice_deadline: plus(200),
      },
    }),
    "contract",
  );
  await ok(
    c.rpc("add_contract_line", {
      contract,
      details: { title: "TEST — Hoofdsponsoring", unit_price: "2420" },
    }),
    "regel",
  );
  const right = await ok(
    c.rpc("add_contract_right", {
      contract,
      details: {
        description: "TEST — Bordreclame",
        quantity: "1",
        unit: "bord",
      },
    }),
    "recht",
  );
  await ok(
    c.rpc("add_contract_right", {
      contract,
      details: {
        description: "TEST — Intern recht",
        quantity: "1",
        unit: "stuk",
        portal_visible: false,
      },
    }),
    "intern recht",
  );
  await ok(c.rpc("confirm_contract", { target: contract }), "bevestigen");
  await ok(
    c.rpc("update_contract_right", {
      target: right,
      details: { status: "fulfilled" },
    }),
    "uitgevoerd",
  );
  const fulfillment = await ok(
    c.rpc("register_fulfillment", {
      target: right,
      details: {
        fulfilled_on: plus(-5),
        quantity: "1",
        description: "TEST — Bord geplaatst",
        portal_visible: true,
      },
    }),
    "uitvoering",
  );
  const evidence = await ok(
    c.rpc("register_document", {
      company: companies[0],
      details: {
        title: "TEST — Foto bord",
        mime_type: "application/pdf",
        size_bytes: pdf.length,
        sponsor_shared: true,
      },
      link: { fulfillment_id: fulfillment },
    }),
    "bewijs",
  );
  await upload(`${companies[0]}/${evidence}`);
  await ok(c.rpc("finalize_document", { target: evidence }), "bewijs gereed");
  const invoice = await ok(
    c.rpc("create_invoice", {
      company: companies[0],
      details: { contract_id: contract },
    }),
    "factuur",
  );
  await ok(
    c.rpc("add_invoice_line", {
      invoice,
      details: { description: "TEST — Termijn 1", unit_price: "1210" },
    }),
    "factuurregel",
  );
  await ok(
    c.rpc("issue_invoice", { target: invoice, details: { due_on: plus(30) } }),
    "uitreiken",
  );
  const pdfDoc = await ok(
    c.rpc("register_document", {
      company: companies[0],
      details: {
        title: "TEST — Factuur PDF",
        mime_type: "application/pdf",
        size_bytes: pdf.length,
        sponsor_shared: true,
      },
      link: { invoice_id: invoice },
    }),
    "factuur-pdf",
  );
  await upload(`${companies[0]}/${pdfDoc}`);
  await ok(c.rpc("finalize_document", { target: pdfDoc }), "pdf gereed");
  const draft = await ok(
    c.rpc("create_invoice", {
      company: companies[0],
      details: { reference: `CONCEPT-${marker}` },
    }),
    "concept",
  );
  await ok(
    c.rpc("add_invoice_line", {
      invoice: draft,
      details: { description: "TEST — Concept", unit_price: "1" },
    }),
    "conceptregel",
  );

  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  });

  stage = "Super Admin stelt contactadres in";
  const adminCtx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  page = await login(adminCtx, users[0].email);
  await page.getByRole("link", { name: /Clubinstellingen/ }).click();
  await page
    .getByLabel("Contactadres sponsorcommissie", { exact: true })
    .fill(contactEmail);
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(statusText(page, "Clubinstellingen opgeslagen.")).toBeVisible();

  stage = "sponsor mobiel: overzicht";
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page = await login(mobile, users[2].email);
  await page.getByRole("link", { name: "Naar mijn sponsorportaal" }).click();
  await expect(
    page.getByRole("heading", { name: `TEST — Portaal ${marker} A` }),
  ).toBeVisible();
  const mail = page.getByRole("link", { name: "E-mail sturen" });
  const href = await mail.getAttribute("href");
  assert.ok(
    href.startsWith(`mailto:${contactEmail}?subject=`),
    "mailto naar ingesteld clubadres",
  );
  assert.ok(
    decodeURIComponent(href).includes(`TEST — Portaal ${marker} A`),
    "onderwerp met bedrijfsnaam",
  );
  await expect(page.getByRole("link", { name: "Contact" })).toHaveAttribute(
    "href",
    href,
  );
  await expect(page.getByText("1 van 1")).toBeVisible();
  assert.ok(
    !(await page.content()).includes(`GEHEIM-${marker}`),
    "geen interne notities",
  );
  await check(page);

  if (process.env.VVP_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.VVP_SCREENSHOT_DIR}/portal-390.png`,
      fullPage: true,
    });
  stage = "sponsor mobiel: samenwerking";
  await page.getByRole("link", { name: "Samenwerking", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "TEST — Huidig seizoen" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "TEST — Vorig seizoen" }),
  ).toBeVisible();
  await check(page);
  await page.getByRole("link", { name: "TEST — Huidig seizoen" }).click();
  await expect(page.getByText("TEST — Bordreclame")).toBeVisible();
  await expect(page.getByText("TEST — Intern recht")).toHaveCount(0);
  await expect(page.getByText("TEST — Bord geplaatst")).toBeVisible();
  const proof = await mobile.request.get(
    `${app}/account/documenten/${evidence}`,
    { maxRedirects: 0 },
  );
  assert.equal(proof.status(), 307, "bewijs downloadbaar");
  await check(page);
  await page.goto(`${app}/account/portaal/samenwerking/${old}`);
  await expect(page.getByText("TEST — Oude regel")).toBeVisible();

  if (process.env.VVP_SCREENSHOT_DIR) {
    await page.goto(`${app}/account/portaal/samenwerking/${contract}`);
    await expect(page.getByText("TEST — Bordreclame")).toBeVisible();
    await page.screenshot({
      path: `${process.env.VVP_SCREENSHOT_DIR}/portal-contract-390.png`,
      fullPage: true,
    });
  }
  stage = "sponsor mobiel: facturen";
  await page.getByRole("link", { name: "Facturen", exact: true }).click();
  await expect(page.getByText(/F-\d{4}-\d{4,}/).first()).toBeVisible();
  assert.ok(
    !(await page.content()).includes(`CONCEPT-${marker}`),
    "geen conceptfactuur",
  );
  assert.equal(
    (
      await mobile.request.get(`${app}/account/documenten/${pdfDoc}`, {
        maxRedirects: 0,
      })
    ).status(),
    307,
  );
  await check(page);

  stage = "sponsor mobiel: wijzigingsverzoek";
  await page
    .getByRole("link", { name: "Bedrijfsgegevens", exact: true })
    .click();
  const form = page
    .getByRole("button", { name: "Verzoek versturen" })
    .locator("xpath=ancestor::form");
  await form.getByLabel("KvK-nummer", { exact: true }).fill("123");
  await form.getByRole("button", { name: "Verzoek versturen" }).click();
  await expect(
    statusText(page, "Een KvK-nummer heeft 8 cijfers."),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Verzoek versturen" })
    .locator("xpath=ancestor::form")
    .getByLabel("Plaats", { exact: true })
    .fill("Rotterdam");
  await page.getByRole("button", { name: "Verzoek versturen" }).click();
  await expect(statusText(page, "Wijzigingsverzoek verstuurd.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: /^In behandeling$/ }),
  ).toBeVisible();
  const req = (
    await clients[2].from("sponsor_requests").select("id,proposed").single()
  ).data;
  assert.deepEqual(
    req.proposed,
    { city: "Rotterdam" },
    "alleen gewijzigd veld",
  );
  await check(page);

  stage = "sponsor mobiel: collega uitnodigen";
  await page.getByRole("link", { name: "Collega's", exact: true }).click();
  await page
    .getByLabel("Zakelijk e-mailadres *", { exact: true })
    .fill(colleagueEmail);
  await page.getByRole("button", { name: "Uitnodiging versturen" }).click();
  await expect(
    statusText(page, `Uitnodiging verstuurd naar ${colleagueEmail}`),
  ).toBeVisible();
  const invited = (
    await admin.auth.admin.listUsers({ perPage: 1000 })
  ).data.users.find((u) => u.email === colleagueEmail);
  assert.ok(invited, "Auth-uitnodiging aangemaakt");
  users.push({ id: invited.id, email: colleagueEmail, role: "sponsor" });
  assert.equal(
    sql(
      `select sponsor_id from private.sponsor_memberships where user_id='${invited.id}' and is_active`,
    ),
    companies[0],
    "collega aan hetzelfde bedrijf",
  );
  await page.reload();
  await expect(page.getByText(colleagueEmail)).toBeVisible();
  // Lokale test: wachtwoord rechtstreeks zetten i.p.v. mailflow (die is in test:auth gedekt).
  await ok(
    admin.auth.admin.updateUserById(invited.id, {
      password,
      email_confirm: true,
    }),
    "testwachtwoord",
  );
  const colleague = make();
  assert.equal(
    (
      await colleague.auth.signInWithPassword({
        email: colleagueEmail,
        password,
      })
    ).error,
    null,
  );
  assert.equal((await colleague.from("sponsors").select("id")).data.length, 1);
  assert.equal((await colleague.from("contracts").select("id")).data.length, 2);
  await check(page);

  stage = "isolatie";
  for (const table of [
    "sponsor_requests",
    "sponsor_invitations",
    "contracts",
    "invoices",
    "documents",
  ])
    assert.equal(
      (await clients[3].from(table).select("*")).data.length,
      0,
      `sponsor B: ${table}`,
    );
  assert.equal(
    (await clients[3].rpc("portal_company")).data.name,
    `TEST — Portaal ${marker} B`,
  );
  assert.equal((await clients[3].from("sponsors").select("id")).data.length, 1);
  for (const route of [
    "/account/verzoeken",
    "/account/dashboard",
    "/account/contracten",
    "/account/instellingen",
  ]) {
    await page.goto(`${app}${route}`);
    await expect(
      page.getByRole("heading", { name: "Deze pagina is niet beschikbaar." }),
    ).toBeVisible();
  }
  assert.equal(
    (await clients[2].rpc("review_request", { target: req.id, approve: true }))
      .error?.code,
    "42501",
  );

  stage = "commissie beoordeelt";
  const internal = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const pageC = await login(internal, users[1].email);
  await pageC.goto(`${app}/account/verzoeken`);
  const card = pageC.locator("li.dash-panel", {
    hasText: `TEST — Portaal ${marker} A`,
  });
  await expect(card.getByRole("cell", { name: "Rotterdam" })).toBeVisible();
  await card
    .getByLabel("Bericht aan sponsor (optioneel)")
    .fill("TEST — Verwerkt");
  await card.getByRole("button", { name: "Goedkeuren en verwerken" }).click();
  await expect(card).toHaveCount(0);
  assert.equal(
    sql(`select city from public.sponsors where id='${companies[0]}'`),
    "Rotterdam",
  );
  await check(pageC, [1280]);
  await page.goto(`${app}/account/portaal/bedrijf`);
  await expect(
    page.getByRole("status").filter({ hasText: /^Verwerkt$/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Reactie commissie: TEST — Verwerkt"),
  ).toBeVisible();

  stage = "collega intrekken";
  await page.goto(`${app}/account/portaal/collegas`);
  await page
    .locator("li", { hasText: colleagueEmail })
    .getByRole("button", { name: "Toegang intrekken" })
    .click();
  await expect(
    page.locator("li", { hasText: colleagueEmail }).getByRole("status"),
  ).toHaveText("Ingetrokken");
  assert.equal(
    (await colleague.from("sponsors").select("id")).data.length,
    0,
    "intrekking direct effectief",
  );
  assert.equal((await colleague.rpc("portal_company")).error?.code, "42501");

  console.log(
    "PASS: contactadres via Super Admin en mailto in portaal, mobiele sponsorflow (overzicht, lopend + vorige contracten, rechten met gedeeld bewijs, facturen en PDF, wijzigingsverzoek met validatie, collega uitnodigen en intrekken), commissiebeoordeling verwerkt in CRM, isolatie sponsor B, interne routes geweigerd, geen notities/concepten/interne rechten, 390/1440px en axe.",
  );
} catch (error) {
  console.error(
    "FAIL portaalfase:",
    stage,
    String(error.message)
      .split("\n")
      .slice(0, 4)
      .join(" ")
      .replaceAll(password, "[redacted]"),
  );
  if (page)
    await page
      .screenshot({ path: "/tmp/vvp-phase8-failure.png", fullPage: true })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (objects.length)
    await admin.storage.from("private-documents").remove(objects);
  const ids = users.map((u) => `'${u.id}'`).join(",") || "null";
  const list = companies.map((id) => `'${id}'`).join(",");
  sql(
    `set session_replication_role=replica;` +
      `update public.club_settings set contact_email=${originalSettings ? `'${originalSettings.replaceAll("'", "''")}'` : "null"};` +
      `delete from public.sponsor_requests where sponsor_id in (${list});delete from public.sponsor_invitations where sponsor_id in (${list});` +
      `delete from public.invoice_documents where sponsor_id in (${list});delete from public.invoice_lines where sponsor_id in (${list});delete from public.invoices where sponsor_id in (${list});` +
      `delete from public.fulfillment_evidence where sponsor_id in (${list});delete from public.contract_documents where sponsor_id in (${list});delete from public.documents where sponsor_id in (${list});` +
      `delete from public.right_fulfillments where sponsor_id in (${list});delete from public.contract_rights where sponsor_id in (${list});delete from public.contract_lines where sponsor_id in (${list});delete from public.contracts where sponsor_id in (${list});` +
      `delete from private.finance_audit where sponsor_id in (${list}) or actor in (${ids});delete from private.contract_audit where sponsor_id in (${list}) or actor in (${ids});delete from private.crm_audit where sponsor_id in (${list}) or actor in (${ids});` +
      `delete from private.sponsor_memberships where user_id in (${ids});delete from private.access_audit where target in (${ids}) or actor in (${ids});` +
      `delete from public.sponsor_internal where sponsor_id in (${list});delete from public.sponsors where id in (${list});delete from private.user_access where user_id in (${ids});`,
  );
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
}
