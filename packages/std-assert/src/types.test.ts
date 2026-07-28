import { describe, expect, it } from "vitest";
import { assertPlugin } from "./plugin.js";

/**
 * `assert` contributes words for `expect`, not verbs.
 *
 * The type catalog is built from exactly two things a plugin publishes, its
 * `typeDefs` and its actions' signatures, and this one has neither. A matcher
 * is a predicate over a subject the checker already typed where it was written,
 * and it gives back a pass or a fail, not a value. So there is nothing here to
 * sign; what follows is the guard for the day that stops being true.
 */
describe("assert type surface", () => {
  it("has matchers, and no verb that skipped its signature", () => {
    expect(assertPlugin.matchers?.length).toBeGreaterThan(0);
    for (const action of assertPlugin.actions ?? []) {
      expect(action.signature, `assert.${action.name} has no signature`).toBeDefined();
    }
  });

  it("names no type of its own", () => {
    expect(assertPlugin.typeDefs).toBeUndefined();
  });
});
