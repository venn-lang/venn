/**
 * The repository as the guards read it: every source file, once, by path.
 *
 * Three guards walk the same tree, and the two that were written first each
 * kept their own copy of the walk. A third copy is where a walk starts
 * disagreeing with itself, so this is the one.
 *
 * Nothing here is built, and nothing here spawns anything: `pnpm test` runs
 * from `src` with no build, and a guard that needs `dist` belongs in CI.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const ROOT = join(import.meta.dirname, "..");
export const PACKAGES = join(ROOT, "packages");

const SEPARATOR = /[\\/]/;

/** A path as the guards print it, with one kind of slash on every platform. */
export const slashed = (path) => path.split(SEPARATOR).join("/");

/** A path from the repository root, which is what a person can open. */
export const relative = (path) => slashed(path).slice(slashed(ROOT).length + 1);

/** A quoted run, kept in the first three groups, or a comment, which is not. */
const CHUNK =
  /("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(`(?:[^`\\]|\\.)*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

/**
 * The file with its comments replaced by a space, strings left alone.
 *
 * Prose about an import is not an import. `file-system.types.ts` explains the
 * neutrality rule by quoting `import fs from "node:fs"` in its JSDoc, and a
 * guard that reads that as an import fails the file that states the rule.
 */
export function code(text) {
  return text.replace(CHUNK, (whole, ...kept) =>
    kept.slice(0, 3).every((one) => one === undefined) ? " " : whole,
  );
}

/**
 * Every module specifier a file names.
 *
 * `from "x"` covers an import and a re-export alike; the other two forms are an
 * import with nothing bound, and a dynamic one.
 */
export function specifiers(source) {
  const text = code(source);
  return [
    ...[...text.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((one) => one[1]),
    ...[...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map((one) => one[1]),
    ...[...text.matchAll(/\bimport\s+["']([^"']+)["']/g)].map((one) => one[1]),
  ];
}

/** The files a relative specifier could mean, written `./x.js` and living at `x.ts`. */
export function candidates(from, specifier) {
  const at = slashed(from).split("/").slice(0, -1);
  for (const part of specifier.split("/")) walk(at, part);
  const target = at.join("/");
  const stem = target.endsWith(".js") ? target.slice(0, -3) : target;
  return [`${stem}.ts`, `${stem}/index.ts`, target];
}

function walk(at, part) {
  if (part === "..") at.pop();
  else if (part !== "." && part !== "") at.push(part);
}

/** The one file a relative specifier means, or nothing when it leaves the tree. */
export function resolveFrom(args) {
  return candidates(args.from, args.specifier).find((one) => args.source.has(one));
}

const AT_A_TIME = 64;

/**
 * Every `.ts` file a package wrote, read once and kept by path.
 *
 * One `await` per file is one round trip per file, and a thousand of those with
 * three hundred test files running beside them takes longer than the five
 * seconds a test is given.
 */
export async function everySource() {
  const paths = await sourcePaths();
  const text = new Map();
  for (let from = 0; from < paths.length; from += AT_A_TIME) {
    const batch = paths.slice(from, from + AT_A_TIME);
    const read = await Promise.all(batch.map((path) => readFile(path, "utf8")));
    for (const [at, one] of read.entries()) text.set(slashed(batch[at]), one);
  }
  if (text.size === 0) throw new Error("no source read: packages/*/src was not found");
  return text;
}

async function sourcePaths() {
  const packages = await readdir(PACKAGES, { withFileTypes: true });
  const trees = packages
    .filter((entry) => entry.isDirectory())
    .map((entry) => written(join(PACKAGES, entry.name, "src")));
  return (await Promise.all(trees)).flat();
}

async function written(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const found = [];
  const deeper = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) deeper.push(written(path));
    else if (entry.name.endsWith(".ts")) found.push(path);
  }
  return [...found, ...(await Promise.all(deeper)).flat()];
}

/** Each `entry: [...]` in a tsdown config, with the platform it is built for. */
function builds(text) {
  const entries = [...text.matchAll(/entry:\s*\[([^\]]*)\]/g)];
  const platforms = [...text.matchAll(/platform:\s*"(\w+)"/g)];
  return entries.map((entry, at) => ({
    files: [...entry[1].matchAll(/"([^"]+)"/g)].map((one) => one[1]),
    platform: platforms[at]?.[1] ?? "node",
  }));
}

/** Every entry point every package publishes, as `{ folder, entry, platform }`. */
export async function packageEntries() {
  const packages = await readdir(PACKAGES, { withFileTypes: true });
  const found = [];
  for (const entry of packages.filter((one) => one.isDirectory())) {
    const text = await readFile(join(PACKAGES, entry.name, "tsdown.config.ts"), "utf8").catch(
      () => "",
    );
    for (const build of builds(text)) {
      for (const file of build.files)
        found.push({
          folder: entry.name,
          entry: slashed(join(PACKAGES, entry.name, ...file.split("/"))),
          platform: build.platform,
        });
    }
  }
  if (found.length === 0) throw new Error("no entry found: the tsdown configs were not read");
  return found;
}
