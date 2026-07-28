import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import type { Problem } from "../problem/index.js";
import { expand } from "./expand.js";

const URI = "memory://inline.vn";

/**
 * Expand a document against nothing but the decorators it declares itself.
 *
 * No plugin, no built-in: whatever comes back was decided by a signature the
 * source wrote, which is the whole point of the exercise.
 */
function expandOwn(source: string): Problem[] {
  const { ast, problems: syntax } = parse(source);
  expect(syntax).toEqual([]);
  return expand({ document: ast, decorators: { get: () => undefined }, uri: URI }).problems;
}

const MEMOIZE = 'deco memoize(target: Fn) { target.meta "memoized" true }';
const NOTE = 'deco note(target: Fn | Flow) { target.meta "note" true }';
const TAG = 'deco tag(target: Node) { target.meta "tag" true }';

/**
 * What a `deco` decorates comes from the type on its first parameter, so the
 * refusal is written in the words the author used rather than in the names the
 * compiler calls its own nodes.
 */
describe("a deco's target type is the check", () => {
  it("accepts the kind the signature named", () => {
    expect(expandOwn([MEMOIZE, "@memoize", "fn twice(n: number) => n * 2"].join("\n"))).toEqual([]);
  });

  it("refuses another kind, in the user's words and not the tree's", () => {
    const found = expandOwn([MEMOIZE, "@memoize", 'flow "f" { }'].join("\n"));

    expect(found).toHaveLength(1);
    expect(found[0]?.code).toBe("VN2014");
    expect(found[0]?.title).toBe("@memoize decorates a function, and this is a flow.");
  });

  it("points at the `@name` that does not belong", () => {
    const source = [MEMOIZE, "@memoize", 'flow "f" { }'].join("\n");

    const span = expandOwn(source)[0]?.span;

    expect(span?.offset).toBe(source.indexOf("@memoize"));
    expect(span?.length).toBe("@memoize".length);
  });

  it("names every kind a union allows", () => {
    const found = expandOwn([NOTE, 'flow "f" {', "@note", '  step "s" { }', "}"].join("\n"));

    expect(found[0]?.title).toBe("@note decorates a function or a flow, and this is a step.");
  });

  it("takes either side of that union", () => {
    expect(expandOwn([NOTE, "@note", 'flow "f" { }'].join("\n"))).toEqual([]);
    expect(expandOwn([NOTE, "@note", "fn f(n) => n"].join("\n"))).toEqual([]);
  });

  it("lets `Node` stand for anything, including what has no kind of its own", () => {
    expect(expandOwn([TAG, "@tag", "type User { name: string }"].join("\n"))).toEqual([]);
    expect(expandOwn([TAG, "@tag", "fragment helper() { expect true }"].join("\n"))).toEqual([]);
  });

  /** A signature that never said is one complaint, where it is written. */
  it("says nothing at a use site about a `deco` that declared no target", () => {
    const found = expandOwn(["deco broken() { }", "@broken", 'flow "f" { }'].join("\n"));

    expect(found.map((problem) => problem.code)).toEqual(["VN2015"]);
  });
});

/**
 * A plugin's decorator still names node types: it is handed the raw node, and
 * nothing shorter describes what it can read. That is the plugin author's
 * spelling and it stops at the plugin author: the sentence a user reads names
 * what the user wrote.
 */
describe("a plugin's node names never reach the message", () => {
  function refusal(targets: readonly string[], source: string): Problem | undefined {
    const { ast, problems } = parse(source);
    expect(problems).toEqual([]);
    const steppy = { name: "steppy", targets, expand: () => {} };
    return expand({ document: ast, decorators: { get: () => steppy }, uri: URI }).problems[0];
  }

  it("says what the author wrote, not what the tree calls it", () => {
    const found = refusal(["StepDecl"], '@steppy\nflow "f" { }');

    expect(found?.code).toBe("VN2014");
    expect(found?.title).toBe("@steppy decorates a step, and this is a flow.");
  });

  it("reads a list of them as prose", () => {
    const found = refusal(["FlowDecl", "StepDecl", "GroupDecl"], "@steppy\nfn f(n) => n");

    expect(found?.title).toBe(
      "@steppy decorates a flow, a step or a group, and this is a function.",
    );
  });

  it("derives a word for a node nobody listed, rather than printing the `$type`", () => {
    const found = refusal(["WidgetDecl"], '@steppy\nflow "f" { }');

    expect(found?.title).toBe("@steppy decorates a widget, and this is a flow.");
    expect(found?.title).not.toContain("Decl");
  });
});
