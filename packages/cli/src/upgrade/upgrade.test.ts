import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { installSiteOf } from "./install-site.js";
import { isNewer } from "./latest-version.js";
import { runUpgrade } from "./upgrade-command.js";
import { PACKAGE_NAME, refusalFor, upgradeCommandFor } from "./upgrade-plan.js";
import { VERSION } from "./version.js";

const HOME = "/home/v";
/** Somewhere unrelated, so a test says nothing about node unless it means to. */
const NODE = "/opt/node/bin/node";

/**
 * Which manager installed a copy, read from where the copy is.
 *
 * `npm_config_user_agent` is the obvious answer and the wrong one: it is set
 * while a package script runs and empty when the binary is invoked directly,
 * which is every real use. The path is always there.
 */
describe("recognising an install", () => {
  const cases: [string, string, string][] = [
    ["npm on a prefix", "C:/nvm4w/nodejs/node_modules/@venn-lang/cli/dist/bin/venn.mjs", "npm"],
    ["npm on unix", "/usr/local/lib/node_modules/@venn-lang/cli/dist/bin/venn.mjs", "npm"],
    [
      "pnpm on linux",
      `${HOME}/.local/share/pnpm/global/5/node_modules/@venn-lang/cli/x.mjs`,
      "pnpm",
    ],
    [
      "pnpm on windows",
      "C:/Users/v/AppData/Local/pnpm/global/5/node_modules/@venn-lang/cli/x.mjs",
      "pnpm",
    ],
    ["pnpm on macos", "/Users/v/Library/pnpm/global/5/node_modules/@venn-lang/cli/x.mjs", "pnpm"],
    ["bun", `${HOME}/.bun/install/global/node_modules/@venn-lang/cli/x.mjs`, "bun"],
    ["yarn", `${HOME}/.config/yarn/global/node_modules/@venn-lang/cli/x.mjs`, "yarn"],
  ];

  for (const [name, path, manager] of cases) {
    it(`knows ${name}`, () => {
      const site = installSiteOf({ path, cwd: "/work/suite", nodePath: NODE });

      expect(site.manager).toBe(manager);
      expect(site.global).toBe(true);
    });
  }

  it("says so rather than guessing when the path means nothing", () => {
    const site = installSiteOf({ path: "/opt/somewhere/venn.mjs", cwd: "/work", nodePath: NODE });

    expect(site.manager).toBe("unknown");
  });

  /** A copy under the project is the project's, and its version is pinned there. */
  it("knows a copy inside the project is not global", () => {
    const site = installSiteOf({
      path: "/work/suite/node_modules/@venn-lang/cli/dist/bin/venn.mjs",
      cwd: "/work/suite",
      nodePath: NODE,
    });

    expect(site.manager).toBe("npm");
    expect(site.global).toBe(false);
  });

  /**
   * A file URL is not a path. Passing `import.meta.url` straight in made every
   * local install look global, because "file:///c:/x" never starts with "c:/x".
   */
  it("is given a path, so a file URL would not be mistaken for one", () => {
    const asUrl = installSiteOf({
      path: "file:///work/suite/node_modules/@venn-lang/cli/dist/bin/venn.mjs",
      cwd: "/work/suite",
      nodePath: NODE,
    });
    const asPath = installSiteOf({
      path: "/work/suite/node_modules/@venn-lang/cli/dist/bin/venn.mjs",
      cwd: "/work/suite",
      nodePath: NODE,
    });

    expect(asPath.global).toBe(false);
    expect(asUrl.global).toBe(true);
  });

  /**
   * Several global roots live under the home directory, so invoking from `~`
   * put the copy inside the working directory and made it look like a project's.
   */
  it("knows a global root is global even when invoked from above it", () => {
    const roots = [
      "c:/users/v/appdata/local/pnpm/global/5/node_modules/@venn-lang/cli/x.mjs",
      "c:/users/v/.bun/install/global/node_modules/@venn-lang/cli/x.mjs",
      "c:/users/v/.config/yarn/global/node_modules/@venn-lang/cli/x.mjs",
      "c:/users/v/appdata/roaming/npm/node_modules/@venn-lang/cli/x.mjs",
    ];

    for (const path of roots) {
      expect(installSiteOf({ path, cwd: "c:/users/v", nodePath: NODE }).global).toBe(true);
    }
  });

  /**
   * The install that broke it. `C:\nvm4w\nodejs` is a link to the version
   * directory, node resolves it before any of this sees it, and no list of
   * directory names would have had `v24.17.0` in it. Every global install under
   * a version manager was read as a project's and left alone.
   */
  it("knows an install beside node is global, wherever a version manager put node", () => {
    const site = installSiteOf({
      path: "C:/Users/v/AppData/Local/nvm/v24.17.0/node_modules/@venn-lang/cli/dist/cli.mjs",
      cwd: "C:/Users/v/AppData/Local/nvm/v24.17.0",
      nodePath: "C:/Users/v/AppData/Local/nvm/v24.17.0/node.exe",
    });

    expect(site.manager).toBe("npm");
    expect(site.global).toBe(true);
  });

  /** The same on unix, where npm puts them under a `lib` beside the binary. */
  it("knows an install under node's lib is global", () => {
    const site = installSiteOf({
      path: "/home/v/.nvm/versions/node/v24.17.0/lib/node_modules/@venn-lang/cli/x.mjs",
      cwd: "/home/v/.nvm/versions/node/v24.17.0",
      nodePath: "/home/v/.nvm/versions/node/v24.17.0/bin/node",
    });

    expect(site.global).toBe(true);
  });

  it("reads a windows path the same as any other", () => {
    const site = installSiteOf({
      path: "C:\\Users\\V\\AppData\\Local\\pnpm\\global\\5\\node_modules\\@venn-lang\\cli\\x.mjs",
      cwd: "C:\\work",
      nodePath: NODE,
    });

    expect(site.manager).toBe("pnpm");
  });
});

describe("the command each manager needs", () => {
  it("installs globally, in that manager's spelling", () => {
    expect(upgradeCommandFor("npm")).toEqual(["npm", "install", "-g", `${PACKAGE_NAME}@latest`]);
    expect(upgradeCommandFor("pnpm")).toEqual(["pnpm", "add", "-g", `${PACKAGE_NAME}@latest`]);
    expect(upgradeCommandFor("bun")).toEqual(["bun", "add", "-g", `${PACKAGE_NAME}@latest`]);
    expect(upgradeCommandFor("yarn")).toEqual(["yarn", "global", "add", `${PACKAGE_NAME}@latest`]);
  });

  it("has nothing to offer for an unknown manager", () => {
    expect(upgradeCommandFor("unknown")).toBeUndefined();
  });
});

describe("refusing to upgrade", () => {
  it("will not touch a copy the project owns", () => {
    const refusal = refusalFor({ manager: "npm", global: false });

    expect(refusal).toContain("belongs to the project");
    expect(refusal).toContain(PACKAGE_NAME);
  });

  it("will not guess when it cannot tell", () => {
    expect(refusalFor({ manager: "unknown", global: true })).toContain("will not guess");
  });

  it("allows a global install it recognises", () => {
    expect(refusalFor({ manager: "pnpm", global: true })).toBeUndefined();
  });
});

describe("deciding whether a version is worth offering", () => {
  it("offers a later release", () => {
    expect(isNewer({ current: "0.1.0", candidate: "0.2.0" })).toBe(true);
    expect(isNewer({ current: "0.1.9", candidate: "0.1.10" })).toBe(true);
    expect(isNewer({ current: "1.0.0", candidate: "2.0.0" })).toBe(true);
  });

  it("stays quiet on the same or an older one", () => {
    expect(isNewer({ current: "0.2.0", candidate: "0.2.0" })).toBe(false);
    expect(isNewer({ current: "0.2.0", candidate: "0.1.9" })).toBe(false);
  });

  /** Opting into a prerelease is a decision, not an update. */
  it("never offers a prerelease", () => {
    expect(isNewer({ current: "0.1.0", candidate: "0.2.0-rc.1" })).toBe(false);
  });

  it("compares numerically, not as text", () => {
    expect(isNewer({ current: "0.9.0", candidate: "0.10.0" })).toBe(true);
  });
});

describe("a dry run", () => {
  /** The promise it makes is that nothing on the machine changes. */
  it("reports success without starting the manager", async () => {
    const code = await runUpgrade({
      site: { manager: "pnpm", global: true },
      options: { dryRun: true, yes: false },
    });

    expect(code).toBe(0);
  });

  it("fails rather than guessing a command for an unknown manager", async () => {
    const code = await runUpgrade({
      site: { manager: "unknown", global: true },
      options: { dryRun: true, yes: false },
    });

    expect(code).toBe(1);
  });
});

describe("the version it reports", () => {
  /**
   * It is read by walking up from the running file, and the bundle sits at a
   * different depth than this source, so this only proves the search finds the
   * right manifest. That the shipped binary agrees is checked in CI, against
   * the build, which is the only place the other depth exists.
   */
  it("is the one its manifest declares", async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(await readFile(join(here, "../../package.json"), "utf8"));

    expect(VERSION).toBe(manifest.version);
    expect(VERSION).not.toBe("0.0.0");
  });
});
