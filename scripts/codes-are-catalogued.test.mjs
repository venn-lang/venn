import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "packages");
const CODE = /VN\d{4}/g;

/** The files that are allowed to spell a code out, because declaring is their job. */
const CATALOGUES = [
  "core/src/codes/catalog.ts",
  "contracts/src/errors/host-codes.ts",
  "sdk/src/codes.ts",
  "runtime/src/codes.ts",
  "project/src/codes.ts",
];

/**
 * Every `.ts` a package wrote, minus the tests and the generated tree.
 *
 * Each package's `src` and nothing else. Walking `packages` itself also reached
 * `dist`, whose `.d.ts` files carry the same codes as copies and are rewritten
 * by every build, so the test read whatever the last build happened to leave.
 */
async function sources() {
  const packages = await readdir(ROOT, { withFileTypes: true });
  const trees = packages
    .filter((entry) => entry.isDirectory())
    .map((entry) => written(join(ROOT, entry.name, "src")));
  return (await Promise.all(trees)).flat();
}

async function written(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const found = [];
  const deeper = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "generated") deeper.push(written(path));
    else if (entry.name.endsWith(".ts") && !/\.(test|suite)\.ts$/.test(entry.name))
      found.push(path);
  }
  return [...found, ...(await Promise.all(deeper)).flat()];
}

/**
 * Their text, a handful at a time.
 *
 * One `await` per file is one round trip per file, and eleven hundred of those
 * while three hundred test files run beside it took longer than the five
 * seconds a test is given. What made this fail was never the codes.
 */
const AT_A_TIME = 64;

async function textsOf(paths) {
  const texts = [];
  for (let from = 0; from < paths.length; from += AT_A_TIME) {
    const batch = paths.slice(from, from + AT_A_TIME).map((path) => readFile(path, "utf8"));
    texts.push(...(await Promise.all(batch)));
  }
  return texts;
}

/**
 * A code in a string, which is a code being raised.
 *
 * One in a comment or a JSDoc line is prose about a code, not a use of one, and
 * prose is where a code is explained. Only the quoted ones are held to this.
 */
function raised(text) {
  const quoted = text.match(/"VN\d{4}"|'VN\d{4}'/g) ?? [];
  return quoted.map((one) => one.slice(1, -1));
}

/** Whether this file is one of the catalogues, on either kind of path. */
function isCatalogue(path) {
  const written = path.split(SEPARATOR).join("/");
  return CATALOGUES.some((one) => written.endsWith(one));
}

const SEPARATOR = /[/\\]/;

/**
 * Every code the catalogues declare.
 *
 * A catalogue that reads back empty is a read that lost a race with a write,
 * not a catalogue with nothing in it, and letting that through would report
 * forty stray codes instead of the one thing that went wrong.
 */
async function declared() {
  const found = new Set();
  for (const [at, text] of (await catalogueTexts()).entries()) {
    const codes = text.match(CODE) ?? [];
    if (codes.length === 0) throw new Error(`${CATALOGUES[at]} read back with no codes in it`);
    for (const code of codes) found.add(code);
  }
  return found;
}

const catalogueTexts = () => textsOf(CATALOGUES.map((path) => join(ROOT, path)));

/**
 * The catalogue says it holds "every VNxxxx the kernel itself can raise", and
 * for a long time it held rather fewer: twenty-three were written where they
 * were thrown, across nine packages, including one in a family the
 * specification does not define.
 *
 * A code nobody declared is a code nobody can look up, so this is the rule that
 * keeps the list a list.
 */
describe("every code a package raises", () => {
  // A thousand files off the disk, which is not what five seconds is for. The
  // reads are batched and the tree is only each package's `src`, so this is
  // tens of milliseconds; the room is for a machine with every other test file
  // running beside this one.
  it("is declared in a catalogue", { timeout: 30_000 }, async () => {
    const known = await declared();
    const paths = (await sources()).filter((path) => !isCatalogue(path));
    const texts = await textsOf(paths);
    const stray = [];
    for (const [at, text] of texts.entries()) {
      for (const code of raised(text)) {
        if (!known.has(code)) stray.push(`${code} in ${paths[at].slice(ROOT.length + 1)}`);
      }
    }

    expect(stray).toEqual([]);
  });

  /** A family the specification does not define is a code nobody can place. */
  it("belongs to a family the specification defines", async () => {
    const outside = [...(await declared())].filter((code) => !/^VN[1-8]/.test(code));

    expect(outside).toEqual([]);
  });

  it("is declared once, and not by two catalogues at odds", async () => {
    const seen = new Map();
    for (const [at, text] of (await catalogueTexts()).entries()) {
      for (const code of new Set(text.match(CODE) ?? [])) {
        seen.set(code, [...(seen.get(code) ?? []), CATALOGUES[at]]);
      }
    }
    const twice = [...seen].filter(([, where]) => where.length > 1);

    expect(twice.map(([code, where]) => `${code}: ${where.join(", ")}`)).toEqual([]);
  });
});
