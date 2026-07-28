import { describe, expect, it } from "vitest";
import { shouldLeave } from "./should-leave.js";

/**
 * The rule that kept a serving program alive and let a stopping one stop.
 *
 * Before the distinction existed there was one number and one guard: `exit 0`
 * looked exactly like reaching the last line, so a program holding a socket
 * could never be told to stop by its own source.
 */
describe("whether the process leaves", () => {
  it("stays when the program simply ran out of lines", () => {
    expect(shouldLeave({ code: 0, requested: false })).toBe(false);
  });

  it("leaves when the program asked to, even with nothing to report", () => {
    expect(shouldLeave({ code: 0, requested: true })).toBe(true);
  });

  it("leaves when it ended badly, asked or not", () => {
    expect(shouldLeave({ code: 1, requested: false })).toBe(true);
    expect(shouldLeave({ code: 3, requested: true })).toBe(true);
  });
});
