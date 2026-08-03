import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROOT } from "./repo-sources.mjs";

const CLI = join(ROOT, "packages", "cli");

/**
 * The shipped layout: `dist` and `package.json`, and no `node_modules`.
 *
 * `installVersion` fetches the tarball, unpacks it into `~/.venn/versions/<v>/`
 * and stops, so this is what a person who installed the documented way has. A
 * copy rather than a `pnpm pack`, so the guard costs a file copy rather than a
 * publish, and both put the same two things in an empty directory.
 */
async function shippedLayout() {
  const dir = await mkdtemp(join(tmpdir(), "venn-tarball-"));
  await cp(join(CLI, "dist"), join(dir, "dist"), { recursive: true });
  await cp(join(CLI, "package.json"), join(dir, "package.json"));
  return dir;
}

function ran(args) {
  return new Promise((settle) => {
    execFile(process.execPath, args, { timeout: 120_000 }, (error, stdout, stderr) =>
      settle({ ok: !error, said: `${stdout}${stderr}` }),
    );
  });
}

/** The chunk the engine reaches for when a package's types are derived. */
async function derivationChunk(dir) {
  const engine = await readFile(join(dir, "dist", "cli.mjs"), "utf8");
  const found = /import\("(\.\/[^"]+\.mjs)"\)/.exec(engine);
  return found?.[1];
}

let shipped;

beforeAll(async () => {
  shipped = await shippedLayout();
}, 120_000);

afterAll(async () => {
  if (shipped) await rm(shipped, { recursive: true, force: true });
});

/**
 * Nothing the shipped binary loads may live outside the tarball.
 *
 * `@venn-lang/dts` and `tsc-api` were external, so the import survived into
 * `dist/cli.mjs` and resolved only here, where pnpm has symlinked the workspace
 * into place. Every user who installed the documented way got a raw
 * `ERR_MODULE_NOT_FOUND` on their first `venn add`, after the manifest was
 * edited, the packages installed and the lock written.
 */
describe("the shipped tarball, unpacked into an empty directory", () => {
  it("runs with nothing installed beside it", async () => {
    const version = await ran([join(shipped, "dist", "bin", "venn-run.mjs"), "--version"]);

    expect(version.said.trim()).toMatch(/^\d+\.\d+\.\d+/);
    expect(version.ok).toBe(true);
  }, 120_000);

  it("keeps the type derivation in a chunk of its own, beside the engine", async () => {
    const chunk = await derivationChunk(shipped);

    expect(chunk, "dist/cli.mjs reaches no chunk by a relative path").toBeDefined();
  });

  /** The compiler is CommonJS: without the ESM shims the chunk throws on load. */
  it("loads that chunk, compiler and all", async () => {
    const chunk = await derivationChunk(shipped);
    const at = pathToFileURL(join(shipped, "dist", chunk ?? "")).href;
    const loaded = await ran(["-e", `import(${JSON.stringify(at)}).then(() => process.exit(0))`]);

    expect(loaded.said).toBe("");
    expect(loaded.ok).toBe(true);
  }, 120_000);
});
