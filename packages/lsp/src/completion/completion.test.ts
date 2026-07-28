import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CompletionItem } from "vscode-languageserver";
import { fixture, fixtureFromFile } from "../testing/lsp-fixture.js";

// the alias-import fixture reads:
//   import { authHeader, login } from "#shared/auth.vn"
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = "../testing/fixtures";
const EXAMPLE = resolve(HERE, FIXTURES, "alias-import.vn");

async function completeAt(needle: string, offsetInto: number): Promise<CompletionItem[]> {
  const { services, document, uri } = await fixtureFromFile(EXAMPLE);
  const at = document.textDocument.getText().indexOf(needle) + offsetInto;
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  return list?.items ?? [];
}

describe("completion", () => {
  it("offers only what the imported module marks `pub`", async () => {
    const labels = (await completeAt("{ authHeader", 2)).map((entry) => entry.label);

    // A `pub fn` crosses a file the same way a `pub fragment` does; `SCHEME`,
    // the private `const` beside them, does not.
    expect(labels.sort()).toEqual(["authHeader", "login"]);
  });

  it("offers `.vn` files under a `#alias` path", async () => {
    const labels = (await completeAt('"#shared/', 9)).map((entry) => entry.label);

    expect(labels).toContain("#shared/auth.vn");
  });

  it("offers the configured aliases before one is chosen", async () => {
    const labels = (await completeAt('"#shared/', 2)).map((entry) => entry.label);

    expect(labels).toContain("#shared/");
  });

  it("replaces the whole package name, so accepting cannot duplicate the prefix", async () => {
    const items = await completeAt('"venn/assert"', 8);
    const first = items[0];

    expect(first?.textEdit).toBeDefined();
    // The edit starts at the opening quote + 1: the whole `@venn-lang/…`, not a word.
    const edit = first?.textEdit as { range: { start: { character: number } } } | undefined;
    expect(edit?.range.start.character).toBe(5);
    expect(first?.filterText).toBe(first?.label);
  });
});

const LAMBDA = `const people = [{ name: "Ana", age: 30 }]
const grown = people.filter(fn (p) => p.age > 18)
const label = people.first.name
`;

async function membersAfter(source: string, needle: string): Promise<CompletionItem[]> {
  const { services, document, uri } = await fixture(source);
  const at = document.textDocument.getText().indexOf(needle) + needle.length;
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  return list?.items ?? [];
}

describe("member completion", () => {
  it("offers the fields of a lambda parameter, typed from the list it filters", async () => {
    const items = await membersAfter(LAMBDA, "fn (p) => p.");
    const labels = items.map((entry) => entry.label);

    expect(labels).toContain("age");
    expect(labels).toContain("name");
    expect(items.find((entry) => entry.label === "age")?.detail).toBe("number");
  });

  it("offers the built-ins of a list, with their documentation", async () => {
    const items = await membersAfter(LAMBDA, "people.");
    const map = items.find((entry) => entry.label === "map");

    expect(map?.detail).toContain("fn");
    expect(map?.documentation).toContain("passed through the function");
  });

  it("walks a dotted path before offering members", async () => {
    // The trailing dot is what the editor sees mid-typing, so the source carries it.
    const at = async (path: string): Promise<string[]> =>
      (await membersAfter(`${LAMBDA}const x = ${path}\n`, `= ${path}`)).map((e) => e.label);

    // One step in is the record: its own fields, plus what every map answers to.
    expect(await at("people.first.")).toContain("name");
    expect(await at("people.first.")).toContain("keys");
    // Two steps in is the string that field holds.
    expect(await at("people.first.name.")).toContain("upper");
  });

  it("still offers a plugin's verbs when the head is a namespace", async () => {
    const labels = (await membersAfter('use "venn/http"\nhttp.', "http.")).map(
      (entry) => entry.label,
    );

    expect(labels).toContain("get");
  });
});

describe("member completion inside a placeholder", () => {
  const IN_STRING = `const people = [{ name: "Ada", age: 36 }]
print "oldest: \${people.maxBy(fn (p) => p.)}"
`;

  it("completes a lambda parameter written inside a string", async () => {
    const labels = (await membersAfter(IN_STRING, "fn (p) => p.")).map((entry) => entry.label);

    expect(labels).toContain("age");
    expect(labels).toContain("name");
  });
});

describe("member completion after an expression", () => {
  // Every shape of receiver a dotted path cannot name. The bare number matters
  // most: parentheses are not needed to reach a method, so that is how anyone
  // will actually write it.
  it("offers a number's methods after a bare literal", async () => {
    const labels = (await membersAfter("const a = 1234.567.\n", "= 1234.567.")).map(
      (entry) => entry.label,
    );

    expect(labels).toContain("round");
    expect(labels).toContain("toFixed");
  });

  it("offers them after a parenthesised literal too", async () => {
    const labels = (await membersAfter("const a = (1234.567).\n", "= (1234.567).")).map(
      (entry) => entry.label,
    );

    expect(labels).toContain("round");
  });

  it("offers them after an integer", async () => {
    const labels = (await membersAfter("const a = 3.\n", "= 3.")).map((entry) => entry.label);

    expect(labels).toContain("times");
  });

  it("offers what a chain returned", async () => {
    const source = "const xs = [1, 2]\nconst a = xs.first.\n";
    const labels = (await membersAfter(source, "= xs.first.")).map((entry) => entry.label);

    expect(labels).toContain("toFixed");
  });

  it("offers a list's methods after a list literal", async () => {
    const labels = (await membersAfter("const a = [1, 2].\n", "= [1, 2].")).map(
      (entry) => entry.label,
    );

    expect(labels).toContain("map");
    expect(labels).toContain("sum");
  });

  it("offers a string's methods after a string literal", async () => {
    const labels = (await membersAfter('const a = "ab".\n', '= "ab".')).map((entry) => entry.label);

    expect(labels).toContain("upper");
    expect(labels).toContain("slugify");
  });
});

// `_` groups digits, and `_` also opens an identifier, so the receiver can be
// found inside the number: `1_000_000.` would take `_000_000` for its receiver
// and offer nothing at all.
describe("member completion on a number with digit separators", () => {
  it("offers the number's methods, not a phantom receiver", async () => {
    const labels = (await membersAfter("const a = 1_000_000.\n", "= 1_000_000.")).map(
      (entry) => entry.label,
    );

    expect(labels).toContain("round");
    expect(labels).toContain("times");
  });

  it("keeps offering them once part of the member is typed", async () => {
    const labels = (await membersAfter("const a = 1_000_000.ro\n", "= 1_000_000.ro")).map(
      (entry) => entry.label,
    );

    expect(labels).toContain("round");
  });

  it("still resolves a name that legitimately starts with an underscore", async () => {
    const source = "const _priv = [1, 2]\nconst a = _priv.\n";
    const labels = (await membersAfter(source, "= _priv.")).map((entry) => entry.label);

    expect(labels).toContain("map");
  });
});
