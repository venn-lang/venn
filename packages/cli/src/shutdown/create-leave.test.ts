import { describe, expect, it, vi } from "vitest";
import { createLeave } from "./create-leave.js";
import { createShutdown } from "./create-shutdown.js";

/** A close that never settles: the process this is all here to rescue. */
function stuck() {
  const shutdown = createShutdown();
  shutdown.add(() => new Promise<void>(() => {}));
  return shutdown;
}

describe("createLeave", () => {
  it("closes what is open before it goes", async () => {
    let closed = false;
    const codes: number[] = [];
    const shutdown = createShutdown();
    shutdown.add(() => {
      closed = true;
    });

    createLeave({ shutdown, exit: (code) => codes.push(code) })(130);
    await vi.waitFor(() => expect(codes).toEqual([130]));

    expect(closed).toBe(true);
  });

  // The second Ctrl+C means the user has stopped asking nicely.
  it("goes at once when asked twice", () => {
    const codes: number[] = [];
    const leave = createLeave({ shutdown: stuck(), exit: (code) => codes.push(code) });

    leave(130);
    leave(130);

    expect(codes).toEqual([130]);
  });

  it("gives up on a close that never settles", async () => {
    const codes: number[] = [];

    createLeave({ shutdown: stuck(), exit: (code) => codes.push(code), graceMs: 1 })(143);

    await vi.waitFor(() => expect(codes).toEqual([143]));
  });
});
