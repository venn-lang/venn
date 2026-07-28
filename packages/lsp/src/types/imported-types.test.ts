import { showType } from "@venn/core";
import { AstUtils } from "langium";
import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const LIB = `const FATOR = 3
fn privado(x: number) -> number => x * FATOR
pub fn triplo(x: number) -> number => privado(x)
pub fn identidade(x) => x
`;

/** The type inference settled on for the first `Call` in the document. */
async function callTypes(source: string): Promise<string[]> {
  const { services, document } = await fixture(source, { "lib.vn": LIB });
  const types = services.types.of(document).types;
  const found: string[] = [];
  for (const node of AstUtils.streamAst(document.parseResult.value)) {
    const type = types.get(node);
    if (node.$type === "Call" && type) found.push(showType(type));
  }
  return found;
}

async function problems(source: string): Promise<string[]> {
  const { services, document } = await fixture(source, { "lib.vn": LIB });
  return services.types.of(document).problems.map((problem) => problem.title);
}

/**
 * What the editor knows about a name that came from another file.
 *
 * The import bound nothing at all: `triplo("texto")` on a `fn(number) -> number`
 * passed without a word, and hovering the name showed nothing. The types now
 * come from the file the function was written in, checked there with *its* own
 * imports resolved, so the signature is the one it really has.
 */
describe("the type of an imported name", () => {
  it("is the one its own file gave it", async () => {
    const source = 'import { triplo } from "./lib.vn"\nconst n = triplo(2)\n';

    expect(await callTypes(source)).toEqual(["number"]);
  });

  it("catches an argument of the wrong type", async () => {
    const source = 'import { triplo } from "./lib.vn"\nconst n = triplo("texto")\n';

    expect(await problems(source)).toHaveLength(1);
    expect((await problems(source))[0]).toContain("Type mismatch");
  });

  /** A generic export stays generic: two callers, two types, no complaint. */
  it("keeps a generic export usable at more than one type", async () => {
    const source = [
      'import { identidade } from "./lib.vn"',
      "const a = identidade(1)",
      'const b = identidade("s")',
    ].join("\n");

    expect(await problems(source)).toEqual([]);
    expect(await callTypes(source)).toEqual(["number", "string"]);
  });

  it("says nothing about a file it cannot reach", async () => {
    const source = 'import { seja } from "./nao-existe.vn"\nconst n = seja(1)\n';

    expect(await problems(source)).toEqual([]);
  });
});
