import { describe, expect, it } from "vitest";
import { createFakeNotifier } from "./fake-notifier.js";
import { notifierConformance } from "./notifier.suite.js";
import { createRealNotifier } from "./real-notifier.js";

notifierConformance({
  name: "fake",
  make: () => createFakeNotifier(),
  sample: { kind: "slack", channel: "#qa" },
});

describe("Notifier · real (stub)", () => {
  it("real notifier throws VN8090 until implemented", async () => {
    const notifier = createRealNotifier();
    await expect(notifier.send({ kind: "slack", channel: "#qa" })).rejects.toMatchObject({
      code: "VN8090",
    });
  });
});
