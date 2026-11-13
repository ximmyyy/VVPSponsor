// Fase 5-integratie: uitsluitend de lokale standaardstack, eigen willekeurige
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
const objects = [];
let browser;
let page;
let stage = "fixtures";
const pdf = Buffer.from("%PDF-1.4\n% TEST — fictief bewijs\n%%EOF\n");

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

try {
  // 0 commissie, 1 bestuur, 2 sponsor A, 3 tweede sponsor A, 4 sponsor B
  for (const role of [
    "sponsorcommissie",
    "clubbestuur",
    "sponsor",
    "sponsor",
    "sponsor",
  ]) {
    const email = `test-${randomUUID()}@contract.example`;
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
    `insert into public.sponsors(id,name) values('${companies[0]}','TEST — Contract ${marker} A'),('${companies[1]}','TEST — Contract ${marker} B');` +
      `insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values('${users[2].id}','${companies[0]}',true),('${users[3].id}','${companies[0]}',true),('${users[4].id}','${companies[1]}',true);`,
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

  stage = "pakket en versie";
  await page.getByRole("link", { name: "Sponsorpakketten" }).click();
  await page
    .getByRole("button", { name: "Pakket opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Vul de pakketnaam in.", { exact: true }),
  ).toBeVisible();
  const packageName = `TEST — Pakket ${marker}`;
  await page.getByLabel("Pakketnaam *", { exact: true }).fill(packageName);
  await page
    .getByRole("button", { name: "Pakket opslaan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: packageName, exact: true }),
  ).toBeVisible();
  await page.getByLabel("Richtprijs (EUR)", { exact: true }).fill("1000,00");
  for (const [i, [d, q, u]] of [
    ["TEST — Bordreclame", "1", "bord"],
    ["TEST — Social post", "4", "post"],
  ].entries()) {
    await page
      .getByRole("button", { name: "Recht toevoegen", exact: true })
      .click();
    await page.getByLabel(`Recht ${i + 1}`, { exact: true }).fill(d);
    await page.getByLabel("Aantal", { exact: true }).nth(i).fill(q);
    await page.getByLabel("Eenheid", { exact: true }).nth(i).fill(u);
  }
  await page
    .getByRole("button", { name: "Nieuwe conceptversie maken" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Concept$/ }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Versie publiceren en vergrendelen" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Gepubliceerd$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Gepubliceerd", { exact: true }).first(),
  ).toBeVisible();
  const version = (
    await clients[0]
      .from("package_versions")
      .select("id,package_id,status,sponsorship_packages!inner(name)")
      .eq("sponsorship_packages.name", packageName)
  ).data[0];
  assert.equal(version.status, "published");
  assert.equal(
    (
      await clients[0]
        .from("package_versions")
        .update({ list_price: 1 })
        .eq("id", version.id)
    ).error?.code,
    "42501",
    "gepubliceerde versie niet direct muteerbaar",
  );

  stage = "conceptcontract";
  await page.goto(`${app}/account/contracten/nieuw?sponsor=${companies[0]}`);
  await page
    .getByLabel("Contracttitel *", { exact: true })
    .fill(`TEST — Seizoen ${marker}`);
  await page.getByLabel("Begindatum *", { exact: true }).fill("2026-07-01");
  await page.getByLabel("Einddatum *", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Conceptcontract maken" }).click();
  await expect(
    page.getByText("Einddatum ligt vóór de begindatum.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Einddatum *", { exact: true }).fill("2027-06-30");
  await page
    .getByLabel("Uiterste opzegdatum", { exact: true })
    .fill("2027-03-31");
  await page.getByRole("button", { name: "Conceptcontract maken" }).click();
  await page.waitForURL(/\/account\/contracten\/[0-9a-f-]{36}$/);
  const contract = new URL(page.url()).pathname.split("/").pop();
  await page
    .locator("summary", { hasText: "Regel uit pakketversie toevoegen" })
    .click();
  await page
    .getByLabel("Gepubliceerde pakketversie *")
    .selectOption(version.id);
  await page.getByRole("button", { name: "Pakketregel toevoegen" }).click();
  await expect(statusText("Pakketregel toegevoegd")).toBeVisible();
  await page.locator("summary", { hasText: "Maatwerkregel toevoegen" }).click();
  const customForm = page
    .getByRole("button", { name: "Maatwerkregel toevoegen" })
    .locator("xpath=ancestor::form");
  await customForm
    .getByLabel("Titel *", { exact: true })
    .fill("TEST — Maatwerk");
  await customForm
    .getByLabel("Prijs per stuk (EUR) *", { exact: true })
    .fill("250");
  await page.getByRole("button", { name: "Maatwerkregel toevoegen" }).click();
  await expect(statusText("Maatwerkregel toegevoegd.")).toBeVisible();
  assert.equal(
    (await clients[2].from("contracts").select("id")).data.length,
    0,
    "sponsor ziet geen concept",
  );

  stage = "bevestigen";
  await page.reload();
  await page
    .getByRole("button", { name: "Contract bevestigen", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Bevestigd · / }),
  ).toBeVisible();
  const totals = await clients[0]
    .from("contract_totals")
    .select("*")
    .eq("contract_id", contract)
    .single();
  assert.equal(Number(totals.data.current_total), 1250);
  const rights = await clients[0]
    .from("contract_rights")
    .select("id,description")
    .eq("contract_id", contract);
  assert.equal(rights.data.length, 2, "rechten uit versie gekopieerd");

  stage = "nieuwe pakketversie raakt contract niet";
  const v2 = await clients[0].rpc("save_package_version", {
    target: null,
    package: version.package_id,
    details: {
      list_price: "1500.00",
      rights: [{ description: "TEST — v2", quantity: "1", unit: "stuk" }],
    },
  });
  assert.equal(v2.error, null);
  assert.equal(
    (await clients[0].rpc("publish_package_version", { target: v2.data }))
      .error,
    null,
  );
  const after = await clients[0]
    .from("contract_lines")
    .select("unit_price,package_version_id")
    .eq("contract_id", contract)
    .not("package_version_id", "is", null)
    .single();
  assert.equal(Number(after.data.unit_price), 1000);
  assert.equal(after.data.package_version_id, version.id);
  assert.equal(
    (
      await clients[0]
        .from("contract_rights")
        .select("id")
        .eq("contract_id", contract)
    ).data.length,
    2,
  );

  stage = "uitvoering en bewijs";
  await page.reload();
  await page
    .locator("summary", { hasText: "Uitvoering registreren" })
    .first()
    .click();
  const fulfilForm = page
    .getByRole("button", { name: "Uitvoering opslaan" })
    .first()
    .locator("xpath=ancestor::form");
  await fulfilForm
    .getByLabel("Omschrijving (gedeeld bewijs) *", { exact: true })
    .fill("TEST — Bord geplaatst");
  await fulfilForm.getByLabel("Delen met de sponsor", { exact: true }).check();
  await fulfilForm.getByRole("button", { name: "Uitvoering opslaan" }).click();
  await expect(statusText("Uitvoering geregistreerd.")).toBeVisible();
  await page.reload();
  await page
    .locator("summary", { hasText: "Bewijsstuk toevoegen" })
    .first()
    .click();
  const evidenceForm = page
    .getByRole("button", { name: "Bewijs uploaden" })
    .first()
    .locator("xpath=ancestor::form");
  await evidenceForm
    .getByLabel("Titel *", { exact: true })
    .fill("TEST — Bewijs-PDF");
  await evidenceForm.getByLabel(/Bestand/).setInputFiles({
    name: "bewijs.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await evidenceForm
    .getByLabel("Delen met de sponsor", { exact: true })
    .check();
  await evidenceForm.getByRole("button", { name: "Bewijs uploaden" }).click();
  await expect(
    statusText("Document opgeslagen en gecontroleerd; gedeeld met de sponsor."),
  ).toBeVisible();

  stage = "geweigerde upload";
  await page.locator("summary", { hasText: "Document uploaden" }).click();
  const docForm = page
    .getByRole("button", { name: "Document uploaden" })
    .locator("xpath=ancestor::form");
  await docForm.getByLabel("Titel *", { exact: true }).fill("TEST — Vervalst");
  await docForm.getByLabel(/Bestand/).setInputFiles({
    name: "x.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("<svg onload=alert(1)>"),
  });
  await docForm.getByRole("button", { name: "Document uploaden" }).click();
  await expect(
    statusText("Alleen echte PDF-, PNG- of JPEG-bestanden zijn toegestaan."),
  ).toBeVisible();
  const docs = await clients[0]
    .from("documents")
    .select("id,object_path,upload_status,title")
    .eq("sponsor_id", companies[0]);
  assert.equal(docs.data.length, 1, "geweigerd bestand maakt geen record");
  assert.equal(docs.data[0].upload_status, "available");
  const evidence = docs.data[0];
  objects.push(evidence.object_path);

  stage = "amendement";
  await page.reload();
  await page.locator("summary", { hasText: "Amendement vastleggen" }).click();
  const amendForm = page
    .getByRole("button", { name: "Amendement vastleggen" })
    .locator("xpath=ancestor::form");
  await amendForm
    .getByLabel("Reden *", { exact: true })
    .fill("TEST — Korting na overleg");
  await amendForm.getByLabel("Titel", { exact: true }).fill("TEST — Korting");
  await amendForm
    .getByLabel("Prijs per stuk (EUR, negatief voor korting)")
    .fill("-100");
  await amendForm
    .getByRole("button", { name: "Amendement vastleggen" })
    .click();
  await expect(statusText("Amendement vastgelegd.")).toBeVisible();
  const t2 = await clients[0]
    .from("contract_totals")
    .select("*")
    .eq("contract_id", contract)
    .single();
  assert.equal(
    Number(t2.data.baseline_total),
    1250,
    "baseline reconstrueerbaar",
  );
  assert.equal(Number(t2.data.current_total), 1150);
  await page.reload();
  await expect(
    page.getByText("Amendement 1 · ingang", { exact: false }),
  ).toBeVisible();
  await checkResponsive();

  if (process.env.VVP_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.VVP_SCREENSHOT_DIR}/contract-1440.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({
      path: `${process.env.VVP_SCREENSHOT_DIR}/contract-360.png`,
      fullPage: false,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  stage = "sponsorisolatie via Data API";
  assert.equal(
    (await clients[2].from("contracts").select("id")).data.length,
    1,
    "sponsor A ziet bevestigd contract",
  );
  assert.equal(
    (await clients[3].from("contracts").select("id")).data.length,
    1,
    "tweede gemachtigde idem",
  );
  assert.equal(
    (await clients[2].from("contract_lines").select("id")).data.length,
    3,
  );
  assert.equal(
    (await clients[2].from("right_fulfillments").select("id")).data.length,
    1,
  );
  assert.equal(
    (await clients[2].from("documents").select("id")).data.length,
    1,
  );
  assert.equal(
    (await clients[2].from("sponsorship_packages").select("id")).data.length,
    0,
  );
  assert.equal(
    (await clients[2].rpc("confirm_contract", { target: contract })).error
      ?.code,
    "42501",
  );
  for (const table of [
    "contracts",
    "contract_lines",
    "contract_rights",
    "right_fulfillments",
    "documents",
    "contract_totals",
  ])
    assert.equal(
      (await clients[4].from(table).select("*")).data.length,
      0,
      `sponsor B: ${table}`,
    );
  assert.equal(
    (await clients[1].from("contracts").select("id")).data.length,
    0,
    "bestuur ziet nog geen contracten",
  );
  assert.equal(
    (await make().from("contracts").select("id")).error?.code,
    "42501",
    "anon geweigerd",
  );

  stage = "downloads en intrekking";
  const sponsorA = await browser.newContext();
  const pageA = await login(sponsorA, users[2].email);
  const download = await sponsorA.request.get(
    `${app}/account/documenten/${evidence.id}`,
    { maxRedirects: 0 },
  );
  assert.equal(download.status(), 307);
  assert.match(
    download.headers().location,
    /\/storage\/v1\/object\/sign\/private-documents\//,
  );
  assert.equal(download.headers()["cache-control"], "private, no-store");
  const file = await sponsorA.request.get(download.headers().location);
  assert.equal(Buffer.from(await file.body()).toString(), pdf.toString());
  await pageA.goto(`${app}/account/contracten/${contract}`);
  await expect(
    pageA.getByRole("heading", { name: "Deze pagina is niet beschikbaar." }),
  ).toBeVisible();
  const html = await pageA.content();
  assert.ok(
    !html.includes(marker) && !html.includes("TEST — Maatwerk"),
    "sponsor krijgt geen intern contractdossier",
  );
  const sponsorB = await browser.newContext();
  await login(sponsorB, users[4].email);
  assert.equal(
    (
      await sponsorB.request.get(`${app}/account/documenten/${evidence.id}`, {
        maxRedirects: 0,
      })
    ).status(),
    404,
  );
  assert.equal(
    (
      await clients[0]
        .from("documents")
        .update({ sponsor_shared: false })
        .eq("id", evidence.id)
        .select("id")
        .single()
    ).error,
    null,
  );
  assert.equal(
    (
      await sponsorA.request.get(`${app}/account/documenten/${evidence.id}`, {
        maxRedirects: 0,
      })
    ).status(),
    404,
    "intrekking direct effectief",
  );

  stage = "verlengen en beëindigen";
  await page
    .getByRole("textbox", { name: "Begindatum *" })
    .last()
    .fill("2027-07-01");
  await page
    .getByRole("textbox", { name: "Einddatum *" })
    .last()
    .fill("2028-06-30");
  await page.getByRole("button", { name: "Verlengingsconcept maken" }).click();
  await page.waitForURL(
    (url) =>
      !url.pathname.endsWith(contract) &&
      /\/account\/contracten\/[0-9a-f-]{36}$/.test(url.pathname),
  );
  await expect(
    page.getByText("Verlenging van", { exact: false }),
  ).toBeVisible();
  const renewal = new URL(page.url()).pathname.split("/").pop();
  const copied = await clients[0]
    .from("contract_lines")
    .select("unit_price")
    .eq("contract_id", renewal);
  assert.deepEqual(
    copied.data.map((l) => Number(l.unit_price)).sort(),
    [1000, 250].sort(),
    "alleen positieve regels gekopieerd",
  );
  await page.goto(`${app}/account/contracten/${contract}`);
  await page.getByLabel("Beëindigd per *", { exact: true }).fill("2027-01-31");
  await page
    .getByLabel("Reden *", { exact: true })
    .last()
    .fill("TEST — Beëindigd");
  await page.getByRole("button", { name: "Contract beëindigen" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Beëindigd$/ }),
  ).toBeVisible();
  assert.equal(
    (
      await clients[2]
        .from("contracts")
        .select("status")
        .eq("id", contract)
        .single()
    ).data.status,
    "terminated",
  );

  stage = "overzichten";
  await page.goto(`${app}/account/sponsorrechten`);
  await expect(
    page.getByRole("heading", { name: "Openstaande sponsorrechten" }),
  ).toBeVisible();
  await page.goto(`${app}/account/contracten?sponsor=${companies[0]}`);
  await expect(
    page.getByText("2 contracten gevonden", { exact: true }),
  ).toBeVisible();
  await checkResponsive();

  console.log(
    "PASS: pakketversies/publicatie, conceptcontract met validatie, pakket- en maatwerkregels, atomair bevestigen, onveranderde oude afspraken na nieuwe versie, uitvoering met gedeeld bewijs, uploadinhoudscontrole, amendement met reconstrueerbare baseline, sponsor A/B/bestuur/anon-isolatie, downloadautorisatie en directe intrekking, verlenging, beëindiging, 360/1440px en axe.",
  );
} catch (error) {
  console.error(
    "FAIL contractfase:",
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
      .screenshot({ path: "/tmp/vvp-phase5-failure.png", fullPage: true })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (objects.length)
    await admin.storage.from("private-documents").remove(objects);
  const ids = users.map((u) => `'${u.id}'`).join(",") || "null";
  const list = companies.map((id) => `'${id}'`).join(",");
  // Alleen eigen fixtures. Triggers bewaken historie; uitsluitend voor deze lokale
  // opruimsessie uitgeschakeld via session_replication_role (geen schemawijziging).
  sql(
    `set session_replication_role=replica;` +
      `delete from storage.objects where bucket_id='private-documents' and name like any(array[${companies.map((c) => `'${c}/%'`).join(",")}]);` +
      `delete from public.fulfillment_evidence where sponsor_id in (${list});delete from public.contract_documents where sponsor_id in (${list});` +
      `delete from public.documents where sponsor_id in (${list});delete from public.right_fulfillments where sponsor_id in (${list});` +
      `delete from public.contract_rights where sponsor_id in (${list});delete from public.contract_lines where sponsor_id in (${list});` +
      `delete from public.contract_amendments where sponsor_id in (${list});delete from public.contracts where sponsor_id in (${list});` +
      `delete from public.package_right_templates where package_version_id in (select v.id from public.package_versions v join public.sponsorship_packages p on p.id=v.package_id where p.name like '%${marker}%');` +
      `delete from public.package_versions where package_id in (select id from public.sponsorship_packages where name like '%${marker}%');` +
      `delete from public.sponsorship_packages where name like '%${marker}%';` +
      `delete from private.contract_audit where sponsor_id in (${list}) or actor in (${ids});delete from private.crm_audit where sponsor_id in (${list}) or actor in (${ids});` +
      `delete from private.sponsor_memberships where user_id in (${ids});delete from private.access_audit where target in (${ids}) or actor in (${ids});` +
      `delete from public.sponsor_internal where sponsor_id in (${list});delete from public.sponsors where id in (${list});` +
      `delete from private.user_access where user_id in (${ids});`,
  );
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
}
