import { describe, expect, it } from "vitest";
import { applyEdits, fixture, positionOf } from "../testing/lsp-fixture.js";

async function renameAt(source: string, needle: string, newName: string): Promise<string> {
  const { services, document, uri } = await fixture(source);
  const workspaceEdit = await services.lsp.RenameProvider?.rename(document, {
    textDocument: { uri },
    position: positionOf(document, needle),
    newName,
  });
  return applyEdits(document, workspaceEdit?.changes?.[uri] ?? []);
}

const FRAGMENT = `fragment login(user) {
  step "in" { expect true }
}

flow "F" {
  run login("alice")
}`;

// Two sibling steps each bind their own `x`; renaming one must not touch the other.
const SHADOWED = `flow "F" {
  step "a" {
    let x = 1
    expect x
  }
  step "b" {
    let x = 2
    expect x
  }
}`;

describe("rename", () => {
  it("renames a fragment together with the `run` that calls it", async () => {
    const renamed = await renameAt(FRAGMENT, "login(user)", "signIn");

    expect(renamed).toContain("fragment signIn(user)");
    expect(renamed).toContain('run signIn("alice")');
  });

  it("renames from the call site too", async () => {
    const renamed = await renameAt(FRAGMENT, 'login("alice")', "signIn");

    expect(renamed).toContain("fragment signIn(user)");
    expect(renamed).toContain('run signIn("alice")');
  });

  it("renames only the references bound by the same declaration", async () => {
    const renamed = await renameAt(SHADOWED, "x = 1", "count");

    expect(renamed).toContain("let count = 1");
    expect(renamed).toContain("expect count");
    expect(renamed).toContain("let x = 2");
    expect(renamed.match(/expect x\b/g)).toHaveLength(1);
  });
});

/**
 * Rename reaches as far as "find all references" does.
 *
 * A `fn`, a declared type and anything reached through an import all count. A
 * rename that changes one of several places leaves the rest naming something
 * that no longer exists, so both read the same occurrences.
 */
describe("what rename reaches now", () => {
  it("renames a function and every call to it", async () => {
    const source =
      "fn dobro(x: number) -> number => x * 2\nconst a = dobro(1)\nconst b = dobro(2)\n";

    expect(await renameAt(source, "dobro(x", "triplo")).toBe(
      "fn triplo(x: number) -> number => x * 2\nconst a = triplo(1)\nconst b = triplo(2)\n",
    );
  });

  it("renames a declared type where it is written", async () => {
    const source = "type Preco { id: number }\nconst p: Preco = { id: 1 }\nfn f(x: Preco) => x\n";

    expect(await renameAt(source, "Preco {", "Valor")).toBe(
      "type Valor { id: number }\nconst p: Valor = { id: 1 }\nfn f(x: Valor) => x\n",
    );
  });

  it("renames a name in the import list along with its uses", async () => {
    const { services, document, uri } = await fixture(
      'import { dobro } from "./lib.vn"\nconst n = dobro(2)\n',
      { "lib.vn": "pub fn dobro(x: number) -> number => x * 2\n" },
    );
    const edit = await services.lsp.RenameProvider?.rename(document, {
      textDocument: { uri },
      position: positionOf(document, "dobro(2)"),
      newName: "triplo",
    });

    expect(applyEdits(document, edit?.changes?.[uri] ?? [])).toBe(
      'import { triplo } from "./lib.vn"\nconst n = triplo(2)\n',
    );
    expect(Object.keys(edit?.changes ?? {})).toHaveLength(2);
  });
});
