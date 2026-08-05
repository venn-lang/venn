import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import type { Diagnostic } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

async function diagnostics(
  source: string,
  modules: Record<string, string> = {},
): Promise<Diagnostic[]> {
  const { document } = await fixture(source, modules);
  return [...(document.diagnostics ?? [])];
}

/** `1` is Error, `2` Warning, `3` Information, `4` Hint, in the protocol's own order. */
const ERROR = 1;
const HINT = 4;

const NEWLINE = String.fromCharCode(10);
const lines = (...parts: readonly string[]): string => parts.join(NEWLINE);

/**
 * The editor used to see a narrower language than the CLI, in five directions
 * at once, because it assembled its own analysis rather than reusing the one
 * `venn check` runs. It calls the shared front end now, and these are the
 * differences that closing that gap was for.
 */
describe("what the editor reports", () => {
  /**
   * The validator built a registry and passed it to one pass and not the other,
   * so the note that tells you what to write instead, which is the most useful
   * thing the check produces, never reached the one surface people read.
   */
  it("names a verb an import asked for as though it were a value", async () => {
    const found = await diagnostics(lines('import { get } from "venn/http"', "print get"));
    const said = found.find((one) => one.code === "VN2009");

    expect(said?.message).toContain("does not publish get");
    expect(said?.message).toContain("import `{ http }` and write `http.get`");
  });

  /**
   * `VN5005` is declared a hint because an import nobody used is untidy rather
   * than wrong, and `venn check` exits 0 on it. Every diagnostic used to arrive
   * as an Error, so the editor was red where CI was green.
   */
  it("keeps the severity the catalogue declared", async () => {
    const found = await diagnostics(lines('import { json } from "venn/json"', 'print "hi"'));

    expect(found.map((one) => [one.code, one.severity])).toEqual([["VN5005", HINT]]);
  });

  it("still reports a name resolution failure as an error", async () => {
    const found = await diagnostics(lines('flow "F" {', '  step "s" { nope.doThing }', "}"));

    expect(found.map((one) => one.severity)).toEqual([ERROR]);
  });

  /** The span and the label a client renders as a jump to the other declaration. */
  it("carries the other place a problem is about", async () => {
    const found = await diagnostics(lines("const thing = 1", "const thing = 2", 'print "x"'));
    const said = found.find((one) => one.code === "VN2020");

    expect(said?.relatedInformation?.[0]?.message).toContain("bound here");
  });

  /**
   * The type pass composed only half of what a package publishes: the derived
   * half, read from `target/`, and not the values a plugin publishes in code.
   */
  it("types a value a plugin publishes", async () => {
    const found = await diagnostics(lines('import { pi } from "venn/math"', "print pi.upper"));

    expect(found.map((one) => one.code)).toContain("VN3010");
  });

  /** The position, which was the wrapper's rather than the file's. */
  it("puts an error inside a placeholder on the placeholder", async () => {
    const found = await diagnostics(lines("const xs = [1, 2, 3]", 'print "n=${xs.length}"'));
    const said = found.find((one) => one.code === "VN3010");

    expect(said?.range.start).toEqual({ line: 1, character: 11 });
  });

  /**
   * A syntax error, which is what the editor was still publishing Chevrotain's
   * own words for.
   *
   * The fix for issue #282 went into `parse`, so `venn check` and the ndjson
   * stream were clean and the editor was not: Langium's default validator reads
   * `parseResult.lexerErrors` and `parseResult.parserErrors` and publishes each
   * `message` verbatim. One of them ran to 188 lines and 3751 characters, every
   * one of them named a token type, a byte offset or the recovery strategy it
   * chose, and every one arrived with no code at all, so no VN code reached the
   * editor for any syntax error in the language.
   */
  describe("a file that does not parse", () => {
    /** A title is one line about somebody's file, and short enough to read. */
    const LONGEST = 200;

    const probes: readonly (readonly [string, string])[] = [
      [
        "a decorator argument",
        lines('flow "F" {', "  @timeout 50ms", '  step "s" { print 1 }', "}"),
      ],
      ["a keyword where a name goes", "let in = 1"],
      ["a character the lexer refuses", "const x = \u00a7"],
      ["a bracket nobody closed", "print (1"],
      ["a reserved word of another language", 'flow "x" constructor'],
      [
        "an import below the first declaration",
        lines("const a = 1", 'import { one } from "./x.vn"'),
      ],
      [
        "a minus a pattern was written apart from",
        lines("const it = match 1 {", "  - 1 => 1", "}"),
      ],
    ];

    for (const [what, source] of probes) {
      it(`says one line with a code for ${what}`, async () => {
        const found = await diagnostics(source);

        expect(found.length, source).toBeGreaterThan(0);
        for (const one of found) {
          const said = String(one.message);
          expect(one.code, said).toMatch(/^VN1\d{3}$/);
          expect(one.severity, said).toBe(ERROR);
          expect(said.includes(NEWLINE), said).toBe(false);
          expect(said.length, said).toBeLessThanOrEqual(LONGEST);
        }
      });

      it(`publishes the very lines the CLI prints for ${what}`, async () => {
        const found = await diagnostics(source);

        expect(found.map((one) => one.message)).toEqual(
          parse(source).problems.map((problem) => problem.title),
        );
      });
    }

    /**
     * The semantic passes read the half a tree recovery managed to build, and
     * published `Cannot read properties of undefined` next to the syntax error
     * they choked on. `venn check` stops at a parse error, and so does this.
     */
    it("says nothing a broken tree made the checks think", async () => {
      const found = await diagnostics('flow "x" constructor');

      expect(found.map((one) => one.message).join(NEWLINE)).not.toContain("An error occurred");
    });

    /**
     * A parse error belongs to the `built-in` category. A builder that asks for
     * the categories in two goes appends the second answer to the first, so
     * answering both would draw every syntax error twice under one squiggle.
     */
    it("draws a syntax error once when the categories run in two passes", async () => {
      const { document, services } = await fixture("let in = 1");
      const validator = services.validation.DocumentValidator;

      const first = await validator.validateDocument(document, { categories: ["built-in"] });
      const rest = await validator.validateDocument(document, { categories: ["fast", "slow"] });

      expect(first).toHaveLength(1);
      expect(rest).toEqual([]);
    });
  });
});

/** What a folder publishes, and the parameter its `deco` adds to what it wraps. */
const LIB = "pub deco inject(target: Fn, name: string) {\n  target.addParam(name)\n}";

/** The decorated body, written expecting the name the `deco` above adds. */
const USES_IT = lines('@inject("who")', 'fn greet() => "hello ${who}"');

const ONE_FILE = { "lib.vn": LIB };
const TWO_FILES = { ...ONE_FILE, "mod.vn": 'pub import { inject } from "./lib.vn"' };

const DIRECT = lines('import { inject } from "./lib.vn"', USES_IT);
const RE_EXPORTED = lines('import { inject } from "./mod.vn"', USES_IT);
const WILDCARD = lines('import * as lib from "./lib.vn"', USES_IT);

/**
 * A `deco` reached through another file.
 *
 * `venn check` walks the whole import graph and takes every `pub deco` on it,
 * so the name `@inject("who")` adds is excused wherever the chain reaches. The
 * editor matched one level of imports against a neighbour's declarations, and
 * neither of the two indirect shapes is one: a `pub import` re-export sits in a
 * file's `imports` and never in its `decls`, and a wildcard names nothing at
 * all. Both lost the `deco`, and the editor drew VN2018 over a parameter the
 * CLI accepted. `mod.vn` re-export is the documented folder interface.
 *
 * The wildcard keeps one answer: the namespace `lib` really is unused, because
 * `@inject` is written by its own name. That hint is `venn check`'s too.
 */
describe("a decorator the editor reaches through another file", () => {
  it("says nothing when it is imported straight", async () => {
    expect(await diagnostics(DIRECT, ONE_FILE)).toEqual([]);
  });

  it("says nothing when it arrives through a `pub import` re-export", async () => {
    expect(await diagnostics(RE_EXPORTED, TWO_FILES)).toEqual([]);
  });

  it("says only that the namespace is unused, through a wildcard", async () => {
    const said = await diagnostics(WILDCARD, ONE_FILE);

    expect(said.map((one) => one.code)).toEqual(["VN5005"]);
  });
});
