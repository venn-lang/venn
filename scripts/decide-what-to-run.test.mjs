import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const DECIDE = join(import.meta.dirname, "..", ".github", "actions", "changed", "decide.sh");

/** The changed paths, as the workflow feeds them: one per line on stdin. */
async function decide(args) {
  const output = join(await mkdtemp(join(tmpdir(), "decide-")), "out");
  const child = run("bash", [DECIDE], {
    env: { ...process.env, GITHUB_OUTPUT: output, ALSO: args.also ?? "" },
  });
  child.child.stdin?.end(args.files.join("\n"));
  await child;
  const written = await readFile(output, "utf8");
  return written.includes("code=true");
}

/** What the release passes, because a changeset is Markdown and still matters. */
const CHANGESETS = String.raw`^\.changeset/`;

describe("deciding what a change is worth running", () => {
  it("runs everything for source", async () => {
    expect(await decide({ files: ["packages/cli/src/cli.ts"] })).toBe(true);
  });

  it("runs everything when one file among the prose is code", async () => {
    const files = ["README.md", "docs/venn-language.md", "packages/cli/src/cli.ts"];
    expect(await decide({ files })).toBe(true);
  });

  /**
   * Markdown is not prose to this repository. A README carries a Venn block
   * that has to check, every package is required to have one, and no file may
   * carry a dash or credit a tool. Those are guards, they live in `verify`, and
   * skipping them on a change to the very files they are about was a guard
   * anybody could walk past by editing one line.
   */
  it("runs for a README, because a README is what several guards read", async () => {
    expect(await decide({ files: ["README.md"] })).toBe(true);
  });

  it("runs for the language specification, whose fences are checked", async () => {
    expect(await decide({ files: ["docs/venn-language.md"] })).toBe(true);
  });

  it("skips the issue templates and the licence, which nothing reads", async () => {
    const files = [".github/ISSUE_TEMPLATE/bug.yml", "LICENSE"];
    expect(await decide({ files })).toBe(false);
  });

  /**
   * A path nobody classified is code until someone says otherwise. The other
   * way round, something new would ship untested.
   */
  it("runs everything for a path nobody thought about", async () => {
    expect(await decide({ files: ["Dockerfile"] })).toBe(true);
  });

  /** An empty answer is a comparison that told us nothing, not a quiet tree. */
  it("runs everything when nothing came back", async () => {
    expect(await decide({ files: [] })).toBe(true);
  });

  describe("what the release asks for", () => {
    /**
     * The case this input exists for. A changeset is Markdown, so the plain
     * answer is prose, and skipping the release on a merge that brings one
     * leaves the changelog entry unwritten: #100, through another door.
     */
    it("runs for a changeset, which is prose to everybody else", async () => {
      const files = [".changeset/toolchain-catalogue.md"];
      expect(await decide({ files, also: CHANGESETS })).toBe(true);
    });

    it("runs for the version pull request, which consumes them", async () => {
      const files = [
        ".changeset/toolchain-catalogue.md",
        "packages/cli/package.json",
        "packages/cli/CHANGELOG.md",
      ];
      expect(await decide({ files, also: CHANGESETS })).toBe(true);
    });

    it("still runs for a README", async () => {
      expect(await decide({ files: ["README.md"], also: CHANGESETS })).toBe(true);
    });

    /**
     * A changelog releases nothing, but it is Markdown in a package, and the
     * guards that read Markdown do not know the difference. Running them on it
     * costs one job and is the price of not having a way to walk past them.
     */
    it("runs for a changelog, because the Markdown guards read it too", async () => {
      expect(await decide({ files: ["packages/cli/CHANGELOG.md"], also: CHANGESETS })).toBe(true);
    });
  });
});
