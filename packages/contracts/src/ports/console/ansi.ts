/**
 * The escape sequences a terminal understands, kept in one place.
 *
 * Written here rather than spread through the console so that what a screen
 * operation means is said once, and so the fake console never has to know any
 * of it: it records the operation and this turns it into bytes.
 */

import type { ScreenOp } from "./console.types.js";

const ESC = "[";

/** The bytes for one screen operation, or nothing when there are none to send. */
export function sequenceFor(op: ScreenOp): string {
  if (op.kind === "to") return `${ESC}${op.row};${op.column}H`;
  if (op.kind === "move") return `${moved(op.rows, "B", "A")}${moved(op.columns, "C", "D")}`;
  if (op.kind === "hide") return `${ESC}?25l`;
  if (op.kind === "show") return `${ESC}?25h`;
  // `2K` clears the whole line and leaves the cursor be; `G` puts it at column 1,
  // which is where anything about to be rewritten wants it.
  if (op.kind === "clearLine") return `${ESC}2K${ESC}1G`;
  return `${ESC}2J${ESC}1;1H`;
}

/** `move` in one direction, with the letter for each way, and nothing for zero. */
function moved(by: number, forward: string, back: string): string {
  if (by === 0) return "";
  return `${ESC}${Math.abs(by)}${by > 0 ? forward : back}`;
}
