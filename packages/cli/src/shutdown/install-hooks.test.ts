import { createFakeSignals, VennError } from "@venn/contracts";
import { describe, expect, it, vi } from "vitest";
import { createShutdown } from "./create-shutdown.js";
import { installFaultHooks } from "./install-fault-hooks.js";
import { installHooks } from "./install-hooks.js";

/** A whole process's worth of hooks, with nothing real attached to them. */
function hooked() {
  const signals = createFakeSignals();
  const shutdown = createShutdown();
  const codes: number[] = [];
  const closed: string[] = [];
  shutdown.add(() => void closed.push("server"));
  installHooks({ signals, shutdown, exit: (code) => codes.push(code), report: () => {} });
  return { signals, codes, closed };
}

describe("installHooks · signals", () => {
  it("listens for every way a terminal can ask a program to stop", () => {
    const signals = createFakeSignals();
    installHooks({ signals, shutdown: createShutdown(), exit: () => {} });

    expect(signals.listening).toEqual(["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]);
  });

  it.each([
    ["SIGINT", 130],
    ["SIGTERM", 143],
    ["SIGBREAK", 130],
    ["SIGHUP", 129],
  ] as const)("closes on %s and leaves with %i", async (signal, code) => {
    const { signals, codes, closed } = hooked();

    signals.raise(signal);
    await vi.waitFor(() => expect(codes).toEqual([code]));

    expect(closed).toEqual(["server"]);
  });
});

describe("installHooks · faults", () => {
  /** Calling the listener directly, rather than emitting: a real
   * `uncaughtException` here would be caught by the test runner instead. */
  const lastListener = (event: "uncaughtException" | "unhandledRejection") =>
    process.listeners(event as "uncaughtException").at(-1) as (cause: unknown) => void;

  it("says what went wrong in the language's voice, then leaves with 1", () => {
    const said: string[] = [];
    const codes: number[] = [];
    const off = installFaultHooks({
      leave: (code) => codes.push(code),
      report: (message) => said.push(message),
    });

    lastListener("unhandledRejection")(
      new VennError({ code: "VN7020", message: "Port 8099 is already in use." }),
    );
    off();

    expect(said).toEqual(["VN7020  Port 8099 is already in use."]);
    expect(codes).toEqual([1]);
  });

  it("leaves the process's listeners as it found them", () => {
    const before = process.listenerCount("uncaughtException");

    const off = installFaultHooks({ leave: () => {}, report: () => {} });
    expect(process.listenerCount("uncaughtException")).toBe(before + 1);

    off();
    expect(process.listenerCount("uncaughtException")).toBe(before);
  });
});
