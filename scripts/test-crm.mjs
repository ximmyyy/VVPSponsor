// Alleen de lokale standaardstack, eigen willekeurige fixtures, geen reset.
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
const password = randomBytes(24).toString("base64url"),
  marker = randomUUID(),
  name = `TEST — CRM ${marker}`;
const users = [],
  clients = [],
  companies = [];
let browser,
  page,
  stage = "fixtures";
async function checkResponsive() {
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(report.violations, []);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
try {
  for (const role of [
    "super_admin",
    "sponsorcommissie",
    "clubbestuur",
    "sponsor",
    "sponsor",
    "sponsor",
  ]) {
    const email = `test-${randomUUID()}@crm.example`;
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
    const client = make();
    assert.equal(
      (await client.auth.signInWithPassword({ email, password })).error,
      null,
    );
    clients.push(client);
  }
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (error) =>
    console.log(
      "Browserfout:",
      String(error.message).split("\n")[0].replaceAll(password, "[redacted]"),
    ),
  );
  await page.goto("http://127.0.0.1:3000/inloggen");
  await page.getByLabel("E-mailadres", { exact: true }).fill(users[1].email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
  await page.waitForURL("**/account");
  stage = "bedrijf aanmaken";
  await page.getByRole("link", { name: "Sponsors beheren" }).click();
  await page
    .getByRole("link", { name: "Bedrijf toevoegen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bedrijf opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Vul de bedrijfsnaam in.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Bedrijfsnaam *", { exact: true }).fill(name);
  await page.getByLabel("Website", { exact: true }).fill("https://crm.example");
  await page.getByLabel("Plaats", { exact: true }).fill("TEST — Plaats");
  const kvk = (10000000 + Math.floor(Math.random() * 89999999)).toString();
  await page.getByLabel("KvK-nummer", { exact: true }).fill(kvk);
  await page
    .getByLabel("Interne notities", { exact: true })
    .fill("TEST — STRICT PRIVATE NOTITIE");
  await page
    .getByLabel("Verantwoordelijke", { exact: true })
    .selectOption(users[1].id);
  await checkResponsive();
  await page
    .getByRole("button", { name: "Bedrijf opslaan", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const company = new URL(page.url()).pathname.split("/").pop();
  companies.push(company);
  const form = () =>
    page.getByRole("button", { name: "Contactpersoon opslaan", exact: true });
  stage = "contacten";
  await page
    .getByLabel("Naam contactpersoon *", { exact: true })
    .fill("TEST — Contact A");
  await page
    .getByLabel("E-mailadres contactpersoon", { exact: true })
    .fill(users[3].email);
  await page.getByLabel("Primair contactpersoon", { exact: true }).check();
  await form().click();
  await expect(
    page.getByRole("heading", { name: /TEST — Contact A/ }),
  ).toBeVisible();
  const contacts = await clients[1]
    .from("sponsor_contacts")
    .select("id,name,is_primary")
    .eq("sponsor_id", company);
  assert.equal(contacts.data.length, 1);
  const contact = contacts.data[0].id;
  assert.equal(
    (
      await clients[1].rpc("manage_sponsor_member", {
        company,
        target: users[3].id,
        contact,
        active: true,
      })
    ).error,
    null,
  );
  const noLogin = `no-login-${randomUUID()}@crm.example`;
  await page
    .getByLabel("Naam contactpersoon *", { exact: true })
    .fill("TEST — Contact twee");
  await page
    .getByLabel("E-mailadres contactpersoon", { exact: true })
    .fill(noLogin);
  await page.getByLabel("Primair contactpersoon", { exact: true }).check();
  await form().click();
  await expect(
    page.getByRole("heading", { name: /TEST — Contact twee/ }),
  ).toBeVisible();
  const current = await clients[1]
    .from("sponsor_contacts")
    .select("id,name,is_primary")
    .eq("sponsor_id", company);
  assert.equal(current.data.length, 2);
  assert.equal(current.data.filter((c) => c.is_primary).length, 1);
  assert.equal(
    current.data.find((c) => c.is_primary).name,
    "TEST — Contact twee",
  );
  assert.ok(
    !(await admin.auth.admin.listUsers()).data.users.some(
      (u) => u.email === noLogin,
    ),
    "contact maakt geen account",
  );
  stage = "contact bewerken en archiveren";
  const firstCard = page
    .getByRole("heading", { name: /^TEST — Contact A/ })
    .locator("..");
  await firstCard
    .getByRole("link", { name: "Contactpersoon bewerken" })
    .click();
  await page
    .getByLabel("Telefoon contactpersoon", { exact: true })
    .fill("TEST — telefoon");
  await page
    .getByRole("button", { name: "Contactpersoon opslaan", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Contactpersoon opgeslagen" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Terug naar bedrijf" }).click();
  await firstCard
    .getByRole("button", { name: "Contactpersoon archiveren", exact: true })
    .click();
  await expect(
    firstCard.getByRole("button", {
      name: "Contactpersoon herstellen",
      exact: true,
    }),
  ).toBeVisible();
  await firstCard
    .getByRole("button", { name: "Contactpersoon herstellen", exact: true })
    .click();
  await expect(
    firstCard.getByRole("link", { name: "Contactpersoon bewerken" }),
  ).toBeVisible();
  stage = "conversie en duplicaten";
  await page
    .getByRole("link", { name: "Bedrijf bewerken", exact: true })
    .click();
  await expect(
    page.getByLabel("Verantwoordelijke", { exact: true }),
  ).toHaveValue(users[1].id);
  await page
    .getByLabel("Relatiestatus", { exact: true })
    .selectOption("active");
  await page
    .getByRole("button", { name: "Bedrijf opslaan", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  assert.equal(new URL(page.url()).pathname.split("/").pop(), company);
  const duplicate = await clients[1].rpc("save_sponsor", {
    target: null,
    details: {
      name: name.toUpperCase().replaceAll(" ", "  "),
      status: "prospect",
    },
  });
  assert.equal(duplicate.error?.code, "23505");
  const b = await clients[1].rpc("save_sponsor", {
    target: null,
    details: { name: `TEST — CRM B ${marker}`, status: "prospect" },
  });
  assert.equal(b.error, null);
  companies.push(b.data);
  const c = await clients[1].rpc("save_sponsor_contact", {
    target: null,
    company: b.data,
    details: {
      name: "TEST — Contact B",
      email: users[4].email,
      is_primary: true,
    },
  });
  assert.equal(c.error, null);
  assert.equal(
    (
      await clients[1].rpc("manage_sponsor_member", {
        company: b.data,
        target: users[4].id,
        contact: c.data,
        active: true,
      })
    ).error,
    null,
  );
  stage = "API-autorisatie";
  for (const i of [2, 3, 4, 5]) {
    assert.equal(
      (await clients[i].from("sponsor_internal").select("*")).data.length,
      0,
    );
    assert.equal(
      (await clients[i].from("sponsor_contacts").select("*")).data.length,
      0,
    );
    const denied = await clients[i].rpc("save_sponsor", {
      target: company,
      details: { name: "Aanval" },
    });
    assert.ok(denied.error);
  }
  assert.equal((await clients[3].from("sponsors").select("id")).data.length, 1);
  assert.equal(
    (await clients[3].from("sponsors").select("id").eq("id", b.data)).data
      .length,
    0,
  );
  assert.ok(
    (
      await clients[1]
        .from("sponsor_contacts")
        .update({ sponsor_id: b.data })
        .eq("id", contact)
    ).error,
    "parent onwijzigbaar",
  );
  assert.ok(
    (
      await clients[1].rpc("manage_sponsor_member", {
        company: b.data,
        target: users[3].id,
        contact: c.data,
        active: true,
      })
    ).error,
    "geen herlink naar ander bedrijf",
  );
  assert.ok(
    (
      await clients[1].rpc("manage_sponsor_member", {
        company,
        target: users[0].id,
        contact,
        active: true,
      })
    ).error,
    "commissie kan interne accountrol niet veranderen",
  );
  assert.ok(
    (
      await clients[1].rpc("set_user_access", {
        target: users[1].id,
        new_role: "super_admin",
        active: true,
      })
    ).error,
    "geen vrije rolverhoging",
  );
  stage = "serverrolgrenzen";
  for (const i of [2, 3]) {
    const restricted = await browser.newContext();
    const other = await restricted.newPage();
    await other.goto("http://127.0.0.1:3000/inloggen");
    await other.getByLabel("E-mailadres", { exact: true }).fill(users[i].email);
    await other.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await other.getByRole("button", { name: "Inloggen", exact: true }).click();
    await other.waitForURL("**/account");
    await other.goto(`http://127.0.0.1:3000/account/sponsors/${company}`);
    await expect(
      other.getByRole("heading", {
        name: "Deze pagina is niet beschikbaar.",
        exact: true,
      }),
    ).toBeVisible();
    assert.ok(!(await other.content()).includes("STRICT PRIVATE NOTITIE"));
    await restricted.close();
  }
  stage = "UI, mobiel en toegankelijkheid";
  await page.reload();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(a11y.violations, []);
  }
  await page.screenshot({
    path: "/tmp/vvp-phase4-crm-mobile.png",
    fullPage: true,
  });
  stage = "uitnodiging";
  const targetCard = page
    .getByRole("heading", { name: /TEST — Contact twee/ })
    .locator("..");
  await targetCard
    .getByRole("button", { name: "Sponsoraccount uitnodigen" })
    .click();
  await expect(targetCard.getByRole("status")).toContainText(
    "Sponsoruitnodiging door Supabase geaccepteerd",
  );
  const invited = (await admin.auth.admin.listUsers()).data.users.find(
    (u) => u.email === noLogin,
  );
  assert.ok(invited);
  users.push({ id: invited.id, email: noLogin, role: "sponsor" });
  assert.equal(
    (await clients[1].rpc("sponsor_members", { company })).data.filter(
      (m) => m.is_active,
    ).length,
    2,
  );
  stage = "archiveren en zoeken";
  await page
    .getByRole("button", { name: "Bedrijf archiveren", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bedrijf herstellen", exact: true }),
  ).toBeVisible();
  assert.ok(
    (
      await clients[1].rpc("manage_sponsor_member", {
        company,
        target: users[3].id,
        contact,
        active: true,
      })
    ).error,
    "geen nieuwe activatie bij archief",
  );
  await page.getByRole("link", { name: "Terug naar sponsors" }).click();
  await page.getByLabel("Zoek op bedrijfsnaam", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Toepassen" }).click();
  await expect(
    page.getByRole("heading", { name: "Geen bedrijven gevonden" }),
  ).toBeVisible();
  await page.getByLabel("Weergave", { exact: true }).selectOption("yes");
  await page.getByRole("button", { name: "Toepassen" }).click();
  await page.getByRole("link", { name, exact: true }).click();
  await page
    .getByRole("button", { name: "Bedrijf herstellen", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Bedrijf bewerken", exact: true }),
  ).toBeVisible();
  stage = "machtiging intrekken";
  await page.reload();
  const membersSection = page
    .getByRole("heading", { name: "Bedrijfsmachtigingen", exact: true })
    .locator("..");
  await expect(
    membersSection.getByText(users[3].email, { exact: false }),
  ).toBeVisible();
  await membersSection
    .getByText(users[3].email, { exact: false })
    .locator("..")
    .getByRole("button", { name: "Toegang intrekken" })
    .click();
  await expect(
    membersSection
      .getByText(users[3].email, { exact: false })
      .locator("..")
      .getByRole("status"),
  ).toHaveText("Ingetrokken");
  assert.equal((await clients[3].from("sponsors").select("id")).data.length, 0);
  console.log(
    "PASS: CRM-browserflow, prospectconversie met hetzelfde ID, contacten/primair contact, duplicaten, interne privacy, directe API-rolgrenzen, commissie-uitnodiging, meerdere gebruikers, archief/zoekfilter/herstel, intrekking, 360/1440px en axe.",
  );
} catch (error) {
  console.error(
    "FAIL CRM fase:",
    stage,
    "type:",
    error.name,
    "melding:",
    String(error.message).split("\n")[0].replaceAll(password, "[redacted]"),
    "status:",
    page ? await page.getByRole("status").allTextContents() : [],
  );
  process.exitCode = 1;
} finally {
  if (process.exitCode && page)
    await page.screenshot({
      path: "/tmp/vvp-phase4-failure.png",
      fullPage: true,
    });
  await browser?.close();
  if (clients[1]) {
    const found = await clients[1]
      .from("sponsors")
      .select("id")
      .ilike("name", `%${marker}%`);
    for (const item of found.data || [])
      if (!companies.includes(item.id)) companies.push(item.id);
  }
  const ids = users.map((u) => `'${u.id}'`).join(",");
  if (ids) {
    sql(
      `delete from private.sponsor_memberships where user_id in (${ids});delete from private.access_audit where target in (${ids}) or actor in (${ids});`,
    );
  }
  if (companies.length) {
    const list = companies.map((id) => `'${id}'`).join(",");
    sql(
      `delete from private.crm_audit where sponsor_id in (${list});delete from public.sponsor_contacts where sponsor_id in (${list});delete from public.sponsor_internal where sponsor_id in (${list});delete from public.sponsors where id in (${list});`,
    );
  }
  if (ids) sql(`delete from private.user_access where user_id in (${ids});`);
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
}
