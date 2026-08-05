// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test.
import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Every problem a source earns, as `CODE title` plus the help under it. */
function said(source: string): string[] {
  const { ast, problems } = parse(source);
  const all = [...problems, ...checkTypes(ast).problems];
  return all.map((problem) => `${problem.code} ${problem.title}${help(problem.help)}`);
}

function help(line: string | undefined): string {
  return line ? ` // ${line}` : "";
}

const TITLE = "VN3024 `+` adds numbers; it does not join strings.";
const WAY = "Interpolation is how this language joins strings.";

/**
 * The compiler knew both sides were strings and said the two types instead,
 * twice, and a third time contradicting itself where the result met a string
 * binding. Four positions reached the same mistake and none of them named the
 * one spelling that works.
 *
 * `+` still does not join. The rule was never the defect; the silence was.
 */
describe("`+` between strings", () => {
  it("is one message wherever it is written", () => {
    const positions = ['print "a" + "b"', 'print ("a" + "b")', 'let problem = "a" + "b"'];

    for (const source of positions) {
      expect(said(source), source).toEqual([`${TITLE} // ${WAY} Write \`"ab"\`.`]);
    }
  });

  /**
   * A `${…}` is already inside a string, so the answer there is the same text
   * without the quotes. Offering `"ab"` would be offering a quote inside a
   * placeholder, which is VN1004 and would make this help a second wrong fix.
   */
  it("is the same message inside a placeholder, without the quotes", () => {
    expect(said("const s = \"${'a' + 'b'}\"")).toEqual([
      `${TITLE} // ${WAY} Write \`ab\` in place of the \`\${…}\`.`,
    ]);
  });

  it("hands back the reader's own line, joined", () => {
    expect(said('let problem = "unknown option: " + "x"')[0]).toContain(
      'Write `"unknown option: x"`',
    );
    expect(said('let a = "x"\nlet b = "y"\nlet both = a + b')[0]).toContain('Write `"${a}${b}"`');
    expect(said('let n = 1\nlet line = "total: " + n')[0]).toContain('Write `"total: ${n}"`');
  });

  /**
   * The claim the help line makes, asserted rather than read.
   *
   * A help line promises a program, so the test is the repaired program and not
   * the sentence: every spelling offered above is written back here in the
   * position that earned it, and has to check clean. Reading the words proves
   * only that the words are spellable.
   */
  it("offers rewrites that check clean where they were offered", () => {
    const repaired = [
      'let problem = "unknown option: x"',
      'let a = "x"\nlet b = "y"\nlet both = "${a}${b}"',
      'let n = 1\nlet line = "total: ${n}"',
      'let s = "abc"',
      'const s = "ab"',
      'let problem: string = "ab"',
    ];

    for (const source of repaired) expect(said(source), source).toEqual([]);
  });

  /** One mistake written twice is still one mistake, and the outer `+` sees it all. */
  it("says it once for a whole chain", () => {
    expect(said('let s = "a" + "b" + "c"')).toEqual([`${TITLE} // ${WAY} Write \`"abc"\`.`]);
    expect(said('let s = "a" + ("b" + "c")')).toHaveLength(1);
  });

  /**
   * The third line was the worst of the three: the `+` answered `number`, the
   * binding wanted a string, and the reader was told the opposite of the two
   * lines above it about the same column.
   */
  it("does not then tell the binding the opposite", () => {
    expect(said('let problem: string = "a" + "b"')).toEqual([`${TITLE} // ${WAY} Write \`"ab"\`.`]);
  });

  it("leaves arithmetic alone", () => {
    expect(said("let n = 1 + 2")).toEqual([]);
    expect(said("let n = 300ms + 1s")).toEqual([]);
  });

  /** A `-` between strings is not a reach for concatenation, and never was. */
  it("leaves the other operators saying what they said", () => {
    expect(said('let n = "a" - 1')[0]).toContain("VN3010");
  });

  it("says nothing about a `+` on a value it cannot place", () => {
    expect(said("fn twice(x) => x + x")).toEqual([]);
  });
});
