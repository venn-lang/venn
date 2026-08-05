import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Every problem a program earns, as `CODE title`, with its help under it. */
function said(source: string): string[] {
  const { ast } = parse(source);
  return checkTypes(ast).problems.map((one) => `${one.code} ${one.title}${under(one.help)}`);
}

function under(help: string | undefined): string {
  return help ? ` // ${help}` : "";
}

const ROWS = "let rows = [1, 2]\n";

/**
 * `rows.push(x)` compiles, runs, and hands back a new list the statement drops.
 * It is JavaScript's mutating name on a copying operation, so it reads as a
 * finished statement, and a program printed `months: 0` beside a total that was
 * right with nothing anywhere saying why.
 *
 * Said as the general rule rather than as a note about `push`: every member of
 * every built-in table is pure, so any of them standing alone as a statement
 * does nothing at all.
 */
describe("a pure call standing on its own", () => {
  it("warns, naming what came back and where to put it", () => {
    expect(said(`${ROWS}rows.push(3)`)).toEqual([
      "VN5009 `rows.push` gives back a new list<number>, and nothing keeps it. " +
        "// Nothing is changed in place. Bind the result with `let`, or assign it back to `rows`.",
    ]);
  });

  it("is a warning and not an error, because the run is well defined", () => {
    const { ast } = parse(`${ROWS}rows.push(3)`);

    expect(checkTypes(ast).problems[0]?.severity).toBe("warning");
  });

  it("says nothing once the result is kept", () => {
    expect(said(`${ROWS}let more = rows.push(3)`)).toEqual([]);
    expect(said(`${ROWS}rows = rows.push(3)`)).toEqual([]);
    expect(said(`${ROWS}print rows.push(3)`)).toEqual([]);
  });

  it("catches everything shaped the same way, not just `push`", () => {
    expect(said('let s = "  a  "\ns.trim')[0]).toContain("VN5009");
    expect(said('let m = { a: 1 }\nm.omit("a")')[0]).toContain("VN5009");
    expect(said(`${ROWS}rows.reverse`)[0]).toContain("VN5009");
  });

  /** A member written for what it does rather than for what it answers. */
  it("leaves a call that answers nothing alone", () => {
    expect(said(`${ROWS}rows.forEach(fn (n) => n)`)).toEqual([]);
  });

  /** A verb is not a member read, whatever the dots look like. */
  it("leaves a verb alone", () => {
    expect(said('print "hello"')).toEqual([]);
    expect(said("let n = 1\nlog n")).toEqual([]);
  });

  /**
   * Over-claiming here would report a correct program. A receiver whose type is
   * still an open question may be a handle, whose members reach the world, so
   * nothing is said until the checker knows what it is holding.
   */
  it("says nothing about a receiver it cannot place", () => {
    expect(said("fn f(x) { x.push(1) }")).toEqual([]);
  });

  /** A discarded copy is a discarded copy even when its element is still open. */
  it("still counts a new list whose element nothing has solved", () => {
    expect(said("fn id(x) => x\nlet xs = [1]\nxs.map(id)")[0]).toContain("VN5009");
  });
});
