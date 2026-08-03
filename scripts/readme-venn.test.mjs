import { describe, expect, it } from "vitest";
import { everyBlock, fencesIn, readmes } from "./readme-fences.mjs";
import { committed } from "./readme-venn.mjs";

/**
 * The half of the README guard that needs nothing built.
 *
 * Putting a block through the checker needs `packages/cli/dist`, so that is a
 * CI step after Build. What can be held here is the bookkeeping around it: that
 * the recorded refusals point at READMEs that exist and carry that many blocks,
 * so a README losing its Venn cannot leave a number behind pointing at nothing.
 */
describe("the Venn a package README shows", () => {
  it("is found by its fence, opened and closed", () => {
    const found = fencesIn('# A\n\n```ruby\nprint "a"\n```\n\ntext\n\n```ts\nconst a = 1;\n```\n');

    expect(found.map((one) => one.tag)).toEqual(["ruby", "ts"]);
    expect(found[0].body).toBe('print "a"');
    expect(found[0].line).toBe(3);
  });

  it("is what the recorded refusals point at", async () => {
    const recorded = await committed();
    const blocks = await everyBlock();
    const wrong = [];
    for (const [readme, count] of Object.entries(recorded)) {
      const here = blocks.filter((one) => one.readme === readme).length;
      if (here < count)
        wrong.push(`${readme}: ${count} refusals recorded and ${here} Venn blocks in it`);
    }

    expect(wrong).toEqual([]);
  });

  /** A package that shows no Venn at all is a package this rule cannot reach. */
  it("is shown by most of the packages, and by every plugin", async () => {
    const withVenn = new Set((await everyBlock()).map((one) => one.folder));
    const plugins = (await readmes())
      .map((one) => one.folder)
      .filter((one) => one.startsWith("std-"));

    expect(plugins.filter((one) => !withVenn.has(one))).toEqual([]);
  });
});
