// Geïsoleerde lokale integratietest. Alleen eigen UUID-fixtures opruimen, geen reset.
import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";
function totp(secret) {
  let bits = "";
  for (const letter of secret.toUpperCase().replace(/=+$/, ""))
    bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      .indexOf(letter)
      .toString(2)
      .padStart(5, "0");
  const key = Buffer.from(
    (bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)),
  );
  const time = Buffer.alloc(8);
  time.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(time).digest(),
    off = h[19] & 15;
  return ((h.readUInt32BE(off) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
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
const companies = [randomUUID(), randomUUID()],
  docIds = [randomUUID(), randomUUID()];
const users = [],
  clients = [],
  paths = docIds.map((d, i) => `${companies[i]}/${d}`);
const password = randomBytes(24).toString("base64url");
let browser, page;
let stage = "fixtures en API";
try {
  for (const role of [
    "super_admin",
    "sponsorcommissie",
    "clubbestuur",
    "sponsor",
    "sponsor",
    "sponsor",
  ]) {
    const email = `test-${randomUUID()}@auth.example`;
    const result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(result.error, null, "lokaal Auth-account aanmaken");
    users.push({ id: result.data.user.id, email, role });
  }
  sql(
    companies
      .map(
        (id, i) =>
          `insert into public.sponsors(id,name) values('${id}','TEST — API Bedrijf ${i}');`,
      )
      .join(""),
  );
  for (const [i, u] of users.entries()) {
    sql(
      `insert into private.user_access(user_id,role,is_active) values('${u.id}','${u.role}',${i !== 5});`,
    );
    if (i >= 3)
      sql(
        `insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values('${u.id}','${companies[i === 3 ? 0 : 1]}',true);`,
      );
    const client = make();
    const result = await client.auth.signInWithPassword({
      email: u.email,
      password,
    });
    assert.equal(result.error, null, "password login");
    clients.push(client);
  }
  for (let i = 0; i < 2; i++) {
    const result = await clients[1].from("documents").insert({
      id: docIds[i],
      sponsor_id: companies[i],
      object_path: paths[i],
      title: "TEST — Bewijs",
      sponsor_shared: true,
    });
    assert.equal(result.error, null, "interne documentmetadata");
    const upload = await clients[1].storage
      .from("private-documents")
      .upload(
        paths[i],
        new Blob(["%PDF-1.4\nTEST"], { type: "application/pdf" }),
      );
    assert.equal(upload.error, null, "interne upload");
    // Fase 5: nieuwe documenten zijn pas na servercontrole beschikbaar.
    assert.equal(
      (await clients[1].rpc("finalize_document", { target: docIds[i] })).error,
      null,
      "documentcontrole",
    );
  }
  for (let i = 0; i < clients.length; i++) {
    const result = await clients[i].from("sponsors").select("id");
    assert.equal(result.error, null);
    assert.equal(result.data.length, [2, 2, 2, 1, 1, 0][i]);
    const docs = await clients[i].from("documents").select("id");
    assert.equal(docs.error, null);
    assert.equal(docs.data.length, [2, 2, 0, 1, 1, 0][i]);
    if (i !== 0) {
      const denied = await clients[i].rpc("set_user_access", {
        target: users[i].id,
        new_role: "super_admin",
        active: true,
      });
      assert.ok(denied.error, "zelfmachtiging geweigerd");
    }
  }
  assert.equal(
    (await clients[3].storage.from("private-documents").download(paths[0]))
      .error,
    null,
  );
  assert.ok(
    (await clients[3].storage.from("private-documents").download(paths[1]))
      .error,
    "ander bedrijf geen download",
  );
  assert.ok(
    (
      await clients[3].storage
        .from("private-documents")
        .upload(
          `${companies[0]}/${randomUUID()}`,
          new Blob(["TEST"], { type: "application/pdf" }),
        )
    ).error,
    "sponsor geen upload",
  );
  assert.ok(
    (await make().storage.from("private-documents").download(paths[0])).error,
    "anon geen download",
  );
  const shared = await clients[3].storage
    .from("private-documents")
    .createSignedUrl(paths[0], 60);
  assert.equal(shared.error, null);
  sql(
    `update private.sponsor_memberships set is_active=false where user_id='${users[3].id}';`,
  );
  assert.equal(
    (await clients[3].from("documents").select("id")).data.length,
    0,
  );
  assert.ok(
    (
      await clients[3].storage
        .from("private-documents")
        .createSignedUrl(paths[0], 60)
    ).error,
    "intrekking blokkeert nieuwe URL",
  );
  // Een reeds uitgegeven URL blijft maximaal zijn korte TTL geldig.
  sql(
    `update private.sponsor_memberships set is_active=true where user_id='${users[3].id}';`,
  );
  stage = "browserlogin";
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  });
  page = await browser.newPage();
  await page.goto("http://127.0.0.1:3000/inloggen");
  await page.getByLabel("E-mailadres", { exact: true }).fill(users[3].email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
  await page.waitForURL("**/account");
  await expect(page.getByRole("main")).toContainText("TEST — API Bedrijf 0");
  await page.reload();
  await expect(page.getByRole("main")).toContainText("TEST — API Bedrijf 0");
  const ownDownload = await page.request.get(
    `http://127.0.0.1:3000/account/documenten/${docIds[0]}`,
    { maxRedirects: 0 },
  );
  assert.equal(ownDownload.status(), 307);
  assert.equal(
    (
      await page.request.get(
        `http://127.0.0.1:3000/account/documenten/${docIds[1]}`,
        { maxRedirects: 0 },
      )
    ).status(),
    404,
  );
  sql(
    `update private.sponsor_memberships set is_active=false where user_id='${users[3].id}';`,
  );
  await page.reload();
  await page.waitForURL("**/geen-toegang");
  await page.getByRole("button", { name: "Uitloggen" }).click();
  await page.waitForURL("**/inloggen");
  sql(
    `update private.sponsor_memberships set is_active=true where user_id='${users[3].id}';`,
  );
  stage = "recovery";
  const recovery = await admin.auth.admin.generateLink({
    type: "recovery",
    email: users[3].email,
  });
  assert.equal(recovery.error, null);
  const url = `http://127.0.0.1:3000/auth/bevestigen?type=recovery&token_hash=${recovery.data.properties.hashed_token}`;
  await page.goto(url);
  await page.waitForURL("**/wachtwoord");
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password + "A");
  await page.getByLabel("Herhaal wachtwoord").fill(password + "A");
  await page.getByRole("button", { name: "Wachtwoord opslaan" }).click();
  await page.waitForURL("**/account", { timeout: 10000 }).catch(async () => {
    throw new Error(
      "Wachtwoordstatus: " +
        (await page.getByRole("status").allTextContents()).join(";"),
    );
  });
  await page.goto(url);
  await page.waitForURL("**/herstellen");
  console.log("PASS: recovery, nieuw wachtwoord en eenmalige tokenconsumptie.");
  await page.goto("http://127.0.0.1:3000/inloggen");
  await page.getByLabel("E-mailadres", { exact: true }).fill(users[0].email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
  await page.waitForURL("**/account");
  await page.getByRole("link", { name: "Gebruiker uitnodigen" }).click();
  stage = "uitnodiging";
  const inviteEmail = `test-invite-${randomUUID()}@auth.example`;
  stage = "uitnodiging email";
  await page.getByLabel("E-mailadres", { exact: true }).fill(inviteEmail);
  stage = "uitnodiging bedrijf";
  await page
    .getByLabel("Bedrijf (alleen bij Sponsor)", { exact: true })
    .selectOption(companies[0]);
  await page.getByRole("button", { name: "Uitnodiging versturen" }).click();
  stage = "uitnodiging opslaan";
  await expect(
    page.getByRole("status").filter({ hasText: "Supabase heeft" }),
  ).toBeVisible();
  stage = "uitnodiging mail";
  const listed = await admin.auth.admin.listUsers();
  const invited = listed.data.users.find((u) => u.email === inviteEmail);
  assert.ok(invited);
  users.push({ id: invited.id, email: inviteEmail });
  const inbox = await (
    await fetch("http://127.0.0.1:54324/api/v1/messages")
  ).json();
  const mail = inbox.messages.find((m) =>
    m.To.some((to) => to.Address === inviteEmail),
  );
  assert.ok(mail, "uitnodiging in lokale mailserver");
  const message = await (
    await fetch(`http://127.0.0.1:54324/api/v1/message/${mail.ID}`)
  ).json();
  const link = message.HTML.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
  stage = "uitnodiging activatie";
  assert.equal(
    new URL(link).pathname,
    "/auth/bevestigen",
    "juiste eenmalige uitnodigingstemplate",
  );
  await page.goto(link);
  await page.waitForURL("**/wachtwoord");
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password + "B");
  await page.getByLabel("Herhaal wachtwoord").fill(password + "B");
  await page.getByRole("button", { name: "Wachtwoord opslaan" }).click();
  await page.waitForURL("**/account", { timeout: 10000 }).catch(async () => {
    throw new Error(
      "Wachtwoordstatus: " +
        (await page.getByRole("status").allTextContents()).join(";"),
    );
  });
  await expect(page.getByRole("main")).toContainText("TEST — API Bedrijf 0");
  stage = "MFA";
  await page.getByRole("link", { name: "Extra accountbeveiliging" }).click();
  await page
    .getByRole("button", { name: "Authenticator instellen", exact: true })
    .click();
  await expect(page.locator("code")).toBeVisible();
  const secret = await page.locator("code").innerText();
  await page.getByLabel("Authenticatorcode").fill(totp(secret));
  await page.getByRole("button", { name: "Authenticator bevestigen" }).click();
  await page.waitForURL("**/account");
  await page.getByRole("button", { name: "Uitloggen" }).click();
  await page.waitForURL("**/inloggen");
  await page.getByLabel("E-mailadres", { exact: true }).fill(inviteEmail);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password + "B");
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
  await page.waitForURL("**/mfa");
  const weak = make();
  assert.equal(
    (
      await weak.auth.signInWithPassword({
        email: inviteEmail,
        password: password + "B",
      })
    ).error,
    null,
  );
  assert.equal(
    (await weak.from("documents").select("id")).data.length,
    0,
    "aal1 kan MFA niet omzeilen via Data API",
  );
  await page.getByLabel("Authenticatorcode").fill(totp(secret));
  await page.getByRole("button", { name: "Code controleren" }).click();
  await page.waitForURL("**/account");
  await expect(page.getByRole("main")).toContainText("TEST — API Bedrijf 0");
  assert.equal(
    (await weak.from("documents").select("id")).data.length,
    0,
    "oude aal1 blijft geblokkeerd",
  );
  console.log(
    "PASS: gecontroleerde adminuitnodiging, lokale mail, activatie en optionele MFA-enrollment/challenge.",
  );

  console.log(
    "PASS: zes Auth-sessies, vier rollen, bedrijfsscope, privileges, private uploads/downloads, intrekking, signed URL en browserlogin/herladen/blokkade/logout.",
  );
} catch (error) {
  console.error(
    "FAIL fase:",
    stage,
    "type:",
    error.name,
    "pad:",
    page ? new URL(page.url()).pathname : "n/a",
    "status:",
    page ? await page.getByRole("status").allTextContents() : [],
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const path of paths)
    await admin.storage.from("private-documents").remove([path]);
  const ids = users.map((u) => `'${u.id}'`).join(",");
  if (ids)
    sql(
      `delete from public.documents where sponsor_id in ('${companies.join("','")}');delete from private.access_audit where target in (${ids}) or actor in (${ids});delete from private.sponsor_memberships where user_id in (${ids});delete from private.user_access where user_id in (${ids});delete from private.crm_audit where sponsor_id in ('${companies.join("','")}');delete from private.contract_audit where sponsor_id in ('${companies.join("','")}') or actor in (${ids});delete from public.sponsor_internal where sponsor_id in ('${companies.join("','")}');delete from public.sponsors where id in ('${companies.join("','")}');`,
    );
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
}
