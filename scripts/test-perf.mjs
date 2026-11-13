// Performancemeting op een productiebuild (`npm run build && npm start`) tegen de lokale stack.
// Vult tijdelijk fictieve PERF-volumedata (lokaal, eigen marker), meet serverresponstijd
// (TTFB) en laadtijd per pagina en de rapportfunctie, en ruimt alles op. Geen reset.
import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

const status = JSON.parse(
  execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:54321");
const app = process.env.PERF_APP_URL || "http://127.0.0.1:3000";
const admin = createClient(status.API_URL, status.SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = (s) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_VVPSponsor",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tA",
    ],
    {
      input: s,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    },
  ).trim();
const password = randomBytes(24).toString("base64url");
const marker = `PERF-${randomUUID().slice(0, 8)}`;
const SPONSORS = Number(process.env.PERF_SPONSORS || 400);
const RUNS = Number(process.env.PERF_RUNS || 7);
const users = [];
let browser;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function cleanup() {
  const ids =
    sql(
      `select coalesce(string_agg(quote_literal(id::text),','),'null') from auth.users where email like 'perf-%@perf.example'`,
    ) || "null";
  sql(`
set session_replication_role=replica;
create temp table gone as select id from public.sponsors where name like 'PERF-%';
delete from public.payment_allocations where sponsor_id in (select id from gone);
delete from public.payments where sponsor_id in (select id from gone);
delete from public.invoice_lines where sponsor_id in (select id from gone);
delete from public.invoices where sponsor_id in (select id from gone);
delete from public.contract_rights where sponsor_id in (select id from gone);
delete from public.contract_lines where sponsor_id in (select id from gone);
delete from public.contracts where sponsor_id in (select id from gone);
delete from private.finance_audit where sponsor_id in (select id from gone) or actor::text in (${ids});
delete from private.contract_audit where sponsor_id in (select id from gone) or actor::text in (${ids});
delete from private.crm_audit where sponsor_id in (select id from gone) or actor::text in (${ids});
delete from private.report_exports where actor::text in (${ids});
delete from private.sponsor_memberships where user_id::text in (${ids});
delete from private.access_audit where target::text in (${ids}) or actor::text in (${ids});
delete from public.sponsor_internal where sponsor_id in (select id from gone);
delete from public.sponsors where id in (select id from gone);
delete from private.user_access where user_id::text in (${ids});
`);
  const left = (
    await admin.auth.admin.listUsers({ perPage: 1000 })
  ).data.users.filter((u) => u.email?.endsWith("@perf.example"));
  for (const u of left) await admin.auth.admin.deleteUser(u.id);
}
if (process.argv.includes("--cleanup-only")) {
  await cleanup();
  console.log("PERF-fixtures opgeruimd.");
  process.exit(0);
}

try {
  for (const role of ["sponsorcommissie", "sponsor", "clubbestuur"]) {
    const email = `perf-${randomUUID()}@perf.example`;
    const r = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(r.error, null);
    users.push({ id: r.data.user.id, email, role });
    sql(
      `insert into private.user_access(user_id,role,is_active) values('${r.data.user.id}','${role}',true);`,
    );
  }
  const t0 = Date.now();
  // Fictieve volumedata: per sponsor twee contracten (vorig/huidig seizoen), vijf facturen, ~vier betalingen.
  sql(`
set session_replication_role=replica;
create temp table s as select gen_random_uuid() id, i from generate_series(1,${SPONSORS}) i;
insert into public.sponsors(id,name,city) select id,'${marker} Sponsor '||lpad(i::text,4,'0'),'Rotterdam' from s;
insert into public.sponsor_internal(sponsor_id,status,is_paying) select id,case when i%4=0 then 'prospect' else 'active' end,i%4<>0 from s;
create temp table c as select gen_random_uuid() id, s.id sponsor_id, s.i, k from s, generate_series(0,1) k;
insert into public.contracts(id,sponsor_id,contract_number,title,status,starts_on,ends_on,party_snapshot,confirmed_at)
 select id,sponsor_id,'SC-1999-'||lpad((i*2+k)::text,5,'0'),'${marker}','confirmed',make_date(2025+k,7,1)+(i%30),make_date(2026+k,6,30),'{}'::jsonb,now() from c;
insert into public.contract_lines(contract_id,sponsor_id,title,quantity,unit_price) select id,sponsor_id,'${marker} regel',1,1000+(i%50)*100 from c;
insert into public.contract_lines(contract_id,sponsor_id,title,quantity,unit_price) select id,sponsor_id,'${marker} extra',2,250 from c;
insert into public.contract_rights(contract_id,sponsor_id,description,quantity,unit,deadline,status)
 select id,sponsor_id,'${marker} recht '||r,1,'stuk',make_date(2026,1,1)+(i%300),case when r=1 then 'fulfilled' else 'open' end from c, generate_series(1,3) r;
create temp table inv as select gen_random_uuid() id, s.id sponsor_id, s.i, n from s, generate_series(1,5) n;
insert into public.invoices(id,sponsor_id,status,invoice_number,issue_date,due_on,billing_snapshot,issued_at)
 select id,sponsor_id,'issued','F-1999-'||lpad((i*5+n)::text,6,'0'),make_date(2025,7,1)+((i*7+n*31)%480),make_date(2025,7,1)+((i*7+n*31)%480)+30,'{}'::jsonb,now() from inv;
insert into public.invoice_lines(invoice_id,sponsor_id,description,quantity,unit_price) select id,sponsor_id,'${marker}',1,605 from inv;
create temp table pay as select gen_random_uuid() id, inv.id invoice_id, inv.sponsor_id, inv.i, inv.n from inv where n<5;
insert into public.payments(id,sponsor_id,received_on,amount,method,reference) select id,sponsor_id,make_date(2025,7,1)+((i*7+n*31)%480)+10,605,'bank','${marker}' from pay;
insert into public.payment_allocations(payment_id,invoice_id,sponsor_id,amount) select id,invoice_id,sponsor_id,605 from pay;
analyze;
`);
  const seedMs = Date.now() - t0;
  const company = sql(
    `select id from public.sponsors where name='${marker} Sponsor 0001'`,
  );
  sql(
    `insert into private.sponsor_memberships(user_id,sponsor_id,is_active) values('${users[1].id}','${company}',true);`,
  );

  // Databasefunctie: rapportage als commissie, met de echte rol en RLS-context.
  const timeSql = (claims, statement) =>
    sql(`begin; set local role authenticated; select set_config('request.jwt.claims','${JSON.stringify(claims)}',true);
explain (analyze, format json) ${statement}; rollback;`);
  const exec = (claims, statement) =>
    median(
      Array.from(
        { length: 5 },
        () =>
          ((out) =>
            JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1)))(
            timeSql(claims, statement),
          )[0]["Execution Time"],
      ),
    );
  const commission = { sub: users[0].id, role: "authenticated" };
  const sponsorClaims = { sub: users[1].id, role: "authenticated" };
  const db = {
    report_dashboard: exec(
      commission,
      "select public.report_dashboard(2025,false)",
    ),
    report_export: exec(
      commission,
      "select public.report_dashboard(2025,true)",
    ),
    invoice_balances_page: exec(
      commission,
      "select * from public.invoice_balances order by issue_date desc limit 25",
    ),
    sponsors_list: exec(
      commission,
      "select s.id,s.name from public.sponsors s join public.sponsor_internal i on i.sponsor_id=s.id where s.archived_at is null order by s.name limit 25",
    ),
    sponsor_contracts: exec(sponsorClaims, "select * from public.contracts"),
    sponsor_invoices: exec(
      sponsorClaims,
      "select * from public.invoice_balances",
    ),
  };

  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  });
  async function measure(email, paths) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${app}/inloggen`);
    await page.getByLabel("E-mailadres", { exact: true }).fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Inloggen", exact: true }).click();
    await page.waitForURL("**/account");
    const out = {};
    for (const path of paths) {
      await page.goto(`${app}${path}`, { waitUntil: "load" }); // opwarmen
      const ttfb = [];
      const load = [];
      for (let i = 0; i < RUNS; i++) {
        await page.goto(`${app}${path}`, { waitUntil: "load" });
        const t = await page.evaluate(() => {
          const n = performance.getEntriesByType("navigation")[0];
          return {
            ttfb: n.responseStart - n.requestStart,
            load: n.loadEventEnd - n.startTime,
          };
        });
        ttfb.push(t.ttfb);
        load.push(t.load);
      }
      out[path] = {
        ttfb: Math.round(median(ttfb)),
        load: Math.round(median(load)),
      };
    }
    await context.close();
    return out;
  }
  const internal = await measure(users[0].email, [
    "/account",
    "/account/sponsors",
    "/account/contracten",
    "/account/financien",
    "/account/dashboard?seizoen=2025",
    "/account/sponsorrechten",
  ]);
  const portal = await measure(users[1].email, [
    "/account/portaal",
    "/account/portaal/samenwerking",
    "/account/portaal/facturen",
  ]);
  const board = await measure(users[2].email, [
    "/account/dashboard?seizoen=2025",
  ]);
  const report = {
    volume: {
      sponsors: SPONSORS,
      contracts: SPONSORS * 2,
      invoices: SPONSORS * 5,
      payments: SPONSORS * 4,
      seedMs,
    },
    databaseMs: Object.fromEntries(
      Object.entries(db).map(([k, v]) => [k, Math.round(v * 10) / 10]),
    ),
    pagesMs: {
      ...internal,
      ...portal,
      "/account/dashboard (bestuur)": board["/account/dashboard?seizoen=2025"],
    },
  };
  console.log(JSON.stringify(report, null, 2));
  const budget = Number(process.env.PERF_TTFB_BUDGET || 0);
  if (budget) {
    const slow = Object.entries(report.pagesMs).filter(
      ([, v]) => v.ttfb > budget,
    );
    assert.deepEqual(slow, [], `TTFB boven ${budget} ms`);
    console.log(
      `PASS: alle gemeten pagina's TTFB ≤ ${budget} ms bij ${SPONSORS} sponsors.`,
    );
  }
} catch (error) {
  console.error(
    "FAIL performance:",
    String(error.message)
      .split("\n")
      .slice(0, 4)
      .join(" ")
      .replaceAll(password, "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (process.env.PERF_KEEP)
    console.log(
      `PERF_KEEP: data blijft staan; ruim op met --cleanup-only. Commissie ${users[0]?.id}, sponsor ${users[1]?.id}`,
    );
  else await cleanup();
}
