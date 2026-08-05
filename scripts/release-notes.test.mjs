import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { beforeEach, describe, expect, it } from "vitest";

const run = promisify(execFile);
const SCRIPT = join(import.meta.dirname, "release-notes.mjs");

let cwd = "";

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "notes-"));
  await mkdir(join(cwd, "packages"), { recursive: true });
});

/** A package with a changelog, in the shape changesets writes one. */
async function changelog(name, body) {
  const dir = join(cwd, "packages", name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: `@venn-lang/${name}` }));
  await writeFile(join(dir, "CHANGELOG.md"), body);
}

async function notes(version = "0.2.0") {
  const { stdout } = await run("node", [SCRIPT, version], { cwd });
  return stdout;
}

const CREDIT = "[#12](https://x/12) [`abc1234`](https://x/c) Thanks [@someone](https://x/u)! -";

describe("the notes for a release", () => {
  /**
   * The line somebody copies. It has to name the command, and the command is
   * `@venn-lang/venn`: `@venn-lang/cli` is a version of the language, and
   * installing it since 0.2.0 leaves you with no `venn` at all. It said the
   * wrong one for four releases, and nothing was watching.
   */
  it("tells the reader to install the orchestrator", async () => {
    await changelog(
      "cli",
      `# @venn-lang/cli\n\n## 0.2.0\n\n### Minor Changes\n\n- ${CREDIT} A thing.\n`,
    );

    const written = await notes();

    expect(written).toContain("npm install -g @venn-lang/venn");
    expect(written).not.toContain("npm install -g @venn-lang/cli");
  });

  it("groups by what changed rather than by package", async () => {
    await changelog("cli", `# c\n\n## 0.2.0\n\n### Minor Changes\n\n- ${CREDIT} Something new.\n`);
    await changelog(
      "venn",
      `# v\n\n## 0.2.0\n\n### Patch Changes\n\n- ${CREDIT} Something fixed.\n`,
    );

    const written = await notes();

    expect(written).toContain("### New features");
    expect(written).toContain("### Fixes and improvements");
    expect(written.indexOf("### New features")).toBeLessThan(
      written.indexOf("### Fixes and improvements"),
    );
  });

  it("labels each line with the package it came from", async () => {
    await changelog("cli", `# c\n\n## 0.2.0\n\n### Minor Changes\n\n- ${CREDIT} A thing.\n`);

    expect(await notes()).toContain("**@venn-lang/cli**: A thing.");
  });

  /** True, and worth nothing to anybody reading a release. */
  it("drops the lines that only say a dependency moved", async () => {
    await changelog(
      "cli",
      `# c\n\n## 0.2.0\n\n### Patch Changes\n\n- Updated dependencies [\`abc\`]:\n  - @venn-lang/core@0.2.0\n`,
    );

    const written = await notes();

    expect(written).not.toContain("Updated dependencies");
    expect(written).toContain("Nothing user facing changed");
  });

  it("credits the people who contributed", async () => {
    await changelog("cli", `# c\n\n## 0.2.0\n\n### Minor Changes\n\n- ${CREDIT} A thing.\n`);

    expect(await notes()).toContain("Thanks to @someone");
  });

  it("reads only the version asked for", async () => {
    await changelog(
      "cli",
      `# c\n\n## 0.2.0\n\n### Minor Changes\n\n- ${CREDIT} The new one.\n\n## 0.1.3\n\n### Minor Changes\n\n- ${CREDIT} The old one.\n`,
    );

    const written = await notes();

    expect(written).toContain("The new one.");
    expect(written).not.toContain("The old one.");
  });

  /**
   * GitHub refuses a release body over 125000 characters with a 422, and the
   * step that creates the release runs after `changeset publish`. A release
   * that does not fit therefore fails with every package already on npm, which
   * is the one failure here that cannot be undone by running it again.
   *
   * The v0.7.0 notes wanted 609558: a changeset naming ten packages writes its
   * prose into ten changelogs, so the size follows the prose and not the number
   * of changes.
   */
  it("drops the folded detail rather than write a release GitHub will refuse", async () => {
    const prose = "x".repeat(4000);
    for (const name of Array.from({ length: 40 }, (_, at) => `p${at}`)) {
      await changelog(
        name,
        `# ${name}\n\n## 0.2.0\n\n### Minor Changes\n\n- ${CREDIT} A thing.\n\n  ${prose}\n`,
      );
    }

    const written = await notes();

    expect(written.length).toBeLessThanOrEqual(125_000);
    expect(written).not.toContain("<details>");
    expect(written).toContain("A thing.");
    expect(written).toContain("CHANGELOG.md");
  });

  /** A release that fits keeps its detail, which is every release so far. */
  it("keeps the folded detail when the page will take it", async () => {
    await changelog(
      "cli",
      `# c\n\n## 0.2.0\n\n### Minor Changes\n\n- ${CREDIT} A thing.\n\n  And why it matters.\n`,
    );

    const written = await notes();

    expect(written).toContain("<details><summary>Details</summary>");
    expect(written).toContain("And why it matters.");
    expect(written).not.toContain("too long to repeat here");
  });
});
