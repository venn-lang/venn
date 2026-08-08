import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { buildRegistry, checkDocument, collectFragments } from "@venn-lang/runtime";
import { describe, expect, it } from "vitest";
import { allPlugins } from "./plugins.js";

/**
 * What a `fn` may call, asked of the real stdlib rather than of a test double.
 *
 * The answer is now every verb of every namespace, and that is worth asking of
 * the twenty-four plugins a program actually imports rather than of a plugin a
 * test built to suit itself: a namespace that resolves under a double can still
 * be unreachable under the real registry, and a body that reaches one is where
 * that would show. This one loads all of them.
 */
function codes(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const registry = buildRegistry({ plugins: allPlugins, caps: createTestHost().caps });
  const fragments = new Set(collectFragments(ast).keys());
  return checkDocument({ document: ast, registry, fragments }).map((problem) => problem.code);
}

/**
 * Bodies that compute, each named for the corner of the stdlib it touches.
 *
 * The first two are committed programs, `examples/basics/16-failure.vn:21` and
 * `examples/programs/ledger/main.vn:26`: take input, transform it, refuse what
 * is wrong. `path` is the interesting one, because it reaches `PathsPort` on
 * the documented ground that working out where a path leads is text rather
 * than I/O.
 */
const COMPUTES: Record<string, string> = {
  "parsing text in a fn, with no fragment and no run": `import { json } from "venn/json"
fn portOf(text) => try json.parse(text).port else 8080
print portOf("{}")`,
  "parsing to a list, the case the ledger README argued first": `import { json } from "venn/json"
fn claimsFrom(text: string) => try json.parse(text) else []
print claimsFrom("[]")`,
  "formatting a value, since fmt asks the host for nothing": `import { fmt } from "venn/fmt"
fn asJson(value) => fmt.json(value)
print asJson(1)`,
  "joining a path, whose port declares nothing": `import { path } from "venn/path"
fn under(name) => path.join("a", name)
print under("b")`,
  "writing out a moment it was handed, though date reads a clock": `import { date } from "venn/date"
fn dayOf(at) => date.format(at, "YYYY-MM-DD")
print dayOf(date.of({ year: 2026 }))`,
  "reading a moment somewhere, the shape schedule.vn needed": `import { date } from "venn/date"
fn hourIn(at, zone) => date.in(at, zone).hour
print hourIn(date.of({ year: 2026 }), "Europe/Lisbon")`,
  "comparing two floats, though math draws elsewhere": `import { math } from "venn/math"
fn near(a, b) => math.isClose(a, b)
print near(0.3, 0.1 + 0.2)`,
  "computing an angle, though math draws elsewhere": `import { math } from "venn/math"
fn corner() => math.degrees(math.atan2(1, 1))
print corner()`,
};

/**
 * Bodies that reach the world, each named by what it draws on.
 *
 * Every row cost a `fragment` and a `run … as` before this release, and the two
 * crypto rows cost one twice over: `crypto.hash` is a deterministic digest that
 * was refused for sharing a namespace with `crypto.uuid`. They check clean in a
 * `fn` now, which is what makes them worth keeping written down.
 */
const REACHES_THE_WORLD: Record<string, string> = {
  "a draw, which answers differently for the same arguments": `import { math } from "venn/math"
fn f() { math.randomInt(1, 6) }
print f()`,
  "a generator drawing from the run's own source": `import { data } from "venn/data"
fn f() { data.json("{}") }
print f()`,
  "writing to the console": `import { io } from "venn/io"
fn f() { io.eprint("x") }
print f()`,
  "reading the clock": `import { date } from "venn/date"
fn f() { date.now() }
print f()`,
  "a random identifier, which an empty port once admitted": `import { crypto } from "venn/crypto"
fn f() { crypto.uuid() }
print f()`,
  "a digest, once refused with its namespace": `import { crypto } from "venn/crypto"
fn f() { crypto.hash("x") }
print f()`,
};

describe("a fn may call any verb the stdlib publishes", () => {
  it.each([...Object.entries(COMPUTES), ...Object.entries(REACHES_THE_WORLD)])(
    "allows %s",
    (_name, source) => {
      expect(codes(source)).toEqual([]);
    },
  );
});

/**
 * A verb without brackets is not a call: the words hand back the verb itself,
 * which is VN2008 and says so in those terms. Reaching the world is now allowed
 * everywhere and this rule is untouched by that, because it is about the
 * brackets rather than about where the call stands.
 */
describe("a verb read as a value in a body", () => {
  it("is refused in the words that fit it, which are about the brackets", () => {
    const source = `import { data } from "venn/data"
fn f() { data.json }
print f()`;

    expect(codes(source)).toEqual(["VN2008"]);
  });
});
