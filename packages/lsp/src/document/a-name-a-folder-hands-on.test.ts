import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixture, fixtureFromFile, positionOf } from "../testing/index.js";

// `examples/programs/pantry`, which is the shape this is about: `main.vn`
// imports from the folder, `larder/mod.vn` is three `pub import` lines and
// declares nothing, and `order` is a `pub fragment` in `larder/supplier.vn`.
const HERE = dirname(fileURLToPath(import.meta.url));
const PANTRY = resolve(HERE, "../../../../examples/programs/pantry/main.vn");

const NEWLINE = String.fromCharCode(10);
const lines = (...parts: readonly string[]): string => parts.join(NEWLINE);

/**
 * A folder with a face declares nothing, and two readers stopped at the face.
 *
 * `venn check` was clean and the editor drew `VN2005 · Unknown fragment "order"`
 * over a line that runs, because the walk asked whether `larder/mod.vn` declared
 * `order` and it does not: it hands it on from `./supplier.vn`. The hover had
 * the same defect wearing its fallback, `fragment …` over `mod.vn` instead of
 * the signature over the file that has it, which reads like a partial answer
 * rather than a bug and is why only the diagnostic got reported.
 *
 * An editor that disagrees with the command line is worse than one that says
 * nothing, because there is no way to tell which of the two is right.
 */
describe("a fragment a folder hands on rather than declares", () => {
  it("is not reported as unknown", async () => {
    const { document } = await fixture(
      lines('import { order } from "./larder"', "run order(1) as line", "print line"),
      {
        "larder/mod.vn": 'pub import { order } from "./supplier.vn"',
        "larder/supplier.vn": lines("pub fragment order(n) {", "  answer = n", "}"),
      },
    );

    const said = (document.diagnostics ?? []).map((one) => String(one.message));
    expect(said.filter((one) => one.includes("order"))).toEqual([]);
  });

  it("still refuses a name no file behind the face declares", async () => {
    const { document } = await fixture(
      lines('import { order } from "./larder"', "run order(1) as line", "print line"),
      { "larder/mod.vn": 'pub import { other } from "./supplier.vn"' },
    );

    const said = (document.diagnostics ?? []).map((one) => String(one.message)).join(" ");
    expect(said).toContain("order");
  });

  it("hovers with the signature from where it is declared", async () => {
    const { services, document, uri } = await fixtureFromFile(PANTRY);

    const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
      textDocument: { uri },
      position: positionOf(document, "order(one.item"),
    });

    const said = JSON.stringify(hover?.contents ?? "");
    expect(said).toContain("fragment order(item, grams)");
    expect(said).toContain("supplier.vn");
    expect(said).not.toContain("fragment …");
  });
});
