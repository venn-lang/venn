import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPluginCommand } from "./verify-plugin.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "venn-verify-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** A fresh module name per fixture: an ESM import is cached by path. */
let counter = 0;

/** Write a plugin module, verify it, and hand back the verdict and the print. */
async function verify(source: string): Promise<{ code: number; out: string }> {
  const path = join(root, `p${String(counter++)}.mjs`);
  await writeFile(path, source, "utf8");
  const said: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    said.push(String(chunk));
    return true;
  });
  try {
    return { code: await verifyPluginCommand({ path }), out: said.join("") };
  } finally {
    spy.mockRestore();
  }
}

const WHOLE = `export default {
  name: "@t/ok",
  namespace: "ok",
  requires: ["fs"],
  actions: [{ name: "get", run: () => 1 }],
  matchers: [{ name: "ok", test: () => true, message: () => "" }],
};`;

const BROKEN = `export default {
  name: "@t/bad",
  namespace: "bad",
  requires: ["telepathy"],
  actions: [{ name: "get" }],
  matchers: [{ name: "ok", message: () => "" }],
};`;

describe("a plugin whose every declaration is callable", () => {
  it("is told nothing is wrong with it", async () => {
    const { code, out } = await verify(WHOLE);

    expect(code).toBe(0);
    expect(out).toContain("✓ plugin shape is valid");
  });

  it("is still counted, so the print stays worth reading", async () => {
    expect((await verify(WHOLE)).out).toContain('Plugin: @t/ok (namespace "ok")');
  });
});

/**
 * The whole verdict was `Boolean(plugin.name && plugin.namespace)`, and the
 * loader had already required both by the time it was asked, so the command
 * could not fail. A plugin needing a capability that does not exist, with a verb
 * that runs nothing and a matcher that decides nothing, printed "plugin shape is
 * valid" and exited 0, against a README promising it exits 1 when the shape is
 * wrong.
 */
describe("a plugin the registry would choke on", () => {
  it("exits 1", async () => {
    expect((await verify(BROKEN)).code).toBe(1);
  });

  it.each([
    'action "get" has no callable run',
    'matcher "ok" has no callable test',
    'requires "telepathy", which no host offers',
  ])("says so: %s", async (fault) => {
    expect((await verify(BROKEN)).out).toContain(fault);
  });
});
