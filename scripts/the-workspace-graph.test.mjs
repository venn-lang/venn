import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PACKAGES, specifiers } from "./repo-sources.mjs";

const INTERNAL = "@venn-lang/";

/** Every plugin, which is every package that carries a namespace of verbs. */
const PLUGINS = (names) => names.filter((one) => one.startsWith("std-"));

/**
 * What each package may depend on, which is the charter's diagram made runnable.
 *
 * It lives here rather than being read from the charter because the charter is
 * untracked, so CI never sees it, and a rule CI cannot read is a rule CI cannot
 * hold. A package not named here may depend on nothing.
 *
 * `cli` is the top and reaches everything, which is what mounting the node host
 * means. Plugins reach `sdk` and `contracts` and never `core` or each other.
 */
function mayUse(names) {
  const plugins = PLUGINS(names);
  return {
    types: [],
    contracts: [],
    prelude: ["types"],
    dts: ["types"],
    sdk: ["contracts", "types"],
    core: ["contracts", "prelude", "types"],
    project: ["contracts", "types"],
    toolchain: ["contracts", "types"],
    runtime: ["contracts", "core", "prelude", "sdk", "types"],
    stdlib: ["contracts", "runtime", "sdk", "types", ...plugins],
    lsp: ["contracts", "core", "project", "runtime", "sdk", "stdlib", "types"],
    venn: ["contracts", "toolchain"],
    vscode: ["contracts", "toolchain"],
    cli: names,
    ...Object.fromEntries(plugins.map((one) => [one, ["contracts", "sdk", "types"]])),
  };
}

/** Every package folder, by the name it publishes under. */
async function manifests() {
  const entries = await readdir(PACKAGES, { withFileTypes: true });
  const found = new Map();
  for (const entry of entries.filter((one) => one.isDirectory())) {
    const text = await readFile(join(PACKAGES, entry.name, "package.json"), "utf8").catch(() => "");
    if (text) found.set(entry.name, JSON.parse(text));
  }
  if (found.size === 0) throw new Error("no package.json read: the manifests were not found");
  return found;
}

/**
 * The `@venn-lang/*` packages a file imports, which is not the ones it mentions.
 *
 * `toolchain` holds `LANGUAGE_PACKAGE = "@venn-lang/cli"` as a constant, and a
 * scan for the string calls that a dependency. Only a specifier is one. The
 * subpath is dropped, so `@venn-lang/contracts/node` is the contracts edge.
 */
function imported(source) {
  return specifiers(source)
    .filter((one) => one.startsWith(INTERNAL))
    .map((one) => one.split("/").slice(0, 2).join("/"));
}

/** Written to run, or written to check what runs. A suite is the latter. */
const IS_TEST = /\.(test|suite|stub)\.ts$/;

async function tsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const found = [];
  const deeper = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist")
      deeper.push(tsFiles(path));
    else if (entry.name.endsWith(".ts")) found.push(path);
  }
  return [...found, ...(await Promise.all(deeper)).flat()];
}

const AT_A_TIME = 64;

/** What a package imports, split by whether the importer ships. */
async function usedBy(folder) {
  const paths = await tsFiles(join(PACKAGES, folder));
  const ships = new Set();
  const tests = new Set();
  for (let from = 0; from < paths.length; from += AT_A_TIME) {
    const batch = paths.slice(from, from + AT_A_TIME);
    const read = await Promise.all(batch.map((path) => readFile(path, "utf8")));
    for (const [at, text] of read.entries()) {
      const into = IS_TEST.test(batch[at]) ? tests : ships;
      for (const one of imported(text)) into.add(one);
    }
  }
  return { ships, tests };
}

const declaredIn = (manifest, field) =>
  Object.keys(manifest[field] ?? {}).filter((one) => one.startsWith(INTERNAL));

async function graph() {
  const found = await manifests();
  const folderOf = new Map(
    [...found]
      .filter(([, one]) => one.name?.startsWith(INTERNAL))
      .map(([folder, one]) => [one.name, folder]),
  );
  const used = new Map();
  for (const folder of found.keys()) used.set(folder, await usedBy(folder));
  return { found, folderOf, used };
}

/**
 * The dependency direction, which is the one rule that decides the design.
 *
 * Four edges were declared and never imported when this was written, one of
 * them the `core` to `contracts` edge the charter's picture is drawn around and
 * which the code has never had. Two more were production dependencies that only
 * a test reaches. Nothing in the toolchain looked, because `pnpm` is happy to
 * install an edge nobody walks and `tsc` never asks who declared what.
 *
 * Direction is held over production dependencies only: a devDependency ships
 * nothing. What stops that being a way round it is the rule below, which says a
 * file that ships and imports a package needs it declared where it ships.
 */
describe("the workspace graph", () => {
  it("declares every package the code imports", { timeout: 30_000 }, async () => {
    const { found, folderOf, used } = await graph();
    const wrong = [];
    for (const [folder, manifest] of found) {
      const production = new Set(declaredIn(manifest, "dependencies"));
      const any = new Set([
        ...production,
        ...declaredIn(manifest, "devDependencies"),
        ...declaredIn(manifest, "peerDependencies"),
      ]);
      for (const name of used.get(folder).ships) {
        if (!production.has(name))
          wrong.push(
            `${folder} imports ${name} where it ships and declares it ${any.has(name) ? "only for development" : "nowhere"}`,
          );
      }
      for (const name of used.get(folder).tests) {
        if (!any.has(name))
          wrong.push(`${folder} imports ${name} in a test and declares it nowhere`);
      }
      if (!folderOf.has(manifest.name) && manifest.name?.startsWith(INTERNAL))
        wrong.push(`${folder} publishes ${manifest.name}, which no folder claims`);
    }

    expect(wrong).toEqual([]);
  });

  it("imports every package it declares", { timeout: 30_000 }, async () => {
    const { found, used } = await graph();
    const dead = [];
    for (const [folder, manifest] of found) {
      const reached = new Set([...used.get(folder).ships, ...used.get(folder).tests]);
      for (const field of ["dependencies", "devDependencies"]) {
        for (const name of declaredIn(manifest, field)) {
          if (!reached.has(name))
            dead.push(`${folder} declares ${name} in ${field} and imports it nowhere`);
        }
      }
      for (const name of declaredIn(manifest, "dependencies")) {
        if (!used.get(folder).ships.has(name) && used.get(folder).tests.has(name))
          dead.push(`${folder} declares ${name} as a dependency and only a test imports it`);
      }
    }

    expect(dead).toEqual([]);
  });

  it("points every edge the way the charter points it", { timeout: 30_000 }, async () => {
    const { found, folderOf } = await graph();
    const allowed = mayUse([...found.keys()]);
    const backwards = [];
    for (const [folder, manifest] of found) {
      const may = allowed[folder];
      if (!may) throw new Error(`${folder} is a package the guard's table does not name`);
      for (const name of declaredIn(manifest, "dependencies")) {
        const target = folderOf.get(name);
        if (!may.includes(target))
          backwards.push(`${folder} depends on ${name}, which the charter does not allow it`);
      }
    }

    expect(backwards).toEqual([]);
  });
});
