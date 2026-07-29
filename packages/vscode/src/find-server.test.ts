import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { serverFor } from "./find-server.js";

let home = "";
let before: string | undefined;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "venn-editor-"));
  before = process.env.VENN_HOME;
  process.env.VENN_HOME = home;
});

afterEach(() => {
  if (before === undefined) delete process.env.VENN_HOME;
  else process.env.VENN_HOME = before;
});

/**
 * A version on the machine, declaring both entry points.
 *
 * Both, because a version that offers only a server is not one anything could
 * run, and the toolchain does not count it as installed.
 */
async function install(version: string): Promise<void> {
  const root = join(home, "versions", version, "dist", "bin");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "venn-run.mjs"), "#!/usr/bin/env node\n");
  await writeFile(join(root, "venn-lsp.mjs"), "#!/usr/bin/env node\n");
  const bin = { "venn-run": "./dist/bin/venn-run.mjs", "venn-lsp": "./dist/bin/venn-lsp.mjs" };
  await writeFile(join(home, "versions", version, "package.json"), JSON.stringify({ bin }));
}

async function folderPinned(to: string): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "venn-folder-"));
  await writeFile(join(folder, ".venn-version"), `${to}\n`);
  return folder;
}

describe("finding the server for a folder", () => {
  it("is the version that folder pinned", async () => {
    await install("0.1.3");
    await install("0.2.0");
    const folder = await folderPinned("0.1.3");

    const found = await serverFor(folder);

    expect(found.kind).toBe("found");
    expect(found.kind === "found" && found.version).toBe("0.1.3");
    expect(found.kind === "found" && found.entry).toContain("venn-lsp");
  });

  it("is the newest installed when the folder does not ask", async () => {
    await install("0.1.3");
    await install("0.2.0");
    const folder = await mkdtemp(join(tmpdir(), "venn-folder-"));

    const found = await serverFor(folder);

    expect(found.kind === "found" && found.version).toBe("0.2.0");
  });

  /**
   * Installing a compiler is not something an editor should decide to do while
   * somebody is typing, so it says what to run instead.
   */
  it("says what to run when the pinned version is not installed", async () => {
    await install("0.1.3");
    const folder = await folderPinned("0.9.9");

    const found = await serverFor(folder);

    expect(found.kind).toBe("missing");
    expect(found.kind === "missing" && found.reason).toContain("venn version install 0.9.9");
  });

  it("says so when nothing is installed at all", async () => {
    const folder = await mkdtemp(join(tmpdir(), "venn-folder-"));

    const found = await serverFor(folder);

    expect(found.kind).toBe("missing");
  });
});
