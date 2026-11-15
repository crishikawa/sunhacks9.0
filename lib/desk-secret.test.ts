import assert from "node:assert/strict";
import test from "node:test";
import { assertDeskSecret, DeskAuthError } from "./desk-secret";

test("local development stays open until a secret is configured", () => {
  assert.doesNotThrow(() => assertDeskSecret(null, { secret: undefined, production: false }));
});

test("production refuses a scan when the secret is missing or wrong", () => {
  assert.throws(
    () => assertDeskSecret(null, { secret: undefined, production: true }),
    DeskAuthError,
  );
  assert.throws(
    () => assertDeskSecret("nope", { secret: "desk-secret", production: true }),
    DeskAuthError,
  );
  assert.doesNotThrow(() =>
    assertDeskSecret("desk-secret", { secret: "desk-secret", production: false }),
  );
});
