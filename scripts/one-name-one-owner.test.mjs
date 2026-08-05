import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { everySource, packageEntries, relative } from "./repo-sources.mjs";
import { twoOwners } from "./two-owners.mjs";

const BASELINE = join(import.meta.dirname, "two-owners-baseline.json");

/** What already collided when this guard was written, held so it cannot grow. */
async function baseline() {
  return JSON.parse(await readFile(BASELINE, "utf8"));
}

/** Every collision in the workspace, by the barrel that publishes it. */
async function collisions() {
  const source = await everySource();
  const found = new Map();
  for (const { entry } of await packageEntries()) {
    const two = twoOwners(entry, source);
    if (two.length > 0) found.set(relative(entry), two);
  }
  return found;
}

/** The names one barrel is allowed to publish twice, or none. */
const held = (baseline, path) => baseline[path] ?? [];

/**
 * One name, one owner, across every barrel a package publishes.
 *
 * The charter makes a folder one responsibility and a name one owner, and
 * nothing held that across an `export *`. So the rule was rediscovered by hand:
 * `kindOf` and `rootOf` both had to be renamed in one epic, and half a session
 * went to the same hazard before that.
 *
 * The compiler catches half of it. Two `export *` publishing two different
 * declarations of one name is TS2308, for types exactly as for values, which is
 * how both of those renames were found. What it never reports is the other
 * half: a written `export { X } from` beside a star that also publishes `X`.
 * TS2308's own advice is to re-export explicitly, so a written clause is the
 * compiler's recommended fix and can never be its complaint. The written one
 * wins, and the starred module's `X` is published by its folder and
 * unreachable from the package. `LiteralType` is exactly that and is the only
 * entry in the baseline, filed as venn-lang/venn#308 rather than fixed here,
 * because renaming the generated side changes `$type` on the wire.
 */
describe("every name a package barrel publishes", () => {
  it("comes from exactly one module", { timeout: 30_000 }, async () => {
    const pinned = await baseline();
    const unheld = [...(await collisions())].flatMap(([path, two]) =>
      two.filter((one) => !held(pinned, path).includes(one.name)).map((one) => one.said),
    );

    expect(unheld).toEqual([]);
  });

  /**
   * A collision that has been fixed keeps failing until its baseline line goes
   * too, so the list shrinks and never quietly stops describing the tree.
   */
  it("no longer collides where the baseline says it stopped", { timeout: 30_000 }, async () => {
    const found = await collisions();
    const stale = Object.entries(await baseline()).flatMap(([path, names]) =>
      names
        .filter((name) => !(found.get(path) ?? []).some((one) => one.name === name))
        .map((name) => `${path}: \`${name}\` no longer collides, so drop it from the baseline`),
    );

    expect(stale).toEqual([]);
  });

  /**
   * A reader that read nothing would report nothing, in the same words.
   *
   * Not a hypothetical. The first pass at this used a regex over `export {`,
   * which skipped every `export type { … }` block: it saw 82 of core's 136
   * published names and answered "no collisions", which is what a correct
   * reader answers too. The counts are asserted so a reader that stops seeing
   * most of the tree fails instead of agreeing with it.
   */
  it("is read through barrels that really resolve", { timeout: 30_000 }, async () => {
    const source = await everySource();
    const entries = await packageEntries();
    const core = entries.find((one) => relative(one.entry) === "packages/core/src/index.ts");
    const { contributions } = await import("./barrel-exports.mjs");
    const names = contributions(core.entry, source).flatMap((one) => one.names);

    expect(entries.length).toBeGreaterThan(20);
    expect(new Set(names).size).toBeGreaterThan(400);
    expect(names.some((one) => one === "LiteralType")).toBe(true);
  });
});
