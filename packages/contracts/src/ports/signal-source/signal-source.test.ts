import process from "node:process";
import { describe, expect, it } from "vitest";
import { createFakeSignals, type FakeSignals } from "./fake-signals.js";
import { createNodeSignals, isKnownSignal } from "./node-signals.js";
import { signalSourceConformance } from "./signal-source.suite.js";

signalSourceConformance({
  name: "fake",
  factory: () => createFakeSignals(),
  raise: ({ source, signal }) => (source as FakeSignals).raise(signal),
  delivers: "SIGINT",
  other: "SIGTERM",
});

// The real one is driven through `process.emit`, which runs the listeners the
// same way a delivered signal does. SIGHUP is the one raised here on purpose:
// emitting SIGINT or SIGTERM would talk to the test runner's own handlers.
signalSourceConformance({
  name: "node-process",
  factory: () => createNodeSignals(),
  raise: ({ signal }) => {
    process.emit(signal);
  },
  delivers: "SIGHUP",
  other: "SIGTERM",
});

describe("SignalSource · node-process", () => {
  it("subscribes silently to a signal this platform does not have", () => {
    const source = createNodeSignals();
    const off = source.on("SIGBREAK", () => {});

    expect(() => off()).not.toThrow();
    expect(isKnownSignal("SIGINT")).toBe(true);
  });
});
