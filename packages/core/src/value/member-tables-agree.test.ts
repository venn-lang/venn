import { describe, expect, it } from "vitest";
import { MEMBER_NAMES } from "../expr/methods/index.js";
import { CHECKED_MEMBERS, MEMBER_DOCS } from "../typecheck/index.js";

/**
 * Three tables say what a value answers to, and they have to say the same.
 *
 * The runtime dispatches on one (`expr/methods/`), the checker types a member
 * against another (`typecheck/builtins.ts` and the two beside it), and the
 * editor completes and hovers from a third (`typecheck/member-docs.ts`). Each
 * was written where it was needed and nobody held them together, so they had
 * drifted apart in three places at once: `date.now().` offered nothing in the
 * editor although the runtime and the checker both knew all sixteen members of
 * a moment, a pattern offered nothing for the same reason, and a task had no
 * type at all so `job.dnoe` was silent.
 *
 * A member that only two of the three know is the same bug wearing a different
 * hat every time: something that runs and cannot be discovered, something the
 * editor promises and the run does not have, or something checked and never
 * implemented.
 */
describe("what a value answers to, said once", () => {
  const kinds = Object.keys(MEMBER_NAMES).sort();

  it("covers every kind that has members at all", () => {
    expect(kinds).toEqual(Object.keys(CHECKED_MEMBERS).sort());
    expect(kinds).toEqual(Object.keys(MEMBER_DOCS).sort());
  });

  it.each(kinds)("agrees about %s", (kind) => {
    const runs = [...(MEMBER_NAMES[kind] ?? [])].sort();

    expect([...(CHECKED_MEMBERS[kind] ?? [])].sort(), "the checker").toEqual(runs);
    expect(Object.keys(MEMBER_DOCS[kind] ?? {}).sort(), "the editor's docs").toEqual(runs);
  });

  /**
   * The cheap way to keep the agreement above quiet is to add the name with an
   * empty doc, which buys the editor nothing.
   */
  it("says something about every member it lists", () => {
    for (const [kind, table] of Object.entries(MEMBER_DOCS)) {
      for (const [name, doc] of Object.entries(table)) {
        expect(doc.doc.trim(), `${kind}.${name}`).not.toBe("");
      }
    }
  });
});
