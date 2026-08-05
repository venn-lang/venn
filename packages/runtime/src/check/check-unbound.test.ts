// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test, where ${…} is the language's own interpolation.
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
  actions: [defineAction({ name: "fetch", run: () => 1 })],
});

function problems(source: string) {
  const document = parse(source).ast;
  const registry = buildRegistry({ plugins: [KIT], caps: createTestHost().caps });
  const fragments = new Set(collectFragments(document).keys());
  return checkDocument({ document, registry, fragments });
}

const codes = (source: string): string[] => problems(source).map((found) => found.code);

const titles = (source: string): string[] =>
  problems(source).map((found) => `${found.title} ${found.help ?? ""}`.trim());

/**
 * The same pass, told this file imported a `pub deco` of that name. Its body is
 * in the other file, which this pass never parsed.
 */
const imported = (source: string, decos: string[]): string[] => {
  const document = parse(source).ast;
  const registry = buildRegistry({ plugins: [KIT], caps: createTestHost().caps });
  const fragments = new Set(collectFragments(document).keys());
  return checkDocument({ document, registry, fragments, importedDecos: decos }).map(
    (found) => found.code,
  );
};

/**
 * A name nothing binds.
 *
 * The runtime cannot say this usefully: it reads the name as `null` and the
 * program carries that until something else fails over it, one file away. Said
 * here, it lands on the name that was typed wrong.
 */
describe("a name nothing binds", () => {
  it("is reported where it is written", () => {
    expect(codes("print nowhere")).toEqual(["VN2018"]);
  });

  it("is reported at the head of a member chain", () => {
    expect(codes("print nowhere.deep.deeper")).toEqual(["VN2018"]);
  });

  it("suggests the name that is nearly it", () => {
    expect(titles("const total = 1\nprint totl")).toEqual([
      'Nothing is named "totl" here. Did you mean `total`?',
    ]);
  });

  it("says how a name comes to exist when nothing is close", () => {
    expect(titles("print zzzzzzz")).toEqual([
      'Nothing is named "zzzzzzz" here. Bind it with `const` or `let`, or bring it in with `import`.',
    ]);
  });
});

/** Every way a name comes to be, since each one it misses is a false report. */
describe("a name something binds", () => {
  const BOUND = [
    { how: "const", source: "const x = 1\nprint x" },
    { how: "let", source: "let x = 1\nprint x" },
    { how: "a destructured map", source: "const { x } = { x: 1 }\nprint x" },
    { how: "a destructured list", source: "const [x] = [1]\nprint x" },
    { how: "a rest pattern", source: "const { a, ...x } = { a: 1 }\nprint x" },
    { how: "a fn declaration", source: "fn x() => 1\nprint x()" },
    { how: "a fn parameter", source: "fn f(x) => x\nprint f(1)" },
    { how: "an arrow parameter", source: "const f = x => x\nprint f(1)" },
    { how: "a fragment", source: "fragment x() {\n  print 1\n}\nrun x()" },
    { how: "forEach", source: "forEach x in [1] {\n  print x\n}" },
    { how: "forEach with a pattern", source: "forEach { x } in [{ x: 1 }] {\n  print x\n}" },
    { how: "repeat as", source: "repeat 1 as x {\n  print x\n}" },
    { how: "loop state", source: "loop x = 0 {\n  break\n}\nprint x" },
    { how: "run as", source: "fragment f() {\n  print 1\n}\nrun f() as x\nprint x" },
    { how: "catch", source: "try {\n  print 1\n} catch x {\n  print x\n}" },
    {
      how: "a match pattern",
      source: "const said = match [1] {\n  [x] => x\n  _ => 0\n}\nprint said",
    },
    { how: "an import", source: 'import { kit } from "@t/kit"\nprint kit' },
    { how: "an aliased import", source: 'import { kit as x } from "@t/kit"\nprint x' },
    { how: "a module import", source: 'import * as x from "./other.vn"\nprint x' },
    { how: "the prelude", source: "print range(3)" },
    { how: "a namespace", source: 'import { kit } from "@t/kit"\nprint kit.fetch()' },
  ];

  for (const bound of BOUND) {
    it(`is not reported when it comes from ${bound.how}`, () => {
      expect(codes(bound.source)).toEqual([]);
    });
  }

  /**
   * A bare name in a decorator is a word, not a reference: `@tags(smoke)` names
   * a tag, and decorators run before there is a program for one to refer to.
   */
  it("is not reported inside a decorator, where a bare name is a word", () => {
    const source = '@tags(smoke, nightly)\nflow "F" {\n  step "s" {\n    print 1\n  }\n}';

    expect(codes(source)).toEqual([]);
  });

  /** Order is scope's question, and scope is not what a typo needs answering. */
  it("is not reported for a name bound further down the file", () => {
    expect(codes("fn early() => later()\nfn later() => 1\nprint early()")).toEqual([]);
  });
});

/**
 * The document's own tree stops at the string, so nothing used to look inside
 * one: `"id=${noSuchName}"` interpolated as the empty string and survived into a
 * passing assertion, while the same name one character to the left was refused.
 */
describe("a name nothing binds, written inside a placeholder", () => {
  it("is the same problem it is outside the string", () => {
    expect(codes('print "unknown is ${nobodyBoundThis}"')).toEqual(["VN2018"]);
  });

  it("is reported at the placeholder rather than at the string", () => {
    const [found] = problems('const total = 1\nprint "n is ${totl}"');

    expect(`${found?.span.line}:${found?.span.column}`).toBe("2:15");
  });

  it("says nothing about a name the file binds", () => {
    expect(codes('const total = 1\nprint "n is ${total}"')).toEqual([]);
  });

  it("says nothing about a name the placeholder binds itself", () => {
    expect(codes('const xs = [1]\nprint "${xs.map(fn (n) => n + 1)}"')).toEqual([]);
  });
});

/**
 * A decorator can add a parameter, and the body underneath is written expecting
 * it. Expansion runs after this check, so nothing here can see the binding.
 *
 * The `deco` body says which decorator can do that and which name it adds, so
 * only that name is excused: exempting every decorated function turned off the
 * check that catches typos wherever a decorator was written.
 */
describe("a name a decorator binds", () => {
  const INJECT = ["deco inject(target: Fn, name: string) {", "  target.addParam(name)", "}"];
  const LOUD = ["deco loud(target: Fn) {", "  target.wrap(fn (call, args) => call(args))", "}"];
  const DECORATED = [...INJECT, '@inject("who")'];
  const UNBOUND =
    'Nothing is named "nobodyDefinedThis" here. ' +
    "Bind it with `const` or `let`, or bring it in with `import`.";

  it("is not refused when it is read inside a placeholder", () => {
    expect(codes([...DECORATED, 'fn greet() => "hello ${who}"'].join("\n"))).toEqual([]);
  });

  it("is not refused when it is read as a bare name either", () => {
    expect(codes([...DECORATED, "fn greet() => who"].join("\n"))).toEqual([]);
  });

  /** Only the declaration a decorator could rewrite: everything else is still checked. */
  it("is still refused in a function nothing decorates", () => {
    expect(codes([...DECORATED, "fn greet() => 1", "fn other() => who"].join("\n"))).toEqual([
      "VN2018",
    ]);
  });

  /** The name the decorator adds, and no other: a typo beside it is still a typo. */
  it("is refused for a name the decorator does not add", () => {
    const source = [...DECORATED, 'fn greet() => "${who} ${nobodyDefinedThis}"'].join("\n");

    expect(titles(source)).toEqual([UNBOUND]);
  });

  it("is refused under a decorator that only wraps its target", () => {
    const source = [...LOUD, "@loud", 'fn greet() => "hello ${nobodyDefinedThis}"'].join("\n");

    expect(codes(source)).toEqual(["VN2018"]);
  });

  it("is refused under a built-in decorator, which cannot add a parameter", () => {
    expect(codes("@retry(2)\nfn greet() => nobodyDefinedThis")).toEqual(["VN2018"]);
  });

  /** Stacked, one of the two adds: what it adds is excused and nothing else is. */
  it("takes the union of what the decorators on it add", () => {
    const source = [
      ...INJECT,
      ...LOUD,
      "@loud",
      '@inject("who")',
      'fn greet() => "${who} ${nobodyDefinedThis}"',
    ].join("\n");

    expect(titles(source)).toEqual([UNBOUND]);
  });

  /** A `deco` whose body is in another file: unreadable here, so nothing is refused. */
  it("says nothing under an imported decorator", () => {
    const source = '@inject("who")\nfn greet() => "${who} ${nobodyDefinedThis}"';

    expect(imported(source, ["inject"])).toEqual([]);
  });
});
