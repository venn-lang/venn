import { describe, expect, it, vi } from "vitest";
import { hungUp, quietPipe } from "./quiet-pipe.js";

/** What Node hands over when the other end of a pipe is gone. */
function brokenPipe(): Error {
  return Object.assign(new Error("write EPIPE"), { code: "EPIPE", syscall: "write" });
}

describe("what a closed pipe is", () => {
  it("knows the reader hung up", () => {
    expect(hungUp(brokenPipe())).toBe(true);
    expect(hungUp({ code: "ERR_STREAM_DESTROYED" })).toBe(true);
  });

  it("does not swallow a real failure", () => {
    expect(hungUp(Object.assign(new Error("nope"), { code: "ENOENT" }))).toBe(false);
    expect(hungUp(new Error("nope"))).toBe(false);
    expect(hungUp(undefined)).toBe(false);
  });
});

/**
 * `venn run prog.vn | head -2` printed `EPIPE: broken pipe, write` and left with
 * 1, so every CLI written in Venn broke the first time anybody piped it.
 */
describe("what happens when the reader leaves", () => {
  it("leaves quietly, on either stream", () => {
    const exit = vi.fn();
    const off = quietPipe({ exit });

    process.stdout.emit("error", brokenPipe());
    process.stderr.emit("error", brokenPipe());
    off();

    expect(exit.mock.calls).toEqual([[0], [0]]);
  });

  it("leaves quietly on the signal, where the platform sends one", () => {
    const exit = vi.fn();
    const off = quietPipe({ exit });

    process.emit("SIGPIPE");
    off();

    expect(exit).toHaveBeenCalledWith(0);
  });

  /** A stream that failed for any other reason is still a failure. */
  it("stays out of the way of a real stream error", () => {
    const exit = vi.fn();
    const off = quietPipe({ exit });

    process.stdout.emit("error", Object.assign(new Error("disk"), { code: "ENOSPC" }));
    off();

    expect(exit).not.toHaveBeenCalled();
  });

  it("takes itself back off the process", () => {
    const before = process.stdout.listenerCount("error");

    quietPipe({ exit: vi.fn() })();

    expect(process.stdout.listenerCount("error")).toBe(before);
  });
});
