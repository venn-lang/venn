import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

const KIT = definePlugin({
  name: "@t/kit",
  namespace: "kit",
  actions: [defineAction({ name: "parse", run: () => 1 })],
});

function problems(source: string) {
  const document = parse(source).ast;
  const registry = buildRegistry({ plugins: [KIT], caps: createTestHost().caps });
  return checkDocument({
    document,
    registry,
    fragments: new Set(collectFragments(document).keys()),
  });
}

const codes = (source: string): string[] => problems(source).map((found) => found.code);

const IMPORT = 'import { kit } from "@t/kit"\n';

/**
 * A name bound twice in one file.
 *
 * The second one wins and says nothing, which is how `const kit = { … }` after
 * an import of `kit` quietly takes over every `kit.something` below it.
 */
describe("a name already taken", () => {
  it("is reported when a binding takes an imported namespace's name", () => {
    expect(codes(`${IMPORT}const kit = { parse: () => 1 }\nprint kit`)).toEqual(["VN2020"]);
  });

  it("is reported when two imports bind the same name", () => {
    const source = `${IMPORT}import * as kit from "./other.vn"\nprint kit`;

    expect(codes(source)).toEqual(["VN2020"]);
  });

  it("is reported for two bindings of the same name", () => {
    expect(codes("const total = 1\nconst total = 2\nprint total")).toEqual(["VN2020"]);
  });

  it("is reported for a declaration of any kind", () => {
    expect(codes(`${IMPORT}fn kit() => 1\nprint kit()`)).toEqual(["VN2020"]);
    expect(codes(`${IMPORT}type kit = string\nconst one: kit = "a"\nprint one`)).toEqual([
      "VN2020",
    ]);
  });

  it("is reported for a name a pattern bound", () => {
    const source = `${IMPORT}const { kit } = { kit: 1 }\nprint kit`;

    expect(codes(source)).toEqual(["VN2020"]);
  });

  /** Which is which is the whole of what a reader needs, so both are shown. */
  it("points at the second one, and shows the first beside it", () => {
    const [found] = problems(`${IMPORT}const kit = 1\nprint kit`);

    expect(found?.span.line).toBe(2);
    expect(found?.related?.[0]?.span.line).toBe(1);
    expect(found?.related?.[0]?.label).toBe("`kit` is bound here");
  });

  it("names `as` as the way out", () => {
    const [found] = problems(`${IMPORT}const kit = 1\nprint kit`);

    expect(found?.help).toContain("`as`");
  });
});

describe("what it must not report", () => {
  it("says nothing when the import was renamed out of the way", () => {
    const source = 'import { kit as k } from "@t/kit"\nconst kit = 1\nprint k.parse("a")';

    expect(codes(source)).toEqual([]);
  });

  /** A local is a local: shadowing inside a body is what one is for. */
  it("says nothing about a name bound inside a function or a step", () => {
    expect(codes(`${IMPORT}fn f(kit) => kit\nprint f(1)`)).toEqual([]);
    expect(codes(`${IMPORT}forEach kit in [1] {\n  print kit\n}`)).toEqual([]);
  });

  it("says nothing about two names that merely look alike", () => {
    expect(codes("const total = 1\nconst totals = 2\nprint total")).toEqual([]);
  });

  it("says nothing about a file that binds each name once", () => {
    const source = "const rate = 1\nfn twice(n) => n * 2\nprint twice(rate)";

    expect(codes(source)).toEqual([]);
  });
});
