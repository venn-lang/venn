import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, defineMatcher, definePlugin, z } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

const NEWLINE = String.fromCharCode(10);

const plugin = definePlugin({
  name: "@t/kit",
  version: "0",
  namespace: "kit",
  actions: [
    defineAction({
      name: "shout",
      params: z.object({ loudly: z.boolean() }),
      run: () => undefined,
    }),
    defineAction({ name: "whisper", run: () => undefined }),
  ],
  matchers: [defineMatcher({ name: "louder", test: () => true, message: () => "louder" })],
});

function problems(...lines: string[]) {
  const document = parse(lines.join(NEWLINE)).ast;
  const registry = buildRegistry({ plugins: [plugin], caps: createTestHost().caps });
  return checkDocument({
    document,
    registry,
    fragments: new Set(collectFragments(document).keys()),
  });
}

const codes = (...lines: string[]): string[] => problems(...lines).map((one) => one.code);

/**
 * `print { a: 1 }`, which prints an empty line.
 *
 * A trailing `{ … }` on a verb is its options, always, and that rule is what
 * lets `http.get "/x" { headers }` be written without brackets. The cost is a
 * line that looks exactly like the thing somebody meant, whether the verb is
 * one of the language's own or a plugin's: neither declares options of its
 * own, so both read the map as them and lose whatever it held.
 */
describe("a verb whose argument never reached it", () => {
  it("says so when the map was read as options", () => {
    const found = problems("print { a: 1 }")[0];

    expect(found?.code).toBe("VN5007");
    expect(found?.help).toContain("print ({ a: 1 })");
  });

  /**
   * The other way to write the same empty line: a verb may be called with no
   * arguments, so `print match x { … }` is two statements, a `print` with
   * nothing and a `match` nobody reads.
   */
  it("says so when the value became a statement of its own", () => {
    const found = problems("const x = 1", "print match x {", "  1 => 2", "}")[0];

    expect(found?.code).toBe("VN5007");
    expect(found?.help).toContain("const said =");
  });

  it("says it of the other prelude verbs whose job is what they are handed", () => {
    expect(codes("log { a: 1 }")).toEqual(["VN5007"]);
    expect(codes("skip { why: 1 }")).toEqual(["VN5007"]);
  });

  /**
   * `fail` reads its own `{ code, data }`, informally rather than through a
   * schema, so it is the one prelude verb this does not reach.
   */
  it("says nothing about fail, which reads its own options", () => {
    expect(codes('fail { code: "x.broke" }')).toEqual([]);
  });

  /**
   * A plugin verb is no different: `kit.whisper` declares no options schema
   * either, so a bare `{ … }` after it is swallowed exactly as `print`'s is.
   */
  it("says so of a plugin verb with no options schema", () => {
    const found = problems('import { kit } from "@t/kit"', "kit.whisper { a: 1 }")[0];

    expect(found?.code).toBe("VN5007");
    expect(found?.help).toContain("kit.whisper ({ a: 1 })");
  });

  /** Short enough to write out, so the suggestion carries it. */
  it("writes out what follows when it fits on the line", () => {
    const found = problems("fragment f() {", "  print 1", "}", "print run f()")[0];

    expect(found?.help).toContain("const said = run f()");
  });

  it("says it inside a step as well as at the top of a file", () => {
    const lines = ['flow "F" {', '  step "s" {', "    print { a: 1 }", "  }", "}"];

    expect(codes(...lines)).toEqual(["VN5007"]);
  });

  it("says nothing about a verb given something to work on", () => {
    expect(codes('print "hello"')).toEqual([]);
    expect(codes("const x = 1", "print x")).toEqual([]);
  });

  /** A verb whose whole input is options declared a schema for them. */
  it("says nothing about a plugin verb with an options schema", () => {
    expect(codes('import { kit } from "@t/kit"', "kit.shout { loudly: true }")).toEqual([]);
  });

  /** On its own line it is an empty line somebody wanted. */
  it("says nothing about a print with nothing after it", () => {
    expect(codes("print", 'print "next"')).toEqual([]);
  });
});

describe("a key written twice in one map", () => {
  it("says which one wins", () => {
    const found = problems("const m = { a: 1, a: 2 }", "print m")[0];

    expect(found?.code).toBe("VN5003");
    expect(found?.title).toContain("the second one wins");
  });

  it("says nothing about two keys that merely look alike", () => {
    expect(codes("const m = { a: 1, ab: 2 }", "print m")).toEqual([]);
  });

  it("says so for a key written in quotes", () => {
    expect(codes('const m = { "a": 1, a: 2 }', "print m")).toEqual(["VN5003"]);
  });

  /** A spread has no key of its own, so it repeats nothing. */
  it("says nothing about a map poured into another", () => {
    expect(codes("const one = { a: 1 }", "const m = { ...one, b: 2 }", "print m")).toEqual([]);
  });

  it("says nothing about the same key in two maps", () => {
    expect(codes("const m = { a: 1 }", "const n = { a: 2 }", "print m", "print n")).toEqual([]);
  });
});

describe("an event nothing will fire", () => {
  it("says there is no such one, and lists the ones there are", () => {
    const found = problems("on banana {", '  print "x"', "}")[0];

    expect(found?.code).toBe("VN5004");
    expect(found?.help).toContain("failure");
  });

  it("offers the one that was nearly written", () => {
    expect(problems("on failur {", '  print "x"', "}")[0]?.help).toContain("on failure");
  });

  it("says nothing about the events a run has", () => {
    expect(codes("on failure {", '  print "x"', "}")).toEqual([]);
    expect(codes("on success {", '  print "x"', "}")).toEqual([]);
  });
});

/**
 * Untidy rather than wrong, so a hint: a check that fails on it is a check
 * people stop running.
 */
describe("a name brought in and never read", () => {
  it("is a hint, not an error", () => {
    const found = problems('import { kit } from "@t/kit"', 'print "hi"')[0];

    expect(found?.code).toBe("VN5005");
    expect(found?.severity).toBe("hint");
  });

  it("says nothing about a namespace used as a verb", () => {
    expect(codes('import { kit } from "@t/kit"', "kit.shout")).toEqual([]);
  });

  it("says nothing about a matcher used after expect", () => {
    const lines = [
      'import { louder } from "@t/kit"',
      'flow "f" {',
      '  step "s" { expect 1 louder 1 }',
      "}",
    ];

    expect(codes(...lines)).toEqual([]);
  });

  it("says nothing about a name read inside a placeholder", () => {
    expect(codes('import { kit } from "@t/kit"', 'print "${kit}"')).toEqual([]);
  });

  it("says so for a whole namespace nobody reached into", () => {
    expect(codes('import * as kit from "./other.vn"', 'print "hi"')).toEqual(["VN5005"]);
  });

  it("says nothing about a whole namespace that was reached into", () => {
    expect(codes('import * as kit from "./other.vn"', "print kit.thing")).toEqual([]);
  });

  it("says nothing about a name a pub import hands on", () => {
    expect(codes('pub import { kit } from "@t/kit"')).toEqual([]);
  });
});

/**
 * `capture`, which is `let` under an older name.
 *
 * It keeps its rule in the grammar so that it reaches this message rather than
 * a parse error about a token nobody expected.
 */
describe("a word the language used to have", () => {
  it("says what became of `capture`, and what to write", () => {
    const found = problems("capture x = 1", "print x")[0];

    expect(found?.code).toBe("VN5001");
    expect(found?.title).toContain("use `let` for a value that changes");
  });
});

/**
 * `{ concurrency: n }` on a `forEach` written inside a `fn`.
 *
 * A pure body cannot run a pass out of order, so the option is powerless
 * there, and silently doing nothing is not an answer a reader can see.
 */
describe("concurrency asked of a pure body", () => {
  it("says a fn runs one pass at a time", () => {
    const lines = [
      "fn walk(xs) {",
      "  forEach x in xs { concurrency: 4 } {",
      "  }",
      "  return true",
      "}",
      "print walk([1, 2])",
    ];
    const found = problems(...lines)[0];

    expect(found?.code).toBe("VN5008");
    expect(found?.title).toContain("one pass at a time");
    expect(found?.help).toContain("fragment");
  });

  it("says nothing about the same option at the top of a file", () => {
    const lines = ["forEach x in [1, 2] { concurrency: 4 } {", "  print x", "}"];

    expect(codes(...lines)).toEqual([]);
  });

  /** A map key may be written as a quoted string, and it is the same key. */
  it("finds the option however the key was spelled", () => {
    const lines = [
      "fn walk(xs) {",
      '  forEach x in xs { "concurrency": 4 } {',
      "  }",
      "  return true",
      "}",
      "print walk([1, 2])",
    ];

    expect(codes(...lines)).toEqual(["VN5008"]);
  });

  it("says nothing about the same option inside a step", () => {
    const lines = [
      'flow "F" {',
      '  step "s" {',
      "    forEach x in [1, 2] { concurrency: 4 } {",
      "      print x",
      "    }",
      "  }",
      "}",
    ];

    expect(codes(...lines)).toEqual([]);
  });

  it("says nothing about a forEach in a fn that asks nothing of it", () => {
    const lines = [
      "fn walk(xs) {",
      "  forEach x in xs {",
      "  }",
      "  return true",
      "}",
      "print walk([1])",
    ];

    expect(codes(...lines)).toEqual([]);
  });
});

/** A hint under an error is a hint nobody reads first. */
describe("the order they are reported in", () => {
  it("puts what stops the run before what merely reads badly", () => {
    const found = codes('import { kit } from "@t/kit"', "on banana {", '  print "x"', "}");

    expect(found).toEqual(["VN5004", "VN5005"]);
  });
});
