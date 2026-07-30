// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test.
import { describe, expect, it } from "vitest";
import { parse } from "./index.js";

/** Every string literal in a source, as the value the compiler will see. */
function values(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const found: string[] = [];
  (function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const it = node as Record<string, unknown> & { $type?: string; value?: unknown };
    if (it.$type === "StringLit") found.push(String(it.value));
    for (const [key, child] of Object.entries(it)) {
      if (key.startsWith("$")) continue;
      if (Array.isArray(child)) child.forEach(walk);
      else walk(child);
    }
  })(ast);
  return found;
}

describe("the string forms the specification promises", () => {
  it("reads an ordinary string, escapes and all", () => {
    expect(values('print "a\\tb"')).toEqual(["a\tb"]);
  });

  /**
   * The point of a raw string: a Windows path and a pattern are the two places
   * where escaping every backslash is the whole cost of writing it down.
   */
  it("keeps every backslash in a raw string", () => {
    expect(values('print r"C:\\raw\\no\\escape"')).toEqual(["C:\\raw\\no\\escape"]);
  });

  it("keeps a pattern's backslashes, which is what `~=` reads", () => {
    expect(values('print r"Order #(\\d+)"')).toEqual(["Order #(\\d+)"]);
  });

  it("keeps the newlines inside a block", () => {
    expect(values('print """\n  two\n  lines\n"""')).toEqual(["\n  two\n  lines\n"]);
  });

  it("reads a block written on one line", () => {
    expect(values('print """just this"""')).toEqual(["just this"]);
  });

  /** A quote inside a block needs no escape, which is most of the point. */
  it("takes a quote inside a block as itself", () => {
    expect(values('print """say "hello" here"""')).toEqual(['say "hello" here']);
  });

  /** A backslash before something that is not an escape stays as it was. */
  it("leaves an escape it does not know alone", () => {
    expect(values('print """a \\q b"""')).toEqual(["a \\q b"]);
  });

  it("still honours an escape inside a block", () => {
    expect(values('print """say \\"hello\\" here"""')).toEqual(['say "hello" here']);
    expect(values('print """tab\there"""')).toEqual(["tab	here"]);
  });

  /**
   * A block cannot end with a quote: `"""a\""""` is four quotes in a row and the
   * closing delimiter is found early. Python draws the line in the same place,
   * and the way round it is the same: put anything after it, or a space.
   */
  it("refuses a block that ends with a quote", () => {
    const { problems } = parse('print """say \\"hello\\""""');

    expect(problems.length).toBeGreaterThan(0);
  });

  it("leaves the placeholders in all three for the compiler to fill", () => {
    const source = 'print "a ${x}"\nprint r"b ${x}"\nprint """c ${x}"""';

    expect(values(source)).toEqual(["a ${x}", "b ${x}", "c ${x}"]);
  });

  it("reads an empty one of each", () => {
    expect(values('print ""\nprint r""\nprint """"""')).toEqual(["", "", ""]);
  });

  /** `"""` must not lex as two empty strings, which is why the order matters. */
  it("does not read a block as two strings", () => {
    expect(values('print """a"""')).toEqual(["a"]);
  });

  it("still reads a single-quoted string", () => {
    expect(values("print 'single'")).toEqual(["single"]);
  });
});
