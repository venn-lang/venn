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

/** Every `.ts` under a package's source, minus the tests and the generated tree. */
async function sources(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "generated" && entry.name !== "node_modules") {
      found.push(...(await sources(path)));
    } else if (entry.name.endsWith(".ts") && !/\.(test|suite)\.ts$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
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

async function declared() {
  const found = new Set();
  for (const path of CATALOGUES) {
    const text = await readFile(join(ROOT, path), "utf8");
    for (const code of text.match(CODE) ?? []) found.add(code);
  }
  return found;
}

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
  it("is declared in a catalogue", async () => {
    const known = await declared();
    const stray = [];
    for (const path of await sources(ROOT)) {
      if (isCatalogue(path)) continue;
      const text = await readFile(path, "utf8");
      for (const code of raised(text)) {
        if (!known.has(code)) stray.push(`${code} in ${path.slice(ROOT.length + 1)}`);
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
    for (const path of CATALOGUES) {
      const text = await readFile(join(ROOT, path), "utf8");
      for (const code of new Set(text.match(CODE) ?? [])) {
        seen.set(code, [...(seen.get(code) ?? []), path]);
      }
    }
    const twice = [...seen].filter(([, where]) => where.length > 1);

    expect(twice.map(([code, where]) => `${code}: ${where.join(", ")}`)).toEqual([]);
  });
});
