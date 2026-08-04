import { fc, test } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { parse } from "./index.js";
import { saidLexerError } from "./said-error.js";

/**
 * Sources that parse, which is what a file looks like a keystroke before it
 * stops parsing. Every mutation below is applied to one of these.
 */
const SOURCES = [
  'module demo\nimport { http } from "venn/http"\n\nflow "Hello" {\n  step "Ping" {\n    http.get "https://example.com"\n    expect res.status == 200\n  }\n}\n',
  'flow "F" {\n  step "s" {\n    print 1\n  }\n}\n',
  "fn double(x) => x * 2\nconst four = double(2)\n",
  'const plan = { name: "pro", seats: 3 }\nprint plan.name\n',
  'const said = match 404 {\n  200 => "ok"\n  -1 => "gone"\n  other => "?"\n}\n',
  "namespace cart {\n  pub const empty = []\n}\n",
  'fragment login(user) {\n  step "in" { print user }\n}\n',
  "const xs = [1, 2, 3]\nforEach x in xs {\n  print x\n}\n",
  "try {\n  print 1\n} catch e {\n  print e\n}\n",
  "loop total = 0 {\n  if total >= 6 { break }\n  continue total + 2\n}\n",
];

/** Written into a source to break it: brackets, operators, keywords, a BOM. */
const WRITTEN = [
  "@",
  "=",
  "(",
  ")",
  "{",
  "}",
  "[",
  "]",
  "-",
  "+",
  ",",
  ":",
  ".",
  '"',
  "'",
  "#",
  "\ufeff",
  "while",
  "import",
  "constructor",
  "toString",
  "__proto__",
  "loop",
  "in",
];

/**
 * A title is one line, and short enough to read.
 *
 * The parser's own words for one alternation ran to 180 lines and 3573
 * characters, and that string was the title: the CLI wrote all 181 lines to
 * stderr, the editor published the same string as one Diagnostic, and the
 * ndjson stream carried it to whatever reads that. A title says one thing about
 * one place, and nothing that comes out of a parser generator gets to decide
 * how long that is.
 */
const LONGEST = 200;

describe("what a problem's first line is", () => {
  /** Every problem a source reports, whichever check reported it. */
  function titles(source: string): string[] {
    return parse(source).problems.map((problem) => problem.title);
  }

  /**
   * One line and inside the bound was the ask, and it was not the mistake. A
   * decorator takes a bracketed argument, and the report never mentioned the
   * `@timeout` the number belonged to: it listed what a statement could have
   * begun with, which is what the parser was looking for and not what anybody
   * wrote.
   */
  it("names the decorator the value belonged to", () => {
    const said = titles('flow "F" {\n  @timeout 50ms\n  step "s" { print 1 }\n}\n');

    expect(said).toEqual(["A decorator takes its argument in brackets: write `@timeout(50ms)`."]);
  });

  /**
   * The alternation the parser writes an essay about, said as one line.
   *
   * It used to end `or one of 25 other things`, a count of the branches it
   * declined to name. That is the parser's own bookkeeping: the file has no 25
   * of anything in it, and nobody reading the line can act on the number.
   */
  it("names what could have gone here without counting the rest", () => {
    const said = titles("const x = \u00a7\n");

    expect(said[1]).toBe("Expected `try`, `!` or `-` here, found the end of the line.");
  });

  it("never leaves the parser's own words in a title", () => {
    for (const source of SOURCES) {
      for (const said of titles(`${source}\n@`)) {
        expect(said, source).not.toContain("Expecting");
        expect(said, source).not.toContain("Token sequences");
        expect(said, source).not.toContain("at offset");
      }
    }
  });

  test.prop([fc.nat(), fc.nat(), fc.constantFrom(...WRITTEN)])(
    "is one line of bounded length for anything written into a source",
    (which, where, written) => {
      const source = SOURCES[which % SOURCES.length] as string;
      const at = where % (source.length + 1);
      for (const said of titles(source.slice(0, at) + written + source.slice(at))) {
        expect(said.includes("\n"), said).toBe(false);
        expect(said.length, said).toBeLessThanOrEqual(LONGEST);
      }
    },
  );

  test.prop([fc.nat(), fc.nat()])(
    "is one line of bounded length for anything cut out of a source",
    (which, where) => {
      const source = SOURCES[which % SOURCES.length] as string;
      const at = where % source.length;
      for (const said of titles(source.slice(0, at) + source.slice(at + 1))) {
        expect(said.includes("\n"), said).toBe(false);
        expect(said.length, said).toBeLessThanOrEqual(LONGEST);
      }
    },
  );
});

/**
 * The vendor's messages are matched by shape, so the day one of them changes
 * shape the fallback is what a user reads.
 *
 * Both patterns here are Chevrotain's wording, not a contract it owes us, and a
 * lexer upgrade is exactly the change that would slip a raw sentence back into
 * a title without any test noticing. This is the guarantee that it cannot: an
 * unrecognised message is still one line in the product's voice, and never the
 * message itself.
 */
describe("a lexer message nobody recognises", () => {
  it("is still said in the language's own voice", () => {
    const said = saidLexerError("NoViableAltException at 0x1f: expected TK_LBRACE, got EOF");

    expect(said).toBe("Venn cannot read this part of the file.");
  });

  it("still names the character and the bracket it does recognise", () => {
    expect(saidLexerError("unexpected character: ->§<- at offset: 18")).toContain("`§`");
    expect(saidLexerError("unclosed bracket: ->(<- at offset: 10")).toContain("never closed");
  });
});
