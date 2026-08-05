import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const CURSOR = "\u25AE";

/** The labels offered at the cursor, as the editor would show them. */
async function offeredAt(lines: readonly string[]): Promise<string[]> {
  const whole = lines.join("\n");
  const { services, document, uri } = await fixture(whole.replace(CURSOR, ""));
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(whole.indexOf(CURSOR)),
  });
  return [...(list?.items ?? [])].map((each) => each.label);
}

/**
 * A dot after a moment, a pattern or a task.
 *
 * All three offered nothing at all. The runtime dispatched all sixteen members
 * of a moment and all four of a pattern, and the checker typed both, but the
 * editor reads a third table and that table had no entry for either kind, so
 * `date.now().` was a dead end for anybody finding out what a moment can do. A
 * task had no type at all until `spawn` was given one.
 *
 * The counts are written out because the number is the point: an entry going
 * missing again would still leave a shorter list that any `toContain` would
 * pass.
 */
describe("what the editor offers after a dot", () => {
  it("offers every member of a moment", async () => {
    const labels = await offeredAt([
      "import date",
      "const t = date.now()",
      `print t.${CURSOR}`,
      "",
    ]);

    expect(labels).toHaveLength(16);
    expect(labels).toContain("iso");
    expect(labels).toContain("isAfter");
  });

  it("offers every member of a pattern, once each", async () => {
    const labels = await offeredAt([`const p = regex(r"d+")`, `print p.${CURSOR}`, ""]);

    expect(labels).toEqual(["source", "flags", "test", "match"]);
  });

  it("offers every member of a task, once each", async () => {
    const labels = await offeredAt(["const j = spawn(fn () => 1)", `print j.${CURSOR}`, ""]);

    expect(labels).toEqual(["wait", "done", "failed", "settle"]);
  });
});
