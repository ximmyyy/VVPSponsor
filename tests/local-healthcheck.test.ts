import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Kleine Node-tool zonder TS-buildstap.
import { localHealthcheckArgs } from "../scripts/local-healthcheck.mjs";

test("uitsluitend de lokale Auth-healthcheck omzeilt de HTTP-proxy", () => {
  const args = ["create", "--name", "supabase_auth_VVPSponsor", "--health-cmd", "wget --no-verbose --tries=1 --spider http://127.0.0.1:9999/health", "image"];
  assert.equal(localHealthcheckArgs(args)[4], "wget -Y off -q --spider http://127.0.0.1:9999/health");
  assert.equal(args[4], "wget --no-verbose --tries=1 --spider http://127.0.0.1:9999/health");
  for (const unchanged of [
    ["pull", "ghcr.io/supabase/gotrue:v2.197.0"],
    ["create", "--name", "other", "--health-cmd", args[4], "image"],
    ["create", "--name", "supabase_auth_VVPSponsor", "--health-cmd", "wget --spider https://example.com/health", "image"],
  ]) assert.deepEqual(localHealthcheckArgs(unchanged), unchanged);
});
