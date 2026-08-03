import { ALL_CAPABILITIES } from "@venn-lang/contracts";
import { type Document, parse } from "@venn-lang/core";
import { defineAction, definePlugin, defineValue } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { type AnalyzeArgs, createFrontEnd } from "./index.js";
import { NOTHING_IMPORTED } from "./nothing-imported.js";

const KIT = definePlugin({
  name: "@t/kit",
  version: "0",
  namespace: "kit",
  actions: [defineAction({ name: "shout", run: () => "HI" })],
  values: [defineValue({ name: "limit", doc: "How many.", type: t.number, value: 10 })],
});

const NEWLINE = String.fromCharCode(10);

function inputs(source: string): AnalyzeArgs {
  const { ast } = parse(source, { uri: "memory://one.vn" });
  return {
    document: ast as Document,
    uri: "memory://one.vn",
    graph: NOTHING_IMPORTED,
    decos: new Map(),
    fragments: new Set(),
    env: undefined,
    packages: new Map(),
    unreadable: [],
    cycles: [],
  };
}

const front = createFrontEnd({ plugins: [KIT], caps: ALL_CAPABILITIES });

const codes = (...lines: readonly string[]): string[] =>
  front.analyze(inputs(lines.join(NEWLINE))).problems.map((one) => one.code);

/**
 * Every pass, in one call, so a command cannot run some of them.
 *
 * Three consumers assembled this list by hand and each chose a different
 * subset: `venn run` never type-checked, and the editor called the import check
 * without the registry it had already built. What each command does with the
 * answer is still its own; which passes ran is not.
 */
describe("the front end", () => {
  it("reports what the document check finds", () => {
    expect(codes("print { a: 1 }")).toEqual(["VN5007"]);
  });

  it("reports what the import check finds, package names included", () => {
    expect(codes('import { shout } from "@t/kit"', "print 1")).toContain("VN2009");
  });

  it("reports what the type check finds", () => {
    expect(codes('const count: number = "seven"', "print count")).toEqual(["VN3010"]);
  });

  it("types a value the plugins publish, with no install anywhere", () => {
    expect(codes('import { limit } from "@t/kit"', "print limit.upper")).toContain("VN3010");
  });

  /** Errors first, so whoever is reading meets the thing that broke. */
  it("hands them back loudest first, whichever pass found them", () => {
    const found = codes('import { kit } from "@t/kit"', 'const n: number = "seven"', "print n");

    expect(found).toEqual(["VN3010", "VN5005"]);
  });

  /** The inference the editor reads, from the same call, so it cannot differ. */
  it("hands back what every expression was inferred to be", () => {
    const analysis = front.analyze(inputs("const total = 1 + 2"));

    expect(analysis.types.size).toBeGreaterThan(0);
  });

  /**
   * A caller with no way to read a neighbour used to skip the import check
   * whole, and with it the half that needs no reader: what a package publishes
   * is knowable from the registry alone.
   */
  it("still checks a package import for a host that reaches no files", () => {
    expect(codes('import { shout } from "@t/kit"', "print 1")).toContain("VN2009");
  });
});
