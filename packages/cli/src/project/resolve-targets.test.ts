import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resolveTargets } from "./resolve-targets.js";

const roots: string[] = [];

/** A project on disk with these files, returning its root. */
async function projectOf(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "venn-cli-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    const at = join(root, path);
    await mkdir(dirname(at), { recursive: true });
    await writeFile(at, content, "utf8");
  }
  return root;
}

afterAll(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

const WORKSPACE = {
  "venn.toml": '[workspace]\nmembers = ["packages/*"]\n',
  "packages/api/venn.toml": '[package]\nname = "api"\n',
  "packages/api/src/main.vn": "print 1\n",
  "packages/api/tests/saude.vn": 'flow "s" { step "t" { expect true } }\n',
  "packages/core/venn.toml": '[package]\nname = "core"\n',
  "packages/core/src/lib.vn": "pub fn x() => 1\n",
};

/**
 * What a bare command means inside a project.
 *
 * `venn test` at the root of a workspace means "the suite", the one thing it
 * obviously means. A path given outright still wins and is never second-guessed.
 */
describe("what a command with no path acts on", () => {
  it("takes an explicit path exactly as given", async () => {
    const root = await projectOf(WORKSPACE);

    const found = await resolveTargets({ kind: "test", target: "algum/lugar", cwd: root });

    expect(found.paths).toEqual(["algum/lugar"]);
  });

  it("means the members' tests/ for `test`", async () => {
    const root = await projectOf(WORKSPACE);

    const found = await resolveTargets({ kind: "test", cwd: root });

    expect(found.paths).toHaveLength(1);
    expect(found.paths[0]?.endsWith("tests")).toBe(true);
  });

  it("means every member for `check`", async () => {
    const root = await projectOf(WORKSPACE);

    const found = await resolveTargets({ kind: "check", cwd: root });

    expect(found.paths).toHaveLength(2);
  });

  /** One `bin` is unambiguous; `cargo run` reads the same way. */
  it("means the one program for `run`", async () => {
    const root = await projectOf(WORKSPACE);

    const found = await resolveTargets({ kind: "run", cwd: root });

    expect(found.paths[0]?.endsWith("main.vn")).toBe(true);
  });

  it("narrows to one member with -p", async () => {
    const root = await projectOf(WORKSPACE);

    const found = await resolveTargets({ kind: "check", packageName: "core", cwd: root });

    expect(found.paths).toHaveLength(1);
    expect(found.paths[0]?.endsWith("core")).toBe(true);
  });

  it("says which members exist when -p names none of them", async () => {
    const root = await projectOf(WORKSPACE);

    const found = await resolveTargets({ kind: "check", packageName: "nada", cwd: root });

    expect(found.problem).toContain("api, core");
  });

  // "no project anywhere above" is checked against a memory file system in
  // @venn-lang/project, where the walk has a top. Asked of a real disk it is a
  // claim about the machine: a stray `venn.toml` in a temp directory two
  // levels up makes it fail, which is the discovery working, not breaking.

  it("says so when nothing has a tests/ directory", async () => {
    const root = await projectOf({
      "venn.toml": '[package]\nname = "solo"\n',
      "src/main.vn": "print 1\n",
    });

    expect((await resolveTargets({ kind: "test", cwd: root })).problem).toContain("tests/");
  });

  /** Picking one of several programs is a coin toss dressed as a decision. */
  it("asks which program when a package has several", async () => {
    const root = await projectOf({
      "venn.toml": '[package]\nname = "solo"\n',
      "src/bin/um.vn": "print 1\n",
      "src/bin/dois.vn": "print 2\n",
    });

    const found = await resolveTargets({ kind: "run", cwd: root });

    expect(found.problem).toContain("--bin");
  });

  it("takes the one named with --bin", async () => {
    const root = await projectOf({
      "venn.toml": '[package]\nname = "solo"\n',
      "src/bin/um.vn": "print 1\n",
      "src/bin/dois.vn": "print 2\n",
    });

    const found = await resolveTargets({ kind: "run", binName: "dois", cwd: root });

    expect(found.paths[0]?.endsWith("dois.vn")).toBe(true);
  });
});
