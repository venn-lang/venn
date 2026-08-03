import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const PACKAGES = join(ROOT, "packages");

/**
 * The passes a `.vn` file goes through, by the name each is called by.
 *
 * Each of these used to be called straight from a command, and each command
 * called a different subset: `venn run` did four of them, `venn check` did
 * seven, the editor did five and one of those without the registry it had
 * already built. A pass added to one reached only that consumer.
 */
const PASSES = [
  "checkDocument",
  "checkImports",
  "checkTypes",
  "importedTypes",
  "createTypeCatalog",
  "publishedValueTypes",
  "createDecoratorSource",
];

/**
 * The one place allowed to call them, and the barrels that hand them out.
 *
 * Everything else asks the front end. Adding a file here is deciding to open a
 * second pipeline, which is the thing this test exists to make deliberate.
 */
const FRONT_END = [
  "runtime/src/analyze/create-front-end.ts",
  "runtime/src/analyze/index.ts",
  "runtime/src/check/index.ts",
  "runtime/src/types/index.ts",
  "runtime/src/decorators/index.ts",
  "runtime/src/index.ts",
];

/**
 * Where a pass is written, which is not a call to it, and the one place that
 * builds a decorator source to *run* decorators rather than to check them.
 */
const NOT_A_CALL_SITE = [
  "core/src/typecheck/check-types.ts",
  "core/src/typecheck/imported-types.ts",
  "runtime/src/check/check-document.ts",
  "runtime/src/check/check-imports.ts",
  "runtime/src/types/create-type-catalog.ts",
  "runtime/src/types/published-values.ts",
  "runtime/src/decorators/create-decorator-source.ts",
  "runtime/src/run/create-runner.ts",
];

/** Every `.ts` a package wrote, minus the tests and the generated tree. */
async function sources() {
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
    if (entry.isDirectory() && entry.name !== "generated") deeper.push(written(path));
    else if (entry.name.endsWith(".ts") && !/\.(test|suite)\.ts$/.test(entry.name))
      found.push(path);
  }
  return [...found, ...(await Promise.all(deeper)).flat()];
}

const AT_A_TIME = 64;

async function textsOf(paths) {
  const texts = [];
  for (let from = 0; from < paths.length; from += AT_A_TIME) {
    const batch = paths.slice(from, from + AT_A_TIME).map((path) => readFile(path, "utf8"));
    texts.push(...(await Promise.all(batch)));
  }
  return texts;
}

/** A name followed by an open bracket, which is the name being called. */
function calls(text) {
  return PASSES.filter((pass) => new RegExp(`\\b${pass}\\s*\\(`).test(text));
}

function relative(path) {
  return path
    .slice(PACKAGES.length + 1)
    .split(SEPARATOR)
    .join("/");
}

const SEPARATOR = /[/\\]/;

const allowed = new Set([...FRONT_END, ...NOT_A_CALL_SITE]);

/**
 * One front end, so a pass added once reaches every command.
 *
 * There is no way to write this as a type: three call sites that each happen to
 * list the same passes typecheck perfectly, and that is exactly the state this
 * repository was in. What can be checked is that nobody outside the front end
 * calls a pass at all, which is the property the epic was about, and the reason
 * `venn run` and `venn test` never type-checked for a milestone.
 */
describe("every pass over a .vn file", () => {
  it("is called from the front end and from nowhere else", { timeout: 30_000 }, async () => {
    const paths = await sources();
    const texts = await textsOf(paths);
    const stray = [];
    for (const [at, text] of texts.entries()) {
      const where = relative(paths[at]);
      if (allowed.has(where)) continue;
      for (const pass of calls(text)) stray.push(`${pass} in ${where}`);
    }

    expect(stray).toEqual([]);
  });

  /** A list that has drifted from the code is a guard that no longer guards. */
  it("is one the front end really runs", async () => {
    const path = join(PACKAGES, "runtime/src/analyze/create-front-end.ts");
    const text = await readFile(path, "utf8");

    expect(PASSES.filter((pass) => !text.includes(pass))).toEqual([]);
  });
});
