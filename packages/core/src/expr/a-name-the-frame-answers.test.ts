import { describe, expect, it } from "vitest";
import { ProblemError } from "../problem/index.js";
import { Frame, writeNamed, writeSlot } from "./frame.js";

/** A frame for a body binding `names`, with `boxed` slots holding cells. */
function frame(names: string[], boxed: number[] = [], parent?: unknown): Frame {
  const env = parent ?? { lookup: () => "from outside" };
  return new Frame({ body: { names, extra: 4, boxed: new Set(boxed) }, env } as never);
}

function goesOutward(): void {
  expect(frame(["other"]).lookup("wanted")).toBe("from outside");
}

function readsAPlainSlot(): void {
  const held = frame(["wanted"]);
  writeSlot(held, 0, "held");
  expect(held.lookup("wanted")).toBe("held");
}

function readsThroughTheCell(): void {
  const held = frame(["wanted"], [0]);
  writeSlot(held, 0, { value: "in the cell" });
  expect(held.lookup("wanted")).toBe("in the cell");
}

/** The block that never ran: nothing minted the cell, so there is nothing. */
function answersNothingWhereNoBindingReached(): void {
  expect(frame(["wanted"], [0]).lookup("wanted")).toBeUndefined();
}

function writesThroughTheCell(): void {
  const held = frame(["wanted"], [0]);
  const cell = { value: "before" };
  writeSlot(held, 0, cell);
  writeNamed(held, "wanted", "after");
  expect(cell.value).toBe("after");
}

function mintsTheCellNoBindingReached(): void {
  const held = frame(["wanted"], [0]);
  writeNamed(held, "wanted", "written");
  expect(held.lookup("wanted")).toBe("written");
}

function writesAPlainSlotOver(): void {
  const held = frame(["wanted"]);
  writeNamed(held, "wanted", "written");
  expect(held.lookup("wanted")).toBe("written");
}

function walksOutToTheFrameThatHoldsIt(): void {
  const outer = frame(["wanted"]);
  writeNamed(frame(["other"], [], outer), "wanted", "reached");
  expect(outer.lookup("wanted")).toBe("reached");
}

function reachesACellEnvironment(): void {
  const cell = { value: "before" };
  writeNamed(
    frame(["other"], [], { lookup: () => cell.value, cell: () => cell }),
    "wanted",
    "after",
  );
  expect(cell.value).toBe("after");
}

function refusesANameNothingBinds(): void {
  expect(() => writeNamed(frame(["other"]), "nobody", "x")).toThrow(ProblemError);
}

/**
 * What a frame answers when it is asked for a name rather than a slot.
 *
 * The old mechanism, and the only caller left is a closure written above the
 * `let` that binds the name it reads (#299). It survives because that one shape
 * cannot be settled where the closure is written, and it is tested here because
 * being the last of its kind is not the same as being unreachable.
 */
describe("a name a frame is asked for", () => {
  it("goes outward when this body does not bind it", goesOutward);
  it("reads a plain slot as it stands", readsAPlainSlot);
  it("reads a captured slot through its cell", readsThroughTheCell);
  it("answers nothing for a captured slot no binding reached", answersNothingWhereNoBindingReached);
});

/**
 * A write to a name, which has to reach the binding the read reaches. A read
 * that followed a cell and a write that went over it would disagree inside one
 * function, which is worse than either being wrong on its own.
 */
describe("a write to a name the body does not hold in a slot", () => {
  it("goes through the cell a closure is already holding", writesThroughTheCell);
  it("mints the cell where the binding never ran", mintsTheCellNoBindingReached);
  it("writes a plain slot over, since nothing captured it", writesAPlainSlotOver);
  it("walks out to the frame that holds the name", walksOutToTheFrameThatHoldsIt);
  it("reaches a cell environment past the frames", reachesACellEnvironment);
  it("refuses a name nothing binds, rather than inventing a place", refusesANameNothingBinds);
});
