import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, defineMatcher, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

const plugin = definePlugin({
  name: "@t/m",
  namespace: "t",
  actions: [defineAction({ name: "noop", run: () => undefined })],
  matchers: [defineMatcher({ name: "known", test: () => true, message: () => "" })],
});

/**
 * A plugin that asked the host for something, which is what makes its verbs
 * unavailable to a pure body. `@t/m` asks for nothing, so its `noop` is a
 * computation as far as the language can tell, and a `fn` may call it.
 */
const reaching = definePlugin({
  name: "@t/net",
  namespace: "wire",
  requires: ["net"],
  actions: [defineAction({ name: "send", run: () => undefined })],
});

function check(source: string) {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const registry = buildRegistry({ plugins: [plugin, reaching], caps: createTestHost().caps });
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

  // Loading the whole stdlib makes the import optional, so what is left is a
  // hint: it never refuses, and nothing behind it is hidden by it.
  it("hints at a namespace the file never imported, even though it resolves", () => {
    const found = check(`flow "F" {
  step "s" { t.noop }
}`);

    expect(found.map((one) => one.code)).toEqual(["VN2007"]);
    expect(found[0]?.severity).toBe("hint");
    expect(found[0]?.help).toBe('Write `import { t } from "@t/m"`.');
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

/** The one import every row below needs, so each row is the line it is about. */
const BRINGS_T = 'import { t } from "@t/m"\n';

/**
 * `let id = data.faker.uuid` runs the verb; the same words inside an expression
 * evaluate to the verb itself, and the program printed `[object Object]` with
 * nothing said about it. The parentheses are how the language already spells
 * "call this".
 */
describe("a verb named but never called", () => {
  it("is reported where it reads as a value", () => {
    expect(codes(`${BRINGS_T}fn id() => t.noop\nprint id()\n`)).toContain("VN2008");
  });

  // In a `fragment`, because a `fn` may not call a verb at all now and the
  // question here is the brackets rather than where the call stands.
  it("says nothing when it is called", () => {
    expect(check(`${BRINGS_T}fragment id() { return t.noop() }\nrun id()\n`)).toEqual([]);
  });

  it("says nothing in statement position, which the runtime already calls", () => {
    expect(check(`${BRINGS_T}let id = t.noop\nprint id\n`)).toEqual([]);
  });
});

/**
 * What a pure body may still do, which is everything that reaches nothing.
 *
 * A lambda is a `fn`, so the purity rule walks its body too, and the ordinary
 * shapes a program is made of go through it: a method on a list, a call of a
 * name the file binds itself, a verb of a plugin that asked the host for
 * nothing. Every one of those was refused at some point while this rule was
 * being moved out of the grammar, so each has a row.
 */
const REACHES_NOTHING: Record<string, string> = {
  "a lambda over a list": "const xs = [1, 2]\nprint xs.map(i => i + 1)\n",
  "a lambda over a literal, where no name is bound at all": 'print ["a"].countBy(w => w)\n',
  "a fn that only computes": "fn f(x) => x + 1\nprint f(1)\n",
  "a fn calling another fn of its own file": "fn d(n) => n * 2\nfn q(n) => d(d(n))\nprint q(2)\n",
  "a fn calling a plugin that asked the host for nothing":
    'import { t } from "@t/m"\nfn id() => t.noop()\nprint id()\n',
};

describe("a pure body that reaches nothing", () => {
  it.each(Object.entries(REACHES_NOTHING))("leaves %s alone", (_name, source) => {
    expect(check(source)).toEqual([]);
  });
});

/** And the one that did ask, which is the whole of what a pure body may not do. */
describe("a pure body that reaches the world", () => {
  it("refuses a fn calling a plugin that declared a capability", () => {
    const source = 'import { wire } from "@t/net"\nfn send() => wire.send()\nprint send()\n';

    expect(codes(source)).toEqual(["VN2024"]);
  });
});
