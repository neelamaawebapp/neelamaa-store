import assert from "node:assert/strict";
import test from "node:test";
import { isAbandonedCartDue } from "../src/lib/abandoned-cart.js";

test("marks a cart as due only after 45 minutes when no reminder was sent", () => {
  const now = Date.parse("2026-07-15T12:00:00.000Z");

  assert.equal(isAbandonedCartDue("2026-07-15T11:15:00.000Z", 0, now), true);
  assert.equal(isAbandonedCartDue("2026-07-15T11:16:00.000Z", 0, now), false);
  assert.equal(isAbandonedCartDue("2026-07-15T11:00:00.000Z", 1, now), false);
});
