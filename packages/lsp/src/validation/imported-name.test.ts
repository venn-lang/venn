import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const LIB = `fn privado(x: number) -> number => x
pub fn publico(x: number) -> number => x
pub fragment entrar(u) { step "s" { expect true } }
`;

/** The diagnostics the editor shows for this file, by their heading. */
async function diagnostics(source: string): Promise<string[]> {
  const NEWLINE = String.fromCharCode(10);
  return (await published(source)).map((one) => `${one.code} ${one.message.split(NEWLINE)[0]}`);
}

/** The whole of each, help and note included. */
async function published(source: string) {
  const { document } = await fixture(source, { "lib.vn": LIB });
  return (document.diagnostics ?? []).map((one) => ({
    code: String(one.code),
    message: String(one.message),
  }));
}

/**
 * The editor's answer to an import that names something not published.
 *
 * It said nothing at all: the file looked fine, and the mistake arrived at run
 * time as a value that was `undefined` until something called it.
 */
describe("importing a name a file did not publish", () => {
  it("is marked in the editor", async () => {
    const found = await diagnostics('import { naoExiste } from "./lib.vn"\n');

    expect(found).toContain('VN2009 "./lib.vn" does not publish naoExiste.');
  });

  it("is marked for a name kept private too", async () => {
    const found = await diagnostics('import { privado } from "./lib.vn"\n');

    expect(found).toContain('VN2009 "./lib.vn" does not publish privado.');
  });

  /**
   * The help is the point of showing it here: the editor is where a fix is
   * acted on, and a check that worked one out said it into a field the
   * diagnostic used to drop.
   */
  it("carries what the check worked out, not only its title", async () => {
    const [found] = await published('import { naoExiste } from "./lib.vn"');

    expect(found?.message.split(String.fromCharCode(10)).length).toBeGreaterThan(1);
  });

  it("says nothing about a name that is published", async () => {
    const found = await diagnostics('import { publico } from "./lib.vn"\nconst n = publico(1)\n');

    expect(found).toEqual([]);
  });
});

/**
 * Which imported names are fragments.
 *
 * Every one of them used to count, because the neighbouring files were out of
 * reach: `run` accepted anything that had been imported, and a `pub fn` looked
 * like a fragment to everything downstream. The files are read now, so the
 * answer comes from what they actually declared.
 */
describe("telling an imported fragment from an imported function", () => {
  it("accepts `run` on a fragment", async () => {
    const source = 'import { entrar } from "./lib.vn"\nflow "f" { run entrar("ada") }\n';

    expect(await diagnostics(source)).toEqual([]);
  });

  it("refuses `run` on a function", async () => {
    const source = 'import { publico } from "./lib.vn"\nflow "f" { run publico(1) }\n';

    expect((await diagnostics(source)).join(" ")).toContain("VN2005");
  });

  /** And the other way round: a fragment is not a value. */
  it("refuses calling a fragment for a value", async () => {
    const source = 'import { entrar } from "./lib.vn"\nconst x = entrar("ada")\n';

    expect((await diagnostics(source)).join(" ")).toContain("VN3013");
  });
});
