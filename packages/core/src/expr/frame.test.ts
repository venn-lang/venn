import { describe, expect, it } from "vitest";
import { ProblemError } from "../problem/index.js";
import { Frame, readSlot, writeSlot } from "./frame.js";

/** A frame with room for two names past the inline three, and nothing in it. */
function frame(): Frame {
  return new Frame({ body: { names: [], extra: 2 } } as never);
}

/**
 * A slot number no name has.
 *
 * `writeSlot` used to hand `-1` straight to `rest[at - 3]`, so an assignment the
 * compiler could not place became `Cannot set properties of undefined` on a body
 * with three locals and a write nobody performed on a body with four. Both
 * reached the user from a program `venn check` approved, with no code, no span
 * and no product voice.
 */
function refusedRatherThanIndexed(): void {
  expect(() => writeSlot(frame(), -1, "x")).toThrow(ProblemError);
  expect(() => readSlot(frame(), -1)).toThrow(ProblemError);
}

function saysWhatEverywhereElseSays(): void {
  try {
    writeSlot(frame(), -4, "x");
    expect.unreachable("a negative slot has to be refused");
  } catch (error) {
    expect((error as ProblemError).problem.code).toBe("VN3021");
    expect((error as ProblemError).problem.title).toBe("There is nothing here to write to.");
  }
}

function leavesRealSlotsAlone(): void {
  const held = frame();
  writeSlot(held, 0, "a");
  writeSlot(held, 4, "e");

  expect(readSlot(held, 0)).toBe("a");
  expect(readSlot(held, 4)).toBe("e");
}

describe("a slot the compiler could not place", () => {
  it("is refused with a code rather than indexed with a negative", refusedRatherThanIndexed);
  it("says what a write with nowhere to go says everywhere else", saysWhatEverywhereElseSays);
  it("leaves the slots a name does have alone", leavesRealSlotsAlone);
});
