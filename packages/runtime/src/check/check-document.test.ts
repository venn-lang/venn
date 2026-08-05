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

/**
 * A raise is control flow rather than an effect on the world, so a pure body may
 * run one at any depth and in every spelling that reaches this rule.
 *
 * Two of the three spellings knew that and the third did not, so
 * `let stop = fail "the guard"` was refused inside a `fn` while the same line
 * checked clean at the top level, inside a `fragment`, and one line over as
 * `if n < 0 { fail "negative" }`. The sentence it was refused under said a `fn`
 * cannot `fail`, which is this release's headline inverted, and the way out it
 * named was a `fragment`, where the line was already legal exactly as written.
 *
 * The binding is dead, because nothing comes back from a raise. It is dead in
 * the same way at the top level, so it is left legal there and here alike:
 * VN2027 owns what a `let` may hold and permits this one on purpose.
 */
const A_FN_MAY_FAIL: Record<string, string> = {
  "a raise as a statement of the body": 'fn g(n) {\n  fail "no"\n}\nprint g(1)\n',
  "a raise inside an if": 'fn g(n) {\n  if n < 0 { fail "negative" }\n  return n\n}\nprint g(1)\n',
  "a raise inside an if inside an if":
    'fn g(n) {\n  if n < 0 { if n < -9 { fail "way off" } }\n  return n\n}\nprint g(1)\n',
  "a raise bound to a name, which binds nothing":
    'fn g(n) {\n  let stop = fail "the guard"\n  return n\n}\nprint g(1)\n',
  "a raise bound to a name, carrying options too":
    'fn g(n) {\n  let stop = fail "the guard" { code: "app.guard" }\n  return n\n}\nprint g(1)\n',
  "a raise bound to a name in a lambda, which is the shape the corpus writes":
    'const g = fn (n) {\n  let stop = fail "the guard"\n  return n\n}\nprint g(1)\n',
  "a raise inside an if in a lambda, which has nowhere to move a verb to":
    'const g = fn (n) {\n  if n < 0 { fail "negative" }\n  return n\n}\nprint g(1)\n',
};

describe("a fn that fails", () => {
  it.each(Object.entries(A_FN_MAY_FAIL))("says nothing about %s", (_name, source) => {
    expect(check(source)).toEqual([]);
  });
});

/**
 * And the same three spellings for a verb that does reach the world, so the
 * clause above cannot be read as an opening. `wire.send` is the only verb here
 * whose plugin asked the host for anything.
 */
const A_VERB_IS_STILL_REFUSED: Record<string, string> = {
  "bound with a trailing argument, which is what makes a `let` a call":
    'import { wire } from "@t/net"\nfn f() {\n  let a = wire.send "x"\n  return a\n}\nprint f()\n',
  "called as a statement, whose value nothing keeps":
    'import { wire } from "@t/net"\nfn f() {\n  wire.send "x"\n  return 1\n}\nprint f()\n',
  "read where a value is wanted":
    'import { wire } from "@t/net"\nfn f() {\n  let a = wire.send("x")\n  return a\n}\nprint f()\n',
};

describe("a verb that reaches the world, in each spelling", () => {
  it.each(Object.entries(A_VERB_IS_STILL_REFUSED))("refuses one %s", (_name, source) => {
    expect(codes(source)).toEqual(["VN2024"]);
  });
});
