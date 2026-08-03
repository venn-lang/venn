import { describe, expect, it } from "vitest";
import { baseThatExists, complaints, wrongWith } from "./subjects-are-clean.mjs";

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

/**
 * The deciding half, tested here; the reading half runs in CI.
 *
 * Split the way `.github/actions/changed` is split: asking git what is in a
 * pull request needs the pull request, and deciding what a message may say does
 * not, so the deciding is what gets tests.
 *
 * The branch this landed on is its own first case: every message on it is run
 * through the rule below, which is the only way to know the rule is one a
 * person can work under rather than one that fails on its own author.
 */
describe("a commit message and the title it merges under", () => {
  it("may not hold an em dash or an en dash", () => {
    expect(complaints("a subject", `fix(core): a thing ${EM} and another`)).toHaveLength(1);
    expect(complaints("a subject", `fix(core): a thing ${EN} and another`)).toHaveLength(1);
    expect(complaints("a subject", "fix(core): a thing, and another")).toEqual([]);
  });

  it("may not credit a tool, in the subject or in a trailer", () => {
    const trailer = "feat(core): a thing\n\nCo-Authored-By: Someone <a@b.test>";

    expect(complaints("a message", trailer)).toHaveLength(1);
    expect(complaints("a message", "feat(core): a thing\n\nGenerated with a tool")).toHaveLength(1);
    expect(complaints("a message", "feat(core): a thing\n\nReviewed-By: Someone")).toEqual([]);
  });

  /** A word this repository writes is not a credit, and must not read as one. */
  it("lets ordinary English through", () => {
    expect(complaints("a subject", "feat(lsp): keep the cursor where the edit left it")).toEqual(
      [],
    );
    expect(complaints("a subject", "fix(cli): the assistant flag nobody asked for")).toEqual([]);
  });

  it("says which rule was broken and what to do instead", () => {
    const [said] = complaints("the title", `docs: one ${EM} two`);

    expect(said).toContain("em dash");
    expect(said).toContain("Rewrite the sentence");
  });

  /**
   * The commits this arrived on, held to the rule they exist to hold.
   *
   * Skipped where the base is not fetched, which is the `verify` job: it clones
   * shallow on purpose, and deepening it would slow every build for a rule that
   * already has a job of its own. `Check the messages` in CI checks out with
   * `fetch-depth: 0` and runs this over the real range, so the rule is enforced
   * there rather than nowhere. Said out loud rather than passed over in silence,
   * because a guard that quietly does nothing is the thing this epic is about.
   */
  it("passes over the branch that introduced it", (ctx) => {
    if (!baseThatExists("main")) {
      ctx.skip("no `main` to compare against here; `Check the messages` in CI does this");
      return;
    }

    expect(wrongWith({ base: "main", head: "HEAD" })).toEqual([]);
  });
});
