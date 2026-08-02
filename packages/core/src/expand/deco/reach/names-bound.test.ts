import { describe, expect, it } from "vitest";
import { parse } from "../../../parse/index.js";
import type { Problem } from "../../../problem/index.js";
import { expand } from "../../expand.js";

const NOTHING = { get: () => undefined, names: () => [] };

function run(lines: readonly string[]): Problem[] {
  const { ast, problems } = parse(lines.join("\n"), { uri: "/main.vn" });
  expect(problems).toEqual([]);
  return expand({ document: ast, decorators: NOTHING, uri: "/main.vn" }).problems;
}

/** A `deco` body that binds a name one way, then reads it. */
function bindsAndReads(...body: readonly string[]): Problem[] {
  return run([
    "deco a(target: Fn) {",
    ...body,
    "}",
    "@a",
    "fn double(n) => n * 2",
    "print double(21)",
  ]);
}

/**
 * Every way a `deco` body can put a name in scope, which is fewer ways than the
 * language has.
 *
 * The refusal for a name out of reach is only as good as the list of names that
 * are in reach: one form missing from that list and a correct decorator is
 * refused for reading a name it had just bound. So each one is written out.
 *
 * A body holds `let`, `const`, `if` and verbs on what it was given, and nothing
 * else: `forEach`, `repeat`, `loop`, `try`, `capture` and `match` are all
 * refused there by an older rule, so their binding forms cannot arrive here from
 * a program that parses.
 */
describe("what a `deco` body binds is in reach", () => {
  it("a `const` of its own", () => {
    expect(bindsAndReads('  const label = "x"', "  target.rename(label)")).toEqual([]);
  });

  it("a `let` of its own", () => {
    expect(bindsAndReads('  let label = "x"', "  target.rename(label)")).toEqual([]);
  });

  it("a binding made inside an `if`", () => {
    expect(
      bindsAndReads(
        "  if target.params.len > 0 {",
        '    const label = "wide"',
        "    target.rename(label)",
        "  }",
      ),
    ).toEqual([]);
  });

  it("the decorator's own parameters", () => {
    expect(
      run([
        "deco a(target: Fn, label: string) {",
        "  target.rename(label)",
        "}",
        '@a("renamed")',
        "fn double(n) => n * 2",
        "print double(21)",
      ]),
    ).toEqual([]);
  });

  /** A closure written inside a `${…}`, which the parser leaves as text to rescan. */
  it("the parameters of a closure written inside an interpolation", () => {
    expect(bindsAndReads('  target.wrap(fn (call, args) => "${args.map((one) => one)}")')).toEqual(
      [],
    );
  });
});
