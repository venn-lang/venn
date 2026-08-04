import { createTestHost, VennError } from "@venn-lang/contracts";
import { type Problem, parse } from "@venn-lang/core";
import { defineAction, definePlugin, PLUGIN_CODES } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/** A verb that lets a Node error escape, and one that uses `where` for prose. */
const plugin = definePlugin({
  name: "@t/files",
  version: "0",
  namespace: "t",
  actions: [
    defineAction({
      name: "open",
      run: () => {
        throw Object.assign(new Error("ENOENT: no such file or directory, open 'orders.csv'"), {
          code: "ENOENT",
          errno: -2,
        });
      },
    }),
    defineAction({
      name: "click",
      run: () => {
        throw new VennError({
          code: PLUGIN_CODES.VN7003_UNREADABLE,
          message: "No element matched #pay.",
          detail: { where: "the checkout page", selector: "#pay" },
        });
      },
    }),
  ],
});

async function ran(source: string): Promise<MemorySink> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  await createRunner({ host: createTestHost(), plugins: [plugin], sink }).run(ast);
  return sink;
}

/** Every Problem the run put on the stream, read by what the envelope carries. */
function problemsIn(sink: MemorySink): Problem[] {
  return sink.envelopes.flatMap((envelope) =>
    "problem" in envelope.data ? [envelope.data.problem] : [],
  );
}

/**
 * What reaches a reporter as a code, and what does not.
 *
 * `Problem.code` is what junit writes as `type`, what pretty leads a failure
 * with, and what a code-keyed CI filter and every docs link key on. So it holds
 * a code the language catalogues or one a program chose on purpose, and never
 * whatever `.code` happened to be on the object that unwound.
 */
describe("a code on the wire", () => {
  it("is the one the program chose, which is the point of the error model", async () => {
    const source = `flow "F" {\n  step "s" { fail "the card said no" { code: "pay.declined" } }\n}`;

    expect(problemsIn(await ran(source))).toMatchObject([
      { code: "pay.declined", title: "the card said no", span: { line: 2 } },
    ]);
  });

  it("is not Node's, however plainly the object carried one", async () => {
    const problems = problemsIn(await ran('flow "F" {\n  step "s" { t.open }\n}'));

    expect(problems).toMatchObject([
      {
        code: "VN7000",
        title: "ENOENT: no such file or directory, open 'orders.csv'",
        note: 'It came with the code "ENOENT", which is not one of ours.',
      },
    ]);
  });

  /**
   * `detail.where` was preferred over the span the runtime had worked out, so a
   * plugin using the word for prose put `"span":"the checkout page"` on the
   * NDJSON wire and every consumer of `span.line` lost its footing.
   */
  it("keeps the span the runtime worked out when `where` is not one", async () => {
    const problems = problemsIn(await ran('flow "F" {\n  step "s" { t.click }\n}'));

    expect(problems).toMatchObject([{ code: "VN7003", span: { line: 2 } }]);
    expect(typeof problems[0]?.span.uri).toBe("string");
    expect(problems[0]?.span.column).toBeGreaterThan(0);
  });
});
