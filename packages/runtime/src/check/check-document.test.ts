import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, defineMatcher, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

const plugin = definePlugin({
  name: "@t/m",
  version: "0",
  namespace: "t",
  actions: [defineAction({ name: "noop", run: () => undefined })],
  matchers: [defineMatcher({ name: "known", test: () => true, message: () => "" })],
});

function check(source: string) {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const registry = buildRegistry({ plugins: [plugin], caps: createTestHost().caps });
  const fragments = new Set(collectFragments(ast).keys());
  return checkDocument({ document: ast, registry, fragments });
}

const codes = (source: string) => check(source).map((problem) => problem.code);

describe("checkDocument", () => {
  it("passes when every action, matcher, fragment and prelude call resolves", () => {
    const problems = check(`import { t, known } from "@t/m"

fragment helper() {
  expect true
}
flow "F" {
  step "s" {
    log "hi"
    t.noop
    expect 1 known
    run helper()
  }
}`);

    expect(problems).toEqual([]);
  });

  it("flags an unknown action, matcher, and fragment with their codes", () => {
    const found = codes(`import { t } from "@t/m"

flow "F" {
  step "s" {
    t.bogus
    expect 1 missing
    run ghost()
  }
}`);

    expect(found.sort()).toEqual(["VN2003", "VN2004", "VN2005"]);
  });

  // Loading the whole stdlib must not make `use` optional.
  it("rejects a namespace the file never imported, even when the registry knows it", () => {
    const found = codes(`flow "F" {
  step "s" { t.noop }
}`);

    expect(found).toEqual(["VN2007"]);
  });

  it("accepts a namespace reached through a `use … as` alias", () => {
    expect(
      codes(`import { t as tools } from "@t/m"\n\nflow "F" { step "s" { tools.noop } }`),
    ).toEqual([]);
  });

  it("accepts calling a const declared in the file", () => {
    const source = `import { t } from "@t/m"

const page = t.noop

flow "F" {
  step "s" { page.click }
}`;

    expect(codes(source)).toEqual([]);
  });

  it("still calls an entirely unknown namespace an unknown action", () => {
    expect(codes(`flow "F" { step "s" { nope.doThing } }`)).toEqual(["VN2003"]);
  });
});

/**
 * `let id = data.faker.uuid` runs the verb; the same words inside an expression
 * evaluate to the verb itself, and the program printed `[object Object]` with
 * nothing said about it. The parentheses are how the language already spells
 * "call this".
 */
describe("a verb named but never called", () => {
  it("is reported where it reads as a value", () => {
    const problems = check('import { t } from "@t/m"\nfn id() => t.noop\nprint id()\n');

    expect(problems.map((problem) => problem.code)).toContain("VN2008");
  });

  it("says nothing when it is called", () => {
    expect(check('import { t } from "@t/m"\nfn id() => t.noop()\nprint id()\n')).toEqual([]);
  });

  it("says nothing in statement position, which the runtime already calls", () => {
    expect(check('import { t } from "@t/m"\nlet id = t.noop\nprint id\n')).toEqual([]);
  });
});
