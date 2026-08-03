import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const PACKAGES = join(ROOT, "packages");
const SEPARATOR = /[/\\]/;

/**
 * Folders that hold programs rather than a module, so they publish nothing.
 *
 * Every file in them exports nothing and runs on import, and `cli/src/bin/moved.ts`
 * ends in `process.exit`. A barrel over those is an import that quits.
 */
const NOT_A_MODULE = ["cli/src/bin", "venn/src/bin"];

/**
 * Ports whose two implementations cannot share one suite yet, with why.
 *
 * Listed rather than skipped, because a port without a suite is a port whose
 * second implementation is never checked against the first, and that is the
 * whole of the rule. Each of these wants an issue, not an entry here.
 */
const NO_SUITE_YET = new Map([
  [
    "std-browser/src/port/browser-driver.port.ts",
    "the real driver is a stub whose every method throws, so one suite over both would assert nothing",
  ],
  [
    "std-browser/src/port/preview-provider.port.ts",
    "`none` is a provider that yields no frame on purpose, so the two answers differ by design",
  ],
]);

/** Every directory a package wrote, with the file names in it. */
async function folders() {
  const packages = await readdir(PACKAGES, { withFileTypes: true });
  const trees = packages
    .filter((entry) => entry.isDirectory())
    .map((entry) => below(join(PACKAGES, entry.name, "src")));
  return (await Promise.all(trees)).flat();
}

async function below(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  if (entries.length === 0) return [];
  const deeper = entries
    .filter((entry) => entry.isDirectory() && entry.name !== "generated")
    .map((entry) => below(join(dir, entry.name)));
  const here = { dir, names: entries.filter((entry) => entry.isFile()).map((entry) => entry.name) };
  return [here, ...(await Promise.all(deeper)).flat()];
}

function relative(path) {
  return path
    .slice(PACKAGES.length + 1)
    .split(SEPARATOR)
    .join("/");
}

/** A name is kebab-case in each of its dotted parts: `file-system.errors.ts`. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function shouted(name) {
  return name
    .replace(/\.ts$/, "")
    .split(".")
    .filter((part) => !KEBAB.test(part));
}

const isSource = (name) => name.endsWith(".ts");

/**
 * The rules about a package's shape that cost nothing and were checked by nobody.
 *
 * Each of these was already true of every file in the repository when it was
 * written, which is the argument for writing it down: the cheap moment to hold a
 * rule is while nothing breaks it. None of them carries an allowlist except the
 * two above, and both of those say why.
 */
describe("the shape of a package", () => {
  it("names every file in kebab-case", async () => {
    const wrong = [];
    for (const { dir, names } of await folders()) {
      for (const name of names.filter(isSource)) {
        for (const part of shouted(name)) wrong.push(`${relative(dir)}/${name}: "${part}"`);
      }
    }

    expect(wrong).toEqual([]);
  });

  it("gives every module a barrel to be imported through", async () => {
    const missing = [];
    for (const { dir, names } of await folders()) {
      const where = relative(dir);
      if (NOT_A_MODULE.includes(where) || !names.some(isSource)) continue;
      if (!names.includes("index.ts"))
        missing.push(`${where} holds ${names.filter(isSource).length} .ts and no index.ts`);
    }

    expect(missing).toEqual([]);
  });

  it("gives every package a README", async () => {
    const packages = await readdir(PACKAGES, { withFileTypes: true });
    const missing = [];
    for (const entry of packages.filter((one) => one.isDirectory())) {
      const names = await readdir(join(PACKAGES, entry.name)).catch(() => []);
      if (!names.includes("package.json")) continue;
      if (!names.includes("README.md")) missing.push(`packages/${entry.name} has no README.md`);
    }

    expect(missing).toEqual([]);
  });

  /**
   * A port is a contract with two implementations, and the suite is the contract.
   *
   * Counting implementations would mean deciding whether the file beside
   * `node-console.ts` is a second console or a helper, which is the kind of
   * guess that makes a guard nobody believes. The suite is what every
   * implementation is run against, so requiring it is requiring the rule.
   */
  it("gives every port its descriptor, its suite, its test and its barrel", async () => {
    const tree = await folders();
    const missing = [];
    for (const { dir, names } of tree) {
      for (const name of names.filter((one) => one.endsWith(".port.ts"))) {
        missing.push(...lacking({ dir, names, port: name, tree }));
      }
    }

    expect(missing).toEqual([]);
  });
});

/** What a port has not got, named one artefact at a time. */
function lacking(args) {
  const where = `${relative(args.dir)}/${args.port}`;
  const base = args.port.replace(/\.port\.ts$/, "");
  const inPackage = args.tree.filter(
    (one) => relative(one.dir).split("/")[0] === where.split("/")[0],
  );
  const held = new Set(inPackage.flatMap((one) => one.names));
  const wanted = [`${base}.suite.ts`, `${base}.test.ts`];
  const found = wanted.filter((one) => !held.has(one));
  const excused = NO_SUITE_YET.get(where);
  const gaps = excused ? [] : found.map((one) => `${where} has no ${one} in its package`);
  if (!args.names.includes("index.ts")) gaps.push(`${where} sits in a folder with no index.ts`);
  return gaps;
}
