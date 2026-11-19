import assert from "node:assert/strict";
import test from "node:test";
import { isDemoMode, xaiApiKey } from "./demo";
import { deskEnv } from "./desk-secret";

test("demo mode is off unless DEMO_MODE is true", () => {
  assert.equal(isDemoMode({}), false);
  assert.equal(isDemoMode({ DEMO_MODE: "false" }), false);
  assert.equal(isDemoMode({ DEMO_MODE: "true" }), true);
  assert.equal(isDemoMode({ DEMO_MODE: " TRUE " }), true);
});

test("demo mode hides the xAI key even when one is set", () => {
  assert.equal(xaiApiKey({ XAI_API_KEY: "xai-live" }), "xai-live");
  assert.equal(xaiApiKey({ XAI_API_KEY: "xai-live", DEMO_MODE: "true" }), undefined);
  assert.equal(xaiApiKey({}), undefined);
});

test("demo mode lets production run without a desk secret", () => {
  assert.equal(deskEnv({ VERCEL_ENV: "production" }).production, true);
  assert.equal(deskEnv({ VERCEL_ENV: "production", DEMO_MODE: "true" }).production, false);
  assert.equal(deskEnv({ DESK_ADMIN_SECRET: "s" }).secret, "s");
});
