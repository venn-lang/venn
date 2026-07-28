import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createNodeFs } from "./node-fs.js";

const roots: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "venn-fs-"));
  roots.push(dir);
  return dir;
}

afterAll(async () => {
  for (const dir of roots) await rm(dir, { recursive: true, force: true });
});

/**
 * What a root means, on a real disk.
 *
 * A root is where *relative* paths resolve. Joining it onto an absolute path
 * corrupts the path rather than relocating it (`join(".", "C:/x")` is
 * `.\C:\x`), and the failure shows up as a directory created inside itself, a
 * long way from the line that caused it.
 */
describe("a node file system's root", () => {
  it("resolves a relative path under the root", async () => {
    const root = await tempDir();
    const fs = createNodeFs({ root });

    await fs.write("a/b.txt", new TextEncoder().encode("oi"));

    expect(await readFile(join(root, "a/b.txt"), "utf8")).toBe("oi");
  });

  it("leaves an absolute path exactly where it points", async () => {
    const root = await tempDir();
    const elsewhere = await tempDir();
    const fs = createNodeFs({ root });
    const target = join(elsewhere, "fora.txt");

    await fs.write(target, new TextEncoder().encode("oi"));

    expect(await readFile(target, "utf8")).toBe("oi");
    expect(await fs.exists(target)).toBe(true);
  });

  it("lists a directory given by absolute path", async () => {
    const root = await tempDir();
    const fs = createNodeFs();

    await fs.write(join(root, "um.txt"), new Uint8Array([1]));

    expect((await fs.list(root)).map((entry) => entry.name)).toEqual(["um.txt"]);
  });
});

/**
 * A directory reached through a link.
 *
 * `readdir` reports a symlink as a symlink and not as what it points at, and
 * pnpm builds `node_modules` entirely out of them, so a walk that trusts the
 * first answer finds no packages at all inside a full one.
 */
describe("listing what is behind a link", () => {
  it("counts a link to a directory as a directory", async () => {
    const root = await tempDir();
    const fs = createNodeFs({ root });
    await fs.write("real/dentro.txt", new Uint8Array([1]));
    await symlink(join(root, "real"), join(root, "link"), "junction");

    const found = await fs.list("");

    expect(found.find((entry) => entry.name === "link")?.directory).toBe(true);
  });

  // Skipped on Windows, where creating a link to a *file* needs a privilege
  // this process does not have. A link to a directory is a junction and needs
  // none, which is the case that matters, since that is what pnpm makes.
  it.skipIf(process.platform === "win32")("does not count a link to a file as one", async () => {
    const root = await tempDir();
    const fs = createNodeFs({ root });
    await fs.write("alvo.txt", new Uint8Array([1]));
    await symlink(join(root, "alvo.txt"), join(root, "atalho.txt"), "file");

    const found = await fs.list("");

    expect(found.find((entry) => entry.name === "atalho.txt")?.directory).toBe(false);
  });
});
