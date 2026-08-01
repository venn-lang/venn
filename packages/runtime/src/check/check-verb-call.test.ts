import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin, defineValue } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

const KIT = definePlugin({
  name: "@t/kit",
  version: "0",
  namespace: "kit",
  actions: [
    defineAction({ name: "parse", run: () => 1 }),
    defineAction({ name: "render", run: () => 1 }),
  ],
  values: [defineValue({ name: "rate", doc: "How fast.", type: t.number, value: 42 })],
});

function problems(source: string) {
  const document = parse(source).ast;
  const registry = buildRegistry({ plugins: [KIT], caps: createTestHost().caps });
  const fragments = new Set(collectFragments(document).keys());
  return checkDocument({ document, registry, fragments });
}

const codes = (source: string): string[] => problems(source).map((found) => found.code);

const said = (source: string): string[] =>
  problems(source).map((found) => `${found.title} ${found.help ?? ""}`.trim());

const IMPORT = 'import { kit } from "@t/kit"\n';

/**
 * A verb a namespace does not publish, written where a value goes.
 *
 * The statement form has been refused since `VN2003` existed. The same mistake
 * inside an expression typed as `dynamic`, so the checker had nothing to say
 * and the run failed a line later with "this value is not a function".
 */
describe("a verb a namespace does not publish", () => {
  it("is reported when it is called for a value", () => {
    expect(codes(`${IMPORT}const x = kit.nope("a")\nprint x`)).toEqual(["VN2003"]);
  });

  it("is reported inside an argument, which is where it hid", () => {
    expect(codes(`${IMPORT}print kit.nope("a")`)).toEqual(["VN2003"]);
  });

  it("names the namespace and the verb, and suggests the one nearly written", () => {
    expect(said(`${IMPORT}print kit.pars("a")`)).toEqual([
      '"kit" does not publish "pars". Did you mean `kit.parse`?',
    ]);
  });

  it("says nothing more when no verb is close", () => {
    expect(said(`${IMPORT}print kit.zzzzzzzz("a")`)).toEqual([
      '"kit" does not publish "zzzzzzzz".',
    ]);
  });

  /** The suggestion comes back under the name this file wrote, not the real one. */
  it("follows the name an import gave the namespace", () => {
    const source = 'import { kit as k } from "@t/kit"\nprint k.pars("a")';

    expect(said(source)).toEqual(['"k" does not publish "pars". Did you mean `k.parse`?']);
  });
});

describe("what it must not report", () => {
  const FINE = [
    { how: "a verb that exists", source: `${IMPORT}print kit.parse("a")` },
    { how: "a constant read, not called", source: `${IMPORT}print kit.rate` },
    {
      how: "a method on something the file bound",
      source: "const kit = { nope: () => 1 }\nprint kit.nope()",
    },
    { how: "a member of a plain value", source: "const m = { a: { b: () => 1 } }\nprint m.a.b()" },
    { how: "a prelude call", source: "print range(3)" },
    { how: "a local function", source: "fn twice(n) => n * 2\nprint twice(2)" },
  ];

  for (const fine of FINE) {
    it(`stays quiet for ${fine.how}`, () => {
      expect(codes(fine.source)).toEqual([]);
    });
  }

  /**
   * A name nothing bound is `VN2018`'s sentence, said once. Saying a namespace
   * does not publish something, about a namespace that is not there either,
   * would be two errors for one mistake.
   */
  it("leaves a namespace nobody imported to the check that owns it", () => {
    expect(codes("print other.nope()")).toEqual(["VN2018"]);
  });

  /**
   * A constant called as though it were a verb is a different sentence: the name
   * is there and is not callable, which is `VN3013`'s job and not this one's.
   */
  it("does not claim a published constant is missing", () => {
    expect(codes(`${IMPORT}print kit.rate()`)).toEqual([]);
  });
});
