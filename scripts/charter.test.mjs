import { describe, expect, it } from "vitest";
import { committed, RULES, survey, worseThan } from "./charter.mjs";

/**
 * The five rules that cannot be red today, held at exactly where they are.
 *
 * Every other guard in `scripts/` is at zero and stays there. These five are
 * not: a six-hundred-line typechecker, a hundred and eighty-one long functions
 * and a hundred and seventy-four imports round a barrel are a month of work
 * each, and a rule that cannot be obeyed is a rule that gets deleted.
 *
 * So the baseline is the offender list, per file, and this only ever lets a
 * number shrink. A file nobody listed cannot appear, a file that is listed
 * cannot grow, and a signature that gains a fourth argument fails even in a
 * file that already had one.
 *
 * Run `node scripts/charter.mjs --write` when a number goes down, so the
 * improvement lands as a smaller number in a reviewed diff.
 */
describe("the charter's counted rules", () => {
  it("hold at the baseline, or below it", { timeout: 60_000 }, async () => {
    const worse = worseThan(await committed(), await survey());

    expect(worse).toEqual([]);
  });

  /** A baseline missing a rule is a rule nothing is holding. */
  it("are all five written down", async () => {
    const baseline = await committed();
    const rules = [...Object.keys(RULES), "imports past a barrel"];

    expect(rules.filter((rule) => baseline[rule] === undefined)).toEqual([]);
    expect(Object.keys(baseline).sort()).toEqual(rules.sort());
  });

  /**
   * A survey that measured nothing would agree with any baseline at all, and
   * would say so in the same words as a clean tree.
   *
   * Held to what the rules MEAN rather than to one file's size. Pinning a named
   * file at a magic number made the canary go red the day somebody split that
   * file up, which is the opposite of what this repository wants to encourage.
   */
  it("are measured over a tree the survey really read", { timeout: 60_000 }, async () => {
    const now = await survey();
    const longest = Object.values(now["over 300 lines"]);

    expect(longest.length).toBeGreaterThan(4);
    expect(Object.keys(now["functions over 15 lines"]).length).toBeGreaterThan(100);
    // Every count agrees with the rule that produced it, so a survey handing
    // back plausible-looking numbers it never measured cannot pass.
    expect(longest.filter((lines) => lines <= 300)).toEqual([]);
    expect(Object.values(now["functions over 15 lines"]).filter((n) => n < 1)).toEqual([]);
  });
});
