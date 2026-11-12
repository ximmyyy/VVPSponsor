import { test } from "node:test";
import assert from "node:assert/strict";
import { isLocalDesignPreview } from "../src/lib/design-preview.ts";
const local = { NODE_ENV: "development", APP_ENV: "local" };
test("ontwerpweergaven vereisen development, lokale omgeving én loopback-host", () => {
  for (const host of ["localhost:3100", "127.0.0.1:3000", "[::1]:3000"])
    assert.equal(isLocalDesignPreview(local, host), true);
  for (const host of [
    null,
    "",
    "example.com",
    "localhost.example.com",
    "localhost@evil.example",
    "evil@localhost",
  ])
    assert.equal(isLocalDesignPreview(local, host), false);
  for (const env of [
    {},
    { ...local, NODE_ENV: "production" },
    { ...local, APP_ENV: "production" },
    { ...local, VERCEL: "1" },
  ]) {
    assert.equal(isLocalDesignPreview(env, "localhost:3000"), false);
  }
});
