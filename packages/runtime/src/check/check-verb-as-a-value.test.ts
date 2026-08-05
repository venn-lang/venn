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
  namespace: "kit",
  actions: [defineAction({ name: "fetch", run: () => 1 })],
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
 * `examples/servers/01-hello.vn` and six others hand a verb two bare names in a
 * row, and the whole point of the rule is that this keeps working.
 */
const HANDLER = "const api = 1\nfn route(req) => req\nprint api route";

/** The six the language carries out rather than reads. `PRELUDE` holds exactly these. */
const VERBS = ["exit", "fail", "log", "print", "skip", "wait"];

/**
 * The merge. `(args+=ActionArg)*` has no terminator, so a missing separator
 * between two calls does not fail: the second verb becomes an argument to the
 * first, reads as null, and the program runs and is wrong. Every row here was
 * measured on the built CLI before the check existed, and every one of them
 * said "no problems found".
 */
describe("two statements with nothing between them", () => {
  const MERGED = [
    { how: "a verb between two values", source: "print 1 print 2", run: "1 null 2" },
    { how: "a verb as the only argument", source: "print print", run: "null" },
    { how: "a verb at the end", source: "print 1 print", run: "1 null" },
    { how: "a namespace between two values", source: `${IMPORT}print 1 kit 2`, run: "1 {…} 2" },
    {
      how: "a verb inside a step",
      source: 'flow "F" {\n  step "s" {\n    print "a" fail "b"\n  }\n}',
    },
    { how: "a verb after a bracketed call", source: "print(1) print 2" },
    { how: "a verb after a bound value", source: "const one = 1\nprint one print 2" },
    { how: "a verb swallowed by a let", source: "const a = 1 print 2" },
  ];

  for (const merged of MERGED) {
    it(`is reported for ${merged.how}`, () => {
      expect(codes(merged.source)).toContain("VN2027");
    });
  }

  it("names the separator that is missing, not only the word", () => {
    expect(said("print 1 print 2")).toEqual([
      "`print` is an action, not a value, so this line is read as one statement. " +
        "Put a `;` or a newline before `print` to start the next statement.",
    ]);
  });

  /** The squiggle goes where the `;` goes: immediately before the swallowed word. */
  it("is reported at the swallowed word, which is where the separator goes", () => {
    const [found] = problems("print 1 print 2");

    expect(`${found?.span.line}:${found?.span.column}`).toBe("1:9");
  });

  it("calls a namespace a namespace, since it is not a verb", () => {
    expect(said(`${IMPORT}print 1 kit 2`)).toEqual([
      "`kit` is a namespace, not a value, so this line is read as one statement. " +
        "Put a `;` or a newline before `kit` to start the next statement.",
    ]);
  });

  /** One report per merge, and two merges on one line are two reports. */
  it("says it once per swallowed word", () => {
    expect(codes("print 1 print 2 print 3")).toEqual(["VN2027", "VN2027"]);
  });

  /** The whole point: the same line with the separator written is not a problem. */
  it("is silent once the separator its help asks for is there", () => {
    expect(codes("print 1; print 2")).toEqual([]);
    expect(codes("print 1\nprint 2")).toEqual([]);
  });
});

/**
 * The quieter half. Nothing is merged, so no separator is missing; the name is
 * simply not a value, and binding it binds null.
 */
describe("a verb read where a value is wanted", () => {
  it("is reported for a binding whose whole value is a verb", () => {
    expect(codes("const a = print\nprint a")).toEqual(["VN2027"]);
  });

  it("says that reading it answers nothing, and where the verb belongs", () => {
    expect(said("const a = print\nprint a")).toEqual([
      "`print` is an action, not a value, and reading one answers nothing. " +
        "An action is carried out, not read: `print` goes on a line of its own, " +
        "with its arguments after it.",
    ]);
  });
});

/**
 * The worse half, and the one that reached a run. Brackets in a value position
 * do not carry a verb out: they read it as a value, which is `null`, and then
 * call that. So `venn check` said "no problems found" and every run of it died
 * with `VN3013 · not a function: null`, for every prelude verb, on every input.
 *
 * It is the same mistake about the same name as the read form, so it is the
 * same sentence, and a test below holds the two to that.
 */
describe("a verb called where a value is wanted", () => {
  it("is reported for every prelude verb, since none of them is a value", () => {
    for (const verb of VERBS) expect(codes(`const a = ${verb}("x")`), verb).toEqual(["VN2027"]);
  });

  it("is the same sentence about the same name, read or called", () => {
    expect(said('const a = print("x")')).toEqual(said("const a = print"));
  });

  it("is reported at the name and not at the brackets", () => {
    const [found] = problems('const a = print("x")');
    expect(`${found?.span.line}:${found?.span.column}`).toBe("1:11");
  });
});

/**
 * The exemptions, each found by parsing every `.vn` under `examples/` and
 * `packages/cli/corpus/` and looking at what really passes a bare verb or a
 * bare namespace name. Getting one of these wrong breaks a working program,
 * which is why each is here on purpose rather than by luck.
 */
describe("what it must not report", () => {
  const FINE = [
    /**
     * `RefName` admits these three as values on purpose, and `env` is bound by
     * the host before anything is imported.
     */
    { how: "matrix, which RefName admits as a value", source: "print matrix" },
    { how: "flow, which RefName admits as a value", source: "print flow" },
    { how: "step, which RefName admits as a value", source: "print step" },
    { how: "env, which the host binds", source: "print env" },
    { how: "matrix swallowing nothing between values", source: "print 1 matrix 2" },
    /**
     * A namespace in member position is what a namespace is for, and the whole
     * stdlib is written this way.
     */
    { how: "a namespace read through a member", source: `${IMPORT}print kit.rate` },
    { how: "a namespace called through a member", source: `${IMPORT}print kit.fetch()` },
    { how: "a namespace as a verb's target", source: `${IMPORT}kit.fetch()` },
    /**
     * `print io` is how a reader finds out what a namespace holds, and it
     * answers the namespace rather than null. Only a trailing argument proves a
     * statement was eaten.
     */
    { how: "a namespace read as a value, swallowing nothing", source: `${IMPORT}print kit` },
    { how: "a namespace bound to a name", source: `${IMPORT}const it = kit\nprint it` },
    /**
     * `packages/cli/corpus/045-a-let-carrying-a-prelude-verb.vn`: a `let` with
     * trailing arguments is the verb being called, not the verb being read.
     */
    {
      how: "a let carrying a prelude verb, which is a call",
      source: 'let stop = fail "the guard"',
    },
    { how: "a let carrying a verb with options", source: "let waited = wait 1ms" },
    /**
     * A prelude VALUE is a value, and every one of these is a native function
     * meant to be called exactly like this. `PRELUDE` holds only the six verbs,
     * which is what keeps the rule off them.
     */
    { how: "a prelude value called for its result", source: "const a = range(3)\nprint a" },
    { how: "str called for its result", source: "const a = str(1)\nprint a" },
    { how: "regex called for its result", source: 'const a = regex("a")\nprint a' },
    { how: "spawn called for its result", source: "const a = spawn(fn () => 1)\nprint a" },
    /** A name the file declares wins, whatever the prelude calls the same word. */
    {
      how: "a fn of the file's own that shadows a verb",
      source: "fn fail() => 1\nconst a = fail()",
    },
    { how: "a fn of the file's own, called", source: "fn twice(n) => n * 2\nconst a = twice(2)" },
    /**
     * A namespace called as a function is broken too, but it is a different
     * sentence about a different kind of name, and nothing in this rule claims
     * it. Held here so that widening it later is a deliberate change.
     */
    {
      how: "a namespace called as a function, which is somebody else's",
      source: `${IMPORT}const a = kit("x")`,
    },
    /**
     * `examples/servers/02-routing.vn` binds `path`, which is also a namespace
     * the stdlib publishes. A binding wins, exactly as it does when it runs.
     */
    { how: "a binding that shadows a namespace", source: "const kit = 1\nprint 2 kit 3" },
    { how: "a parameter that shadows a namespace", source: "fn f(kit) => kit\nprint f(1)" },
    { how: "a fn that shadows a namespace", source: "fn kit() => 1\nprint 2 kit() 3" },
    /**
     * `examples/servers/01-hello.vn` and six others write `http.on api route`,
     * two bare names that are both bound in the file.
     */
    { how: "two bare arguments that are both bound", source: HANDLER },
    /** A prelude value is a value: `range`, `str`, `regex`, `spawn` and friends. */
    { how: "a prelude value read as a value", source: "print range(3)" },
    { how: "a prelude value passed bare", source: "print 1 range 2" },
    /** The verb in target position is the verb being carried out, which is fine. */
    { how: "a verb called with arguments", source: 'print "a"' },
    { how: "a verb called with brackets", source: "print()" },
    { how: "a verb with nothing at all", source: "print" },
  ];

  for (const fine of FINE) {
    it(`stays quiet for ${fine.how}`, () => {
      expect(codes(fine.source)).toEqual([]);
    });
  }
});
