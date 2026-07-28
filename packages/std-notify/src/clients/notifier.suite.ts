import { describe, expect, it } from "vitest";
import type { Notification, Notifier } from "../port/index.js";

/** One `Notifier` implementation plus a sample notification to dispatch. */
export interface NotifierSpec {
  name: string;
  /** Builds a notifier with no state carried over from a previous case. */
  make(): Notifier;
  /** A message this implementation can actually accept. */
  sample: Notification;
}

/**
 * The `Notifier` conformance suite. Every implementation runs it: `send`
 * resolves a receipt carrying a boolean `delivered` and a string `id`.
 */
export function notifierConformance(spec: NotifierSpec): void {
  describe(`Notifier · ${spec.name}`, () => {
    it("send resolves a receipt", async () => {
      const receipt = await spec.make().send(spec.sample);
      expect(typeof receipt.delivered).toBe("boolean");
      expect(typeof receipt.id).toBe("string");
    });
  });
}
