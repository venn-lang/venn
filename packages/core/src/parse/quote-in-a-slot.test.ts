// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test.
import { describe, expect, it } from "vitest";
import { parse } from "./index.js";

/** Every problem a source earns, as the line a reader would see it on. */
function said(source: string): string[] {
  return parse(source).problems.map(
    (problem) => `${problem.code} ${problem.title}${problem.help ? ` | ${problem.help}` : ""}`,
  );
}

/** What a double-quoted string cut short reports, bar the rewrite it ends with. */
const DOUBLE =
  'VN1004 The string ends at this `"`, in the middle of a `${…}`. | ' +
  "A `${…}` inside a double-quoted string writes its own strings with single quotes";

/** The same for a single-quoted one, where the answer is the other quote. */
const SINGLE =
  "VN1004 The string ends at this `'`, in the middle of a `${…}`. | " +
  "A `${…}` inside a single-quoted string writes its own strings with double quotes";

/** Where a worked example starts, in a help line that troubled to work one out. */
const EXAMPLE = "quotes: `";

/** One place a string is written, and the whole line a quote inside it earns. */
interface Cut {
  readonly name: string;
  readonly source: string;
  readonly line: string;
  /**
   * The source with the help's own worked example put back into it.
   *
   * A help line is a claim, so it is tested as one: the spelling is asserted to
   * compile rather than read well. Absent only where the help declines to work
   * an example out, since there it claims nothing to hold it to.
   */
  readonly fixed?: string;
}

/** A source the scan has to stay silent about, and the reason it is tempting. */
interface Quiet {
  readonly name: string;
  readonly source: string;
}

/**
 * Every place a string is written that a quote inside its own `${…}` can end.
 *
 * A `"""` block is the one that cannot, since `BLOCK_STRING` closes on three
 * quotes, so it sits in the quiet table below and its absence is asserted
 * rather than assumed. The rewrite each row expects is the reader's own
 * placeholder with its quotes swapped, and every one of them was run before it
 * was written down here: they print `core: 1`, `a x` and `    3` respectively.
 */
const CUT_SHORT: readonly Cut[] = [
  {
    name: "a double-quoted string, which is issue #311 itself",
    source: 'const m = { core: 1 }\nprint "core: ${m["core"]}"',
    line: `${DOUBLE}: \`\${m['core']}\`.`,
    fixed: "const m = { core: 1 }\nprint \"core: ${m['core']}\"",
  },
  {
    name: "a raw string, which one quote closes just as it does an ordinary one",
    source: 'const m = { core: 1 }\nprint r"core: ${m["core"]}"',
    line: `${DOUBLE}: \`\${m['core']}\`.`,
    fixed: "const m = { core: 1 }\nprint r\"core: ${m['core']}\"",
  },
  {
    name: "a step title, where the wreckage used to be three missing braces",
    source: 'const m = { core: 1 }\nflow "F" { step "core: ${m["core"]}" { print 1 } }',
    line: `${DOUBLE}: \`\${m['core']}\`.`,
    fixed: 'const m = { core: 1 }\nflow "F" { step "core: ${m[\'core\']}" { print 1 } }',
  },
  {
    name: "a single-quoted string, where the answer is the other quote",
    source: "const m = { core: 1 }\nprint 'core: ${m['core']}'",
    line: `${SINGLE}: \`\${m["core"]}\`.`,
    fixed: `const m = { core: 1 }\nprint 'core: \${m["core"]}'`,
  },
  {
    name: "a placeholder holding a string of its own, which lexed a bare `$`",
    source: 'const r = { month: 3 }\nprint "${"${r.month}".padStart(5)}"',
    line: `${DOUBLE}: \`\${'\${r.month}'.padStart(5)}\`.`,
    fixed: "const r = { month: 3 }\nprint \"${'${r.month}'.padStart(5)}\"",
  },
  {
    name: "a call written in the placeholder, not only an index",
    source: 'fn f(x) => x\nprint "a ${f("x")}"',
    line: `${DOUBLE}: \`\${f('x')}\`.`,
    fixed: "fn f(x) => x\nprint \"a ${f('x')}\"",
  },
  {
    name: "a placeholder already holding both quotes, which is named without an example",
    source: 'print "a ${m["it\'s"]}"',
    line: `${DOUBLE}.`,
  },
  {
    name: "a placeholder holding an escaped quote, where swapping would change the key",
    source: 'print "k ${m["a\\"b"]}"',
    line: `${DOUBLE}.`,
  },
];

/**
 * What the scan must not touch.
 *
 * The spellings that work are here beside the mistakes, because a diagnostic
 * that refuses the answer it just gave is worse than the silence it replaced. A
 * `${` a reader meant as text stays text: it interpolates nothing today, that
 * is written down in `scanInterpolations`, and an error there would refuse
 * programs that run. Two delimiters before the placeholder's `}` are what tell
 * the two apart, and a newline in between says the same from the other side.
 */
const LEFT_ALONE: readonly Quiet[] = [
  { name: "the single-quote spelling, which is the whole answer", source: "print \"a ${m['k']}\"" },
  { name: "a raw string spelled the working way", source: "print r\"a ${m['k']}\"" },
  { name: "a single-quoted string spelled the working way", source: `print 'a \${m["k"]}'` },
  {
    name: "a step title spelled the working way",
    source: 'flow "F" { step "a ${m[\'k\']}" { print 1 } }',
  },
  {
    name: "a nested placeholder spelled the working way",
    source: "print \"${'${r.month}'.padStart(5)}\"",
  },
  { name: "a placeholder holding no string at all", source: 'print "a ${x} b ${y.z} c"' },
  { name: "a block string, which one quote cannot close", source: 'print """a ${m["k"]}"""' },
  { name: "a `${` meant as text, which prints itself", source: 'print "price ${"' },
  { name: "the brace of the map around it", source: 'const m = { a: "x ${y" }' },
  { name: "a quote on the line below", source: 'print "a ${b"\nprint "c}"' },
  { name: "an escaped quote in a plain string", source: 'print "say \\"hi\\" now ${x}"' },
  { name: "a `#` inside a string, which is text and not a comment", source: 'print "# ${x} #"' },
  { name: "a `${` written in a comment", source: '# print "a ${m["k"]}"\nprint 1' },
];

/**
 * Issue #311. A double-quoted key inside a `${…}` ends the string, and until
 * this the failure invented a name: `VN2018 · Nothing is named "core" here.`,
 * a good sentence about a mistake nobody made, whose advice was to bind a
 * constant the reader did not need.
 */
describe("a quote written inside a `${…}` of the string that holds it", () => {
  it.each(CUT_SHORT)("is named as the end of the string in $name", ({ source, line }) => {
    expect(said(source)).toEqual([line]);
  });

  it("points at the quote itself, not at whatever the parser made of the rest", () => {
    const found = parse('const m = { core: 1 }\nprint "core: ${m["core"]}"').problems;
    expect(found.map((one) => `${one.span.line}:${one.span.column}`)).toEqual(["2:18"]);
  });

  it("reports every placeholder a quote cut short, not just the first", () => {
    const both = [`${DOUBLE}: \`\${m['x']}\`.`, `${DOUBLE}: \`\${m['y']}\`.`];
    expect(said('print "a ${m["x"]} b ${m["y"]} c"')).toEqual(both);
  });
});

describe("a string no quote cut short", () => {
  it.each(LEFT_ALONE)("says nothing about $name", ({ source }) => {
    expect(said(source)).toEqual([]);
  });
});

/**
 * A help line is a claim, and it is tested as one.
 *
 * Running a suggestion proves the spelling exists. It does not prove the
 * spelling still says what the reader said: swapping every quote in
 * `${m["a\"b"]}` gives a program that runs perfectly and reads a different key.
 * So the worked example is put back into the source that earned it, and the
 * repaired program is required to report nothing, which parsing is not.
 */
describe("the spelling the help hands back", () => {
  const worked = CUT_SHORT.filter((one) => one.line.includes(EXAMPLE));

  it.each(worked)("is in the repaired source and reports nothing, for $name", (one) => {
    expect(one.fixed).toContain(one.line.slice(one.line.indexOf(EXAMPLE) + EXAMPLE.length, -2));
    expect(said(one.fixed as string)).toEqual([]);
  });

  /** No row may add a worked example without pinning the program it repairs. */
  it("is pinned for every row whose help works one out", () => {
    expect(worked.filter((one) => !one.fixed).map((one) => one.name)).toEqual([]);
  });
});
