import { test } from "node:test";
import assert from "node:assert/strict";
import { publicEnvSchema, serverEnvSchema } from "../src/lib/env/schema.ts";

test("lokale configuratie accepteert een publishable key", () => {
  assert.equal(publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test_fixture",
  }).success, true);
});

test("secret keys en lege keys worden in publieke configuratie geweigerd", () => {
  for (const key of ["", "sb_secret_test_fixture", "legacy-jwt"]) {
    assert.equal(publicEnvSchema.safeParse({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    }).success, false);
  }
});

test("ontbrekende configuratie en onveilige URLs worden geweigerd", () => {
  assert.equal(publicEnvSchema.safeParse({}).success, false);
  assert.equal(publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: "javascript:alert(1)",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test_fixture",
  }).success, false);
});

test("APP_ENV vereist een expliciete bekende omgeving", () => {
  assert.equal(serverEnvSchema.safeParse({ APP_ENV: "prod" }).success, false);
  assert.equal(serverEnvSchema.safeParse({ APP_ENV: "test" }).success, true);
});
