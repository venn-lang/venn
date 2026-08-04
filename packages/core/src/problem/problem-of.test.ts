import { describe, expect, it } from "vitest";
import { ProblemError } from "./problem-error.js";
import { problemOf } from "./problem-of.js";

const NODE = { uri: "orders.vn", offset: 0, length: 3, line: 12, column: 5 };
const RAISED = { uri: "charge.vn", offset: 40, length: 4, line: 3, column: 7 };

/**
 * A `VennError` as this reads one: by its fields.
 *
 * Written out rather than constructed, because what is being checked is that
 * anything arriving with these fields is understood. The class lives in
 * `contracts`, which the kernel takes types from and never values.
 */
function carrying(fields: { code?: string; message?: string; detail?: unknown }): object {
  return fields;
}

/**
 * `Problem.code` is a promise, not a field to be filled from whatever came.
 *
 * Every `Error` in Node carries a `.code`, and one that escaped a plugin used to
 * reach the failure envelope as the problem's own: pretty led with `ENOENT`
 * exactly as it leads with ours, junit wrote `type="ENOENT"`, and the catalogue,
 * the docs links and every code-keyed CI filter missed it.
 */
describe("a code that leaked out of Node", () => {
  const enoent = Object.assign(new Error("ENOENT: no such file or directory, open 'orders.csv'"), {
    code: "ENOENT",
    errno: -2,
  });

  it("is not reported as though the language raised it", () => {
    expect(problemOf({ thrown: enoent, span: NODE }).code).toBe("VN7000");
  });

  it("is still written down, so a maintainer has something to search for", () => {
    expect(problemOf({ thrown: enoent, span: NODE }).note).toBe(
      'It came with the code "ENOENT", which is not one of ours.',
    );
  });

  it("keeps the message it came with as the title", () => {
    expect(problemOf({ thrown: enoent, span: NODE }).title).toBe(
      "ENOENT: no such file or directory, open 'orders.csv'",
    );
  });

  /** A plugin's own namespace is the same guess, and the same answer. */
  it("takes a namespaced code no more readily", () => {
    const thrown = carrying({ code: "web.no-element", message: "No element matched #pay." });

    expect(problemOf({ thrown, span: NODE })).toMatchObject({
      code: "VN7000",
      title: "No element matched #pay.",
    });
  });

  it("leaves a code shaped like ours alone", () => {
    const thrown = carrying({ code: "VN7022", message: "Nothing accepted a connection." });
    const problem = problemOf({ thrown, span: NODE });

    expect(problem.code).toBe("VN7022");
    expect(problem.note).toBeUndefined();
  });
});

/**
 * A code the program chose survives, because the raiser vouched for it.
 *
 * `pay.declined` is the flagship of the error model and cannot be told from
 * `ENOENT` by shape, so it is not guessed at: whoever chose it carries the whole
 * `Problem`, and that is returned as it is. `failError` does exactly that.
 */
describe("a code the program chose", () => {
  it("is reported as the program's own, uncatalogued and all", () => {
    const thrown = new ProblemError({
      code: "pay.declined",
      severity: "error",
      title: "the card said no",
      span: RAISED,
    });

    expect(problemOf({ thrown, span: NODE })).toMatchObject({
      code: "pay.declined",
      title: "the card said no",
      span: { uri: "charge.vn", line: 3 },
    });
  });
});

/**
 * `detail.where` is a claim, not a span.
 *
 * `VennErrorDetail` is `Readonly<Record<string, unknown>>`, so `where` holds
 * whatever the raiser put there, and it was preferred over the span the runtime
 * had worked out. A plugin using the word for prose therefore destroyed the
 * location instead of merely failing to improve it: `"span":"the checkout page"`
 * went out on the wire, `problemLines` read `uri` off a string and dropped the
 * `at` line, and anything reaching for `span.line` threw.
 */
describe("where a failure says it happened", () => {
  it("keeps the computed span when `where` is prose", () => {
    const thrown = carrying({
      code: "VN7003",
      message: "No element matched #pay.",
      detail: { where: "the checkout page", selector: "#pay" },
    });

    expect(problemOf({ thrown, span: NODE }).span).toEqual(NODE);
  });

  it("keeps the computed span when `where` is half a span", () => {
    const thrown = carrying({ detail: { where: { uri: "checkout.vn" } } });

    expect(problemOf({ thrown, span: NODE }).span).toEqual(NODE);
  });

  it("prefers the raiser's own line when it really is one", () => {
    const thrown = carrying({ code: "VN6002", detail: { where: RAISED } });

    expect(problemOf({ thrown, span: NODE }).span).toEqual(RAISED);
  });

  /** Nothing below the language knows a `.vn` position, and it says so. */
  it("falls back to the enclosing node for a failure that knows nothing", () => {
    expect(problemOf({ thrown: new Error("from below"), span: NODE })).toEqual({
      code: "VN7000",
      severity: "error",
      title: "from below",
      span: NODE,
    });
  });
});
