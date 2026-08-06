import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixture, fixtureFromFile, positionOf } from "../testing/index.js";

// `examples/algorithms/06-records.vn`, which is where this was reported:
// `type Sale` and `type Summary`, used as `list<Sale>` a few lines down.
const HERE = dirname(fileURLToPath(import.meta.url));
const RECORDS = resolve(HERE, "../../../../examples/algorithms/06-records.vn");

const NEWLINE = String.fromCharCode(10);
const SOURCE = [
  "## One row of the ledger.",
  "type Sale {",
  "  seller: string",
  "}",
  "const rows: list<Sale> = []",
  "print rows",
].join(NEWLINE);

const said = (hover: { contents?: unknown } | undefined): string =>
  JSON.stringify(hover?.contents ?? "");

/**
 * A type somebody declared was invisible to the editor, in three places at once.
 *
 * `declaredName` knew a `let`, a `fn` and a parameter, so the declaration drew
 * nothing. `typeNameHover` knew the built-ins, the seven decorator handles and
 * the dotted types a plugin publishes, and returned nothing for a bare name, so
 * the use drew nothing either. `resolve` handled `run`, `@deco`, a `Ref` and an
 * import, so Ctrl+Click landed nowhere.
 *
 * Completion already offered these names, which is what made it worth fixing
 * rather than declaring out of scope: the editor could name the type while it
 * was typed and then say nothing about it once it was there.
 */
describe("a type the file declares", () => {
  it("hovers where it is declared", async () => {
    const { services, document, uri } = await fixture(SOURCE);

    const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
      textDocument: { uri },
      position: positionOf(document, "Sale {"),
    });

    expect(said(hover)).toContain("type Sale");
    expect(said(hover)).toContain("seller: string");
  });

  it("hovers where it is used, with the same card", async () => {
    const { services, document, uri } = await fixture(SOURCE);
    const at = (needle: string) => ({
      textDocument: { uri },
      position: positionOf(document, needle),
    });

    const provider = services.lsp.HoverProvider;
    const onUse = await provider?.getHoverContent(document, at("Sale> = []"));
    const onDecl = await provider?.getHoverContent(document, at("Sale {"));

    // Both, not just equal: two nulls are equal, and that was the defect.
    expect(said(onUse)).toContain("type Sale");
    expect(said(onUse)).toBe(said(onDecl));
  });

  it("carries the documentation written above it", async () => {
    const { services, document, uri } = await fixture(SOURCE);

    const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
      textDocument: { uri },
      position: positionOf(document, "Sale> = []"),
    });

    expect(said(hover)).toContain("One row of the ledger");
  });

  it("goes to its declaration from a use", async () => {
    const { services, document, uri } = await fixture(SOURCE);

    const links = await services.lsp.DefinitionProvider?.getDefinition(document, {
      textDocument: { uri },
      position: positionOf(document, "Sale> = []"),
    });

    expect(links?.length).toBe(1);
    expect(links?.[0]?.targetRange.start.line).toBe(1);
  });

  /** The file from the report, rather than a fixture of the same shape. */
  it("answers on the example that was reported", async () => {
    const { services, document, uri } = await fixtureFromFile(RECORDS);

    const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
      textDocument: { uri },
      position: positionOf(document, "Summary {"),
    });

    expect(said(hover)).toContain("type Summary");
    expect(said(hover)).toContain("rows: list<Sale>");
  });

  /**
   * A hover has an edge, and a record with forty fields would run past it. The
   * count is in the card so the cut reads as a cut rather than as the whole
   * type: a reader who sees four fields and no more has been told a lie about
   * the shape they are about to use.
   */
  it("cuts a body too tall for the card, and says how much it cut", async () => {
    const fields = Array.from({ length: 30 }, (_, at) => `  f${at}: number`);
    const { services, document, uri } = await fixture(
      ["type Wide {", ...fields, "}", "const w: Wide = {}"].join(NEWLINE),
    );

    const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
      textDocument: { uri },
      position: positionOf(document, "Wide = {}"),
    });

    expect(said(hover)).toContain("f0: number");
    expect(said(hover)).toContain("more");
    expect(said(hover)).not.toContain("f29: number");
  });

  /** The way to pass every test above is to answer for anything at all. */
  it("says nothing about a name no type declares", async () => {
    const { services, document, uri } = await fixture(
      ["const rows: list<Missing> = []", "print rows"].join(NEWLINE),
    );

    const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
      textDocument: { uri },
      position: positionOf(document, "Missing"),
    });
    const links = await services.lsp.DefinitionProvider?.getDefinition(document, {
      textDocument: { uri },
      position: positionOf(document, "Missing"),
    });

    expect(hover?.contents).toBeUndefined();
    expect(links ?? []).toEqual([]);
  });
});
