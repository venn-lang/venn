import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { buildRegistry, checkDocument, collectFragments } from "@venn-lang/runtime";
import { describe, expect, it } from "vitest";
import { allPlugins } from "./plugins.js";

/**
 * What a `fn` may call, asked of the real stdlib rather than of a test double.
 *
 * The purity rule reads `PluginDefinition.requires`, so the rule and the data are
 * only one answer together: `check-pure-verb.ts` can be perfect and still admit
 * `crypto.uuid` into a pure body if the plugin behind it declares nothing. Every
 * other test of the rule builds a plugin to suit itself, which proves the
 * mechanism and nothing about the twenty-four plugins a program actually
 * imports. This one loads all of them.
 */
function codes(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const registry = buildRegistry({ plugins: allPlugins, caps: createTestHost().caps });
  const fragments = new Set(collectFragments(ast).keys());
  return checkDocument({ document: ast, registry, fragments }).map((problem) => problem.code);
}

/**
 * Bodies that compute, and are left alone, each named for why it touches nothing.
 *
 * The first two are committed programs, `examples/basics/16-failure.vn:21` and
 * `examples/programs/ledger/main.vn:26`, and they are the shape this rule exists
 * for: take input, transform it, refuse what is wrong. `json.parse` reads no
 * clock, no socket, no disk and no randomness, and raising is control flow rather
 * than an effect on the world, so that shape costs no `fragment`.
 *
 * `path` is the interesting one. It reaches `PathsPort` and stays callable,
 * because that port declares no capability on the documented ground that working
 * out where a path leads is text rather than I/O. It is the one namespace where
 * "reaches a port" and "touches the world" come apart.
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
 * Bodies that reach the world, each refused with `VN2024` and named by verb.
 *
 * `data.json` and `crypto.hash` are the cost of declaring per plugin rather than
 * per verb: both are deterministic computations over their argument, and both are
 * refused because a namespace-mate draws. That is over-claiming, taken
 * deliberately, because the alternative admits `crypto.uuid` into something the
 * language calls pure, and a silently non-deterministic pure function is worse
 * than a refused digest. The answer is to split those namespaces.
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
  "a digest, refused with its namespace": `import { crypto } from "venn/crypto"
fn f() { crypto.hash("x") }
print f()`,
};

describe("a fn may compute", () => {
  it.each(Object.entries(COMPUTES))("allows %s", (_name, source) => {
    expect(codes(source)).toEqual([]);
  });
});

describe("a fn may not touch the world", () => {
  it.each(Object.entries(REACHES_THE_WORLD))("refuses %s", (_name, source) => {
    expect(codes(source)).toEqual(["VN2024"]);
  });
});

/**
 * The same verb without brackets is refused by the rule that owns that spelling:
 * reading a verb as a value hands back the verb itself, which is VN2008 and says
 * so in those terms rather than talking about purity. Two rules, one namespace,
 * and each says the thing it is about.
 */
describe("a verb read as a value in a pure body", () => {
  it("is refused in the words that fit it, not in purity's words", () => {
    const source = `import { data } from "venn/data"
fn f() { data.json }
print f()`;

    expect(codes(source)).toEqual(["VN2008"]);
  });
});
