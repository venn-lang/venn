import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createDecoratorSource } from "../decorators/index.js";
import { buildRegistry } from "../registry/index.js";
import { checkDocument } from "./check-document.js";

const NEWLINE = String.fromCharCode(10);
const lines = (...parts: readonly string[]): string => parts.join(NEWLINE);

function said(source: string): string[] {
  const { ast } = parse(source);
  const registry = buildRegistry({ plugins: [], caps: [] });
  const decorators = createDecoratorSource([]);
  return checkDocument({ document: ast, registry, fragments: new Set(), decorators }).map(
    (problem) => `${problem.code} ${problem.title}`,
  );
}

const TIMED_PARALLEL = lines(
  'flow "cut by a timeout" {',
  "  @timeout(30ms)",
  "  parallel {",
  '    step "one" { log "one" }',
  '    step "two" { log "two" }',
  "  }",
  "}",
);

/**
 * Where a decorator may sit, decided before anything runs.
 *
 * `@timeout` on a `parallel` was refused only by expansion, which happens as the
 * program runs, so both branches ran to completion and `venn check` called the
 * file clean. Two lists compared is not work that needs a running flow, and a
 * command that refuses a file it has already executed is not a check.
 */
describe("a decorator written where it does not belong", () => {
  it("is refused before the flow runs", () => {
    expect(said(TIMED_PARALLEL)).toEqual([
      "VN2014 @timeout decorates a flow, a step or a group, and this is a parallel.",
    ]);
  });

  /**
   * The same sentence expansion gives, because both ask `wrongPlace`. Two
   * wordings for one mistake is how a reader learns to distrust both.
   */
  it("reads the same as the refusal a run gives", () => {
    const written = said('@retry(2)\nrace {\n  step "a" { log "a" }\n}');

    expect(written).toEqual([
      "VN2014 @retry decorates a flow, a step or a group, and this is a race.",
    ]);
  });

  it("leaves it alone where it belongs", () => {
    expect(said('@timeout(30ms)\nflow "F" {\n  step "s" { log "s" }\n}')).toEqual([]);
    expect(said('flow "F" {\n  @timeout(30ms)\n  step "s" { log "s" }\n}')).toEqual([]);
  });

  /**
   * A `deco` says what it decorates by typing its first parameter, and the type
   * checker refuses a misplaced one from that signature, in the author's own
   * words. Answering here as well would make one mistake two problems.
   */
  it("leaves a deco this file declares to its own signature", () => {
    const source = lines(
      "deco loud(target: Fn) {",
      "  target.wrap(fn (next) => next())",
      "}",
      "",
      "@loud",
      'flow "F" {',
      '  step "s" { log "s" }',
      "}",
    );

    expect(said(source).filter((one) => one.startsWith("VN2014"))).toEqual([]);
  });

  /**
   * A `deco` body is not the program, so the walk routes every node inside one
   * to the check that knows what a handle can do and skips the rest. Where a
   * decorator may sit is still a fact about the text there, and skipping it
   * meant `venn check` passed the file while `venn run` printed its output and
   * only then exited 1: the program ran in full before it was refused.
   */
  it("is refused inside a `deco` body too", () => {
    const source = lines(
      "deco loud(target: Fn) {",
      "  @timeout(1s)",
      '  target.meta "x" 1',
      "}",
      "@loud",
      "fn f() => 1",
      "print f()",
    );

    expect(said(source).filter((one) => one.startsWith("VN2014"))).toEqual([
      "VN2014 @timeout decorates a flow, a step or a group, and this is a call.",
    ]);
  });

  /** Nothing loaded means nothing to compare against, and silence beats a guess. */
  it("says nothing when the caller had no decorators to resolve against", () => {
    const { ast } = parse(TIMED_PARALLEL);
    const registry = buildRegistry({ plugins: [], caps: [] });

    expect(checkDocument({ document: ast, registry, fragments: new Set() })).toEqual([]);
  });
});
