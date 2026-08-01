import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { beforeEach, describe, expect, it } from "vitest";

const run = promisify(execFile);
const SCRIPT = join(import.meta.dirname, "changeset-from-pr.mjs");

let cwd = "";

/**
 * The script reads the repository around it, so it gets one: a published
 * package, a private one, and the changeset directory.
 */
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "changeset-"));
  await mkdir(join(cwd, ".changeset"), { recursive: true });
  await writeFile(join(cwd, ".changeset", "README.md"), "how changesets work\n");
  await declare("toolchain", { name: "@venn-lang/toolchain" });
  await declare("vscode", { name: "venn", private: true });
});

async function declare(dir, manifest) {
  await mkdir(join(cwd, "packages", dir, "src"), { recursive: true });
  await writeFile(join(cwd, "packages", dir, "package.json"), JSON.stringify(manifest));
}

async function pending(name, text) {
  await writeFile(join(cwd, ".changeset", name), text);
}

/** One changeset, written the way a person writes one. */
function frontmatter(summary) {
  return ["---", '"@venn-lang/toolchain": minor', "---", "", summary, ""].join("\n");
}

/** What the workflow does: the title, the branch, and the files it changed. */
async function write(args) {
  const files = args.files ?? ["packages/toolchain/src/thing.ts"];
  const result = await run("node", [SCRIPT, args.title, ...files], {
    cwd,
    env: { ...process.env, BRANCH: args.branch ?? "feat/a-thing" },
  });
  return result.stdout.trim();
}

async function changesets() {
  const entries = await readdir(join(cwd, ".changeset"));
  return entries.filter((entry) => entry.endsWith(".md") && entry !== "README.md").sort();
}

describe("writing the changeset a pull request did not bring", () => {
  it("writes one from the title", async () => {
    const said = await write({ title: "feat(toolchain): ask the registry what exists" });

    expect(said).toContain("minor for @venn-lang/toolchain");
    expect(await changesets()).toEqual(["generated-feat-a-thing.md"]);
    const written = await readFile(join(cwd, ".changeset", "generated-feat-a-thing.md"), "utf8");
    expect(written).toBe(
      '---\n"@venn-lang/toolchain": minor\n---\n\nAsk the registry what exists.\n',
    );
  });

  /**
   * The one this was opened for. A release held back leaves changesets sitting
   * in the directory for weeks, and reading them as this branch's own left
   * seven pull requests out of the changelog.
   */
  it("writes one even while another branch's changeset waits for a release", async () => {
    await pending("feat-something-else.md", '---\n"@venn-lang/toolchain": minor\n---\n\nElse.\n');

    const said = await write({ title: "feat(toolchain): ask the registry what exists" });

    expect(said).toContain("minor for @venn-lang/toolchain");
    expect(await changesets()).toEqual(["feat-something-else.md", "generated-feat-a-thing.md"]);
  });

  it("leaves alone the one this branch wrote by hand", async () => {
    await pending("by-hand.md", '---\n"@venn-lang/toolchain": minor\n---\n\nSaid better.\n');

    const said = await write({
      title: "feat(toolchain): ask the registry what exists",
      files: ["packages/toolchain/src/thing.ts", ".changeset/by-hand.md"],
    });

    expect(said).toContain("leaving it alone");
    expect(await changesets()).toEqual(["by-hand.md"]);
  });

  /**
   * The trap this used to be: the generated file was named after the branch, so
   * the obvious name for a hand-written one was the reserved one, and five real
   * changesets were replaced by a sentence from a pull request title.
   */
  it("leaves alone one named after the branch, which is the obvious name", async () => {
    await pending("feat-a-thing.md", frontmatter("Written here."));

    const said = await write({
      title: "feat(toolchain): ask the registry what exists",
      files: ["packages/toolchain/src/thing.ts", ".changeset/feat-a-thing.md"],
    });

    expect(said).toContain("leaving it alone");
    expect(await changesets()).toEqual(["feat-a-thing.md"]);
  });

  /** The title was edited, so what was generated from the old one is stale. */
  it("rewrites its own when the title changes", async () => {
    await write({ title: "feat(toolchain): first wording" });

    await write({
      title: "feat(toolchain): second wording",
      files: ["packages/toolchain/src/thing.ts", ".changeset/generated-feat-a-thing.md"],
    });

    const written = await readFile(join(cwd, ".changeset", "generated-feat-a-thing.md"), "utf8");
    expect(written).toContain("Second wording.");
    expect(await changesets()).toEqual(["generated-feat-a-thing.md"]);
  });

  it("writes nothing for a change that releases nothing", async () => {
    const said = await write({ title: "docs(toolchain): explain the ranges" });

    expect(said).toContain("Nothing to release");
    expect(await changesets()).toEqual([]);
  });

  it("writes nothing when only a private package changed", async () => {
    const said = await write({
      title: "feat(vscode): serve the folder from the version it asked for",
      files: ["packages/vscode/src/extension.ts"],
    });

    expect(said).toContain("Only private packages changed.");
    expect(await changesets()).toEqual([]);
  });

  it("writes nothing when no source changed", async () => {
    const said = await write({
      title: "feat(toolchain): ask the registry what exists",
      files: ["packages/toolchain/src/thing.test.ts", "README.md"],
    });

    expect(said).toContain("nothing to release");
    expect(await changesets()).toEqual([]);
  });
});
