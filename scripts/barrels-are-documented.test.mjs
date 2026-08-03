import { describe, expect, it } from "vitest";
import { declarationOf, documented, publishedBy } from "./barrel-exports.mjs";
import { everySource, packageEntries, relative } from "./repo-sources.mjs";

/**
 * The Langium output, which is a grammar compiled rather than a file written.
 *
 * `core/src/generated/ast.ts` publishes a hundred and seventy-five interfaces
 * and type guards, none of them documented and none of them ours to document.
 */
const GENERATED = "core/src/generated/";

/** What the barrel of every package publishes, resolved to its declaration. */
async function published() {
  const source = await everySource();
  const found = [];
  for (const { folder, entry } of await packageEntries()) {
    for (const name of publishedBy(entry, source)) {
      found.push({ folder, name, at: declarationOf({ file: entry, name, source }), source });
    }
  }
  if (found.length === 0) throw new Error("no barrel export found: the entries were not read");
  return found;
}

/**
 * JSDoc on every symbol a package barrel hands out, which is the only
 * documentation the person using it ever sees.
 *
 * Exactly one was missing when this was written, and finding it needed the
 * resolver rather than a scan: `createRunner`, the runtime's entry point, had
 * its doc block stranded above `hostPorts` by a second block written under it.
 * Two stacked `/** *\/` blocks both bind to the function below, so the file read
 * as correct and the editor showed nothing. A scan of `index.ts` alone reports
 * every re-export in the repository instead, which is hundreds of lines of
 * noise around the one line that is wrong.
 *
 * A symbol whose chain leaves the workspace, `z` from zod or `AstNode` from
 * langium, is documented where it was written. Passing it on is not a second
 * obligation to describe it.
 */
describe("every symbol a package barrel publishes", () => {
  it("carries the documentation the editor shows", { timeout: 30_000 }, async () => {
    const undocumented = [];
    for (const { folder, name, at, source } of await published()) {
      if (!at || at.outside || relative(at.file).includes(GENERATED)) continue;
      if (!documented(source.get(at.file), at.name)) {
        undocumented.push(
          `${folder} publishes ${name}, declared undocumented in ${relative(at.file)}`,
        );
      }
    }

    expect(undocumented).toEqual([]);
  });

  /** A resolver that resolved nothing would report nothing, in the same words. */
  it("is found through a chain that really resolves", async () => {
    const found = await published();
    const resolved = found.filter((one) => one.at && !one.at.outside);

    expect(found.length).toBeGreaterThan(500);
    expect(resolved.length / found.length).toBeGreaterThan(0.9);
  });
});
