// Fase 7-integratie: uitsluitend de lokale standaardstack, eigen willekeurige
// TEST-fixtures en .example-accounts. Geen reset; ruimt alleen eigen data op.
import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import ExcelJS from "exceljs";

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
const marker = randomUUID().slice(0, 8);
const users = [];
const clients = [];
const companies = [randomUUID(), randomUUID(), randomUUID()];
const injected = `=HYPERLINK("https://evil.example","TEST ${marker}")`;
let browser;
let page;
let stage = "fixtures";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
}).format(new Date());
const [y, m] = today.split("-").map(Number);
const season = m >= 7 ? y : y - 1;
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
  await p.goto(`${app}/inloggen`);
  await p.getByLabel("E-mailadres", { exact: true }).fill(email);
  await p.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Inloggen", exact: true }).click();
  await p.waitForURL("**/account");
  return p;
}
async function checkResponsive(p) {
  for (const width of [1440, 360]) {
    await p.setViewportSize({ width, height: 1000 });
    await p.waitForTimeout(300);
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `geen horizontale overflow op ${width}px`,
    );
    const report = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(
      report.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`),
      [],
    );
  }
  await p.setViewportSize({ width: 1440, height: 1000 });
}
async function readWorkbook(response) {
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"], /spreadsheetml/);
  assert.equal(response.headers()["cache-control"], "private, no-store");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await response.body());
  return book;
}

try {
  // 0 commissie, 1 bestuur, 2 sponsor A
  for (const role of ["sponsorcommissie", "clubbestuur", "sponsor"]) {
    const email = `test-${randomUUID()}@report.example`;
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
    `insert into public.sponsors(id,name) values('${companies[0]}','TEST — Rapport ${marker} A'),('${companies[1]}','${injected.replaceAll("'", "''")}'),('${companies[2]}','TEST — Rapport ${marker} prospect');` +
      `insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values('${users[2].id}','${companies[0]}',true);`,
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
  const c = clients[0];
  await ok(
    c.rpc("save_sponsor", {
      target: companies[0],
      details: {
        name: `TEST — Rapport ${marker} A`,
        status: "active",
        is_paying: true,
        notes: `GEHEIM-${marker}`,
      },
    }),
    "A betalend",
  );
  await ok(
    c.rpc("save_sponsor", {
      target: companies[1],
      details: { name: injected, status: "active" },
    }),
    "B actief",
  );
  const contract = await ok(
    c.rpc("create_contract", {
      company: companies[0],
      details: {
        title: "TEST — Seizoen",
        starts_on: `${season}-07-01`,
        ends_on: `${season + 1}-06-30`,
        notice_deadline: plus(30) > `${season + 1}-06-30` ? "" : plus(30),
      },
    }),
    "contract A",
  );
  await ok(
    c.rpc("add_contract_line", {
      contract,
      details: { title: "TEST", unit_price: "12100" },
    }),
    "regel",
  );
  await ok(c.rpc("confirm_contract", { target: contract }), "bevestigen");
  const short = await ok(
    c.rpc("create_contract", {
      company: companies[1],
      details: {
        title: "TEST — Kort",
        starts_on: plus(-30),
        ends_on: plus(45),
      },
    }),
    "contract B",
  );
  await ok(
    c.rpc("add_contract_line", {
      contract: short,
      details: { title: "TEST", unit_price: "1500" },
    }),
    "regel B",
  );
  await ok(c.rpc("confirm_contract", { target: short }), "bevestigen B");
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
      details: { description: "TEST — Termijn", unit_price: "6050" },
    }),
    "factuurregel",
  );
  await ok(
    c.rpc("issue_invoice", { target: invoice, details: { due_on: plus(30) } }),
    "uitreiken",
  );
  const payment = await ok(
    c.rpc("register_payment", {
      company: companies[0],
      details: {
        received_on: today,
        amount: "4000",
        reference: `TEST-${marker}`,
      },
    }),
    "betaling",
  );
  await ok(
    c.rpc("allocate_payment", { payment, invoice, amount: "4000" }),
    "toewijzing",
  );

  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  });

  stage = "dashboard commissie";
  const internal = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  page = await login(internal, users[0].email);
  page.on("pageerror", (e) =>
    console.log("Browserfout:", String(e.message).split("\n")[0]),
  );
  await page.getByRole("link", { name: "Dashboard en rapportages" }).click();
  await expect(
    page.getByRole("heading", { name: /^Sponsoring seizoen \d{4}\/\d{2}$/ }),
  ).toBeVisible();
  const data = await ok(
    c.rpc("report_dashboard", { season, detailed: false }),
    "rapport",
  );
  const euro = (n) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  await expect(page.locator(".dash-hero-value")).toHaveText(
    euro(Number(data.kpis.budget_paying)),
  );
  assert.ok(
    Number(data.kpis.budget_paying) >= 12100,
    "budget bevat betalende sponsor",
  );
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  assert.ok(
    (await page.locator(".recharts-surface").count()) >= 3,
    "drie grafieken",
  );
  await expect(
    page.getByText(`TEST — Rapport ${marker} prospect`),
  ).toBeVisible();
  await expect(page.getByText(injected).first()).toBeVisible();
  await page.locator("summary", { hasText: "Toon als tabel" }).first().click();
  await expect(
    page.getByRole("region", { name: "Tabelweergave" }).first(),
  ).toBeVisible();
  const html = await page.content();
  assert.ok(
    !html.includes(`GEHEIM-${marker}`),
    "geen interne notities op dashboard",
  );
  await page.locator(".recharts-bar-rectangle").first().hover();
  await expect(page.locator(".dash-tooltip").first()).toBeVisible();
  await checkResponsive(page);
  await page
    .getByLabel("Seizoen", { exact: true })
    .selectOption(String(season - 1));
  await page.getByRole("button", { name: "Tonen" }).click();
  await expect(
    page.getByRole("heading", {
      name: `Sponsoring seizoen ${season - 1}/${String(season).slice(2)}`,
    }),
  ).toBeVisible();
  if (process.env.VVP_SCREENSHOT_DIR) {
    await page.goto(`${app}/account/dashboard`);
    await expect(page.locator(".recharts-surface").first()).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `${process.env.VVP_SCREENSHOT_DIR}/dashboard-1440.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${process.env.VVP_SCREENSHOT_DIR}/dashboard-390.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }

  stage = "Excel-export";
  await page.goto(`${app}/account/dashboard?seizoen=${season}`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Exporteer naar Excel" }).click(),
  ]);
  assert.match(
    download.suggestedFilename(),
    /^vvpernis-sponsoring-\d{4}-\d{2}\.xlsx$/,
  );
  const book = await readWorkbook(
    await internal.request.get(
      `${app}/account/dashboard/export?seizoen=${season}`,
    ),
  );
  assert.deepEqual(
    book.worksheets.map((w) => w.name),
    [
      "Samenvatting",
      "Seizoenen",
      "Sponsors",
      "Contracten",
      "Facturen",
      "Betalingen",
    ],
  );
  const summary = book.getWorksheet("Samenvatting");
  assert.equal(
    Number(summary.getCell("B4").value),
    Number(data.kpis.budget_paying),
    "budget in export = dashboard",
  );
  assert.equal(summary.getCell("B4").numFmt.includes("€"), true, "euro-opmaak");
  assert.equal(summary.getCell("A3").value, "Actieve betalende sponsors");
  assert.equal(
    Number(summary.getCell("B3").value),
    Number(data.kpis.active_paying),
  );
  assert.ok(
    !String(summary.getCell("B3").numFmt || "").includes("€"),
    "aantal zonder euro-opmaak",
  );
  const sponsorRows = [];
  book
    .getWorksheet("Sponsors")
    .eachRow((row, i) => i > 1 && sponsorRows.push(row));
  const evil = sponsorRows.find(
    (r) =>
      String(r.getCell(1).value).includes(marker) &&
      String(r.getCell(1).value).includes("HYPERLINK"),
  );
  assert.ok(evil, "geïnjecteerde naam aanwezig");
  assert.equal(
    evil.getCell(1).type,
    ExcelJS.ValueType.String,
    "als tekst, niet als formule",
  );
  assert.ok(
    String(evil.getCell(1).value).startsWith("'="),
    "formule geneutraliseerd",
  );
  let formulas = 0;
  book.eachSheet((ws) =>
    ws.eachRow((row) =>
      row.eachCell(
        (cell) => cell.type === ExcelJS.ValueType.Formula && formulas++,
      ),
    ),
  );
  assert.equal(formulas, 0, "geen formules in export");
  const invoiceRows = book.getWorksheet("Facturen").rowCount - 1;
  assert.ok(invoiceRows >= 1, "factuur in export");
  const exportText = JSON.stringify(book.model);
  assert.ok(
    !exportText.includes(`GEHEIM-${marker}`),
    "geen interne notities in export",
  );
  assert.ok(
    !exportText.includes("@report.example"),
    "geen accountgegevens in export",
  );
  assert.equal(
    (
      await internal.request.get(`${app}/account/dashboard/export?seizoen=abc`)
    ).status(),
    400,
  );

  stage = "bestuur";
  const board = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const pageB = await login(board, users[1].email);
  await pageB.getByRole("link", { name: "Dashboard en rapportages" }).click();
  await expect(pageB.locator(".dash-hero-value")).toHaveText(
    euro(Number(data.kpis.budget_paying)),
  );
  const nav = pageB.getByRole("navigation", { name: "Accountnavigatie" });
  await expect(nav.getByRole("link", { name: "Sponsors" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Financiën" })).toHaveCount(0);
  await expect(
    pageB.getByRole("link", { name: `TEST — Rapport ${marker} A` }),
  ).toHaveCount(0);
  await readWorkbook(
    await board.request.get(
      `${app}/account/dashboard/export?seizoen=${season}`,
    ),
  );
  await checkResponsive(pageB);

  stage = "sponsor en anoniem geweigerd";
  const sponsor = await browser.newContext();
  const pageS = await login(sponsor, users[2].email);
  await expect(
    pageS.getByRole("link", { name: "Dashboard en rapportages" }),
  ).toHaveCount(0);
  await pageS.goto(`${app}/account/dashboard`);
  await expect(
    pageS.getByRole("heading", { name: "Deze pagina is niet beschikbaar." }),
  ).toBeVisible();
  assert.ok(!(await pageS.content()).includes(String(data.kpis.budget_paying)));
  const sExport = await sponsor.request.get(
    `${app}/account/dashboard/export?seizoen=${season}`,
    { maxRedirects: 0 },
  );
  assert.notEqual(sExport.status(), 200, "sponsor geen export");
  assert.ok(!(sExport.headers()["content-type"] || "").includes("spreadsheet"));
  assert.equal(
    (await clients[2].rpc("report_dashboard", { season })).error?.code,
    "42501",
  );
  const anon = await browser.newContext();
  const aExport = await anon.request.get(
    `${app}/account/dashboard/export?seizoen=${season}`,
    { maxRedirects: 0 },
  );
  assert.notEqual(aExport.status(), 200, "anoniem geen export");
  assert.equal(
    (await make().rpc("report_dashboard", { season })).error?.code,
    "42501",
  );
  const logged = execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_VVPSponsor",
      "psql",
      "-U",
      "postgres",
      "-tAc",
      `select count(*) from private.report_exports where actor in ('${users[0].id}','${users[1].id}')`,
    ],
    { encoding: "utf8" },
  ).trim();
  assert.equal(logged, "3", "exports gelogd (2× commissie, 1× bestuur)");

  console.log(
    "PASS: dashboard met hero/kerncijfers/3 grafieken/tooltip/tabelweergave, seizoenswissel, budget = rapportfunctie, prospects en aflopende contracten, Excel-download (6 tabbladen, euro-opmaak, geen formules, formule-injectie geneutraliseerd, geen notities/accounts), bestuur alle cijfers zonder interne navigatie, sponsor/anoniem geweigerd, exportlog, 360/1440px en axe.",
  );
} catch (error) {
  console.error(
    "FAIL rapportagefase:",
    stage,
    String(error.message)
      .split("\n")
      .slice(0, 4)
      .join(" ")
      .replaceAll(password, "[redacted]"),
  );
  if (page)
    await page
      .screenshot({ path: "/tmp/vvp-phase7-failure.png", fullPage: true })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  const ids = users.map((u) => `'${u.id}'`).join(",") || "null";
  const list = companies.map((id) => `'${id}'`).join(",");
  sql(
    `set session_replication_role=replica;` +
      `delete from public.credit_allocations where sponsor_id in (${list});delete from public.payment_allocations where sponsor_id in (${list});` +
      `delete from public.payments where sponsor_id in (${list});delete from public.invoice_lines where sponsor_id in (${list});delete from public.invoices where sponsor_id in (${list});` +
      `delete from public.contract_rights where sponsor_id in (${list});delete from public.contract_lines where sponsor_id in (${list});delete from public.contracts where sponsor_id in (${list});` +
      `delete from private.report_exports where actor in (${ids});delete from private.finance_audit where sponsor_id in (${list}) or actor in (${ids});` +
      `delete from private.contract_audit where sponsor_id in (${list}) or actor in (${ids});delete from private.crm_audit where sponsor_id in (${list}) or actor in (${ids});` +
      `delete from private.sponsor_memberships where user_id in (${ids});delete from private.access_audit where target in (${ids}) or actor in (${ids});` +
      `delete from public.sponsor_internal where sponsor_id in (${list});delete from public.sponsors where id in (${list});` +
      `delete from private.user_access where user_id in (${ids});`,
  );
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
}
