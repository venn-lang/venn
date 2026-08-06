// biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are Venn source under test, where ${…} is the language's own interpolation.
import { describe, expect, it } from "vitest";
import { fixture, positionOf } from "../testing/lsp-fixture.js";

const SOURCE = `module demo.lsp

import { http } from "venn/http"
import { assert } from "venn/assert"

fragment login(user) {
  step "in" { expect true }
}

flow "Checkout" {
  @retry(2)
  step "Ping" {
    let plan = "pro"
    http.get "https://example.com"
    expect plan oneOf ["free", "pro"]
    run login("alice")
  }
}`;

async function hoverAt(needle: string): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: positionOf(document, needle),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

describe("hover", () => {
  it("describes an action with its signature and package", async () => {
    const text = await hoverAt("http.get");

    expect(text).toContain("http.get");
    expect(text).toContain("venn/http");
  });

  it("describes a matcher used after expect", async () => {
    const text = await hoverAt("oneOf");

    expect(text).toContain("oneOf");
    expect(text).toContain("venn/assert");
  });

  it("explains an annotation", async () => {
    expect(await hoverAt("@retry")).toContain("backoff");
  });

  it("resolves a local binding", async () => {
    expect(await hoverAt("plan oneOf")).toContain("let plan");
  });

  it("shows the signature of a fragment behind `run`", async () => {
    expect(await hoverAt('login("alice")')).toContain("fragment login(user)");
  });

  it("says what a used package contributes", async () => {
    expect(await hoverAt('"venn/http"')).toContain("action");
  });

  // Which token the cursor is on decides the hover, not merely which node.
  it("explains the `run` keyword, not the fragment it happens to call", async () => {
    const text = await hoverAt("run login");

    expect(text).toContain("Invoke a fragment");
    expect(text).not.toContain("fragment login(user)");
  });

  it("still describes the fragment when the cursor is on its name", async () => {
    expect(await hoverAt('login("alice")')).toContain("fragment login(user)");
  });

  it("documents the structural keywords a newcomer meets first", async () => {
    expect(await hoverAt('flow "Checkout"')).toContain("top-level unit");
    expect(await hoverAt('step "Ping"')).toContain("named unit of work");
    expect(await hoverAt("expect plan")).toContain("Assert");
  });
});

const TYPED = `import { io } from "venn/io"

fn double(x) => x * 2

flow "F" {
  step "s" {
    const nums = [1, 2, 3]
    const head = nums.first
    expect true
  }
}`;

describe("inferred type hover", () => {
  async function hoverAt(needle: string): Promise<string> {
    const { services, document, uri } = await fixture(TYPED);
    const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
      textDocument: { uri },
      position: positionOf(document, needle),
    });
    return hoverText(hover);
  }

  it("shows the inferred type of an expression with no symbol of its own", async () => {
    // `.first` on a list<number> is a number, inferred, not declared anywhere.
    expect(await hoverAt("first")).toContain("number");
  });

  it("infers the element type of a list literal", async () => {
    expect(await hoverAt("nums = ")).toContain("list<number>");
  });

  // Punctuation belongs to the expression around it. Answering for that
  // expression made hovering `(` in `xs.filter(fn (p) => …)` report the item
  // type, as if the bracket itself were a value.
  it("says nothing about brackets", async () => {
    expect(await hoverAt("[1, 2, 3]")).toBe("");
    expect(await hoverAt("(x)")).toBe("");
  });
});

function hoverText(hover: unknown): string {
  const contents = (hover as { contents?: unknown })?.contents;
  return typeof contents === "object" && contents && "value" in contents
    ? String((contents as { value: unknown }).value)
    : "";
}

const TYPED_DECLS = `fn double(x) => x * 2

flow "F" {
  step "s" {
    const nums = [1, 2, 3]
    const name = "Ada"
    const seniors = nums.filter(fn (n) => n > 1)
    expect true
  }
}`;

describe("types on declarations", () => {
  async function hoverAt(needle: string): Promise<string> {
    const { services, document, uri } = await fixture(TYPED_DECLS);
    const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
      textDocument: { uri },
      position: positionOf(document, needle),
    });
    return hoverText(hover);
  }

  it("shows the type of a const on its own name", async () => {
    expect(await hoverAt("nums = ")).toContain("list<number>");
    expect(await hoverAt("name = ")).toContain("string");
  });

  it("shows the inferred type of a chained expression's binding", async () => {
    expect(await hoverAt("seniors")).toContain("list<number>");
  });

  /**
   * The language's own spelling, not the type printed twice. It used to read
   * `fn double(x): fn(number) -> number`, where a colon in front of a `fn(…)`
   * says the answer is a function and the parameter list is given over again.
   */
  it("shows a function's inferred signature", async () => {
    const markdown = await hoverAt("double(x)");

    expect(markdown).toContain("fn double(x: number) -> number");
    expect(markdown).not.toContain(": fn(");
  });
});

const INTERPOLATED = `const people = [{ name: "Ada", team: "core", age: 36 }]

print "oldest: \${people.maxBy(fn (p) => p.age).name}"
const seniors = people.filter(fn (q) => q.age > 35)
`;

describe("hover inside a placeholder", () => {
  async function hoverAt(needle: string, into = 0): Promise<string> {
    const { services, document, uri } = await fixture(INTERPOLATED);
    const at = document.textDocument.getText().indexOf(needle) + into;
    const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
      textDocument: { uri },
      position: document.textDocument.positionAt(at),
    });
    return hoverText(hover);
  }

  // The lambda lives inside the string, so the document's own tree stops short
  // of it. Reading `p` as the string it sits in was the bug.
  it("types a lambda parameter written inside a string", async () => {
    const text = await hoverAt("p.age");

    expect(text).toContain("name: string");
    expect(text).toContain("age: number");
    expect(text).not.toContain("```venn\nstring\n```");
  });

  it("reads a field of that parameter", async () => {
    expect(await hoverAt("p.age", 2)).toContain("number");
  });

  it("still reaches names the document declared", async () => {
    expect(await hoverAt("people.maxBy")).toContain("list<");
  });

  it("types a lambda parameter written plainly, too", async () => {
    const text = await hoverAt("q) =>");

    expect(text).toContain("age: number");
  });
});

// A receiver the dotted-path resolver cannot name. Inside a string this used to
// answer with the string's own type, which said `round` did not exist.
const LITERALS = `const xs = [1, 2, 3]
const a = (1234.567).round(2)
const b = 1234.567.round(2)
const c = xs.first.toFixed(1)

print "money: \${(1234.567).round(2)}"
`;

describe("members of an expression", () => {
  async function hoverAt(needle: string, into: number): Promise<string> {
    const { services, document, uri } = await fixture(LITERALS);
    const at = document.textDocument.getText().indexOf(needle) + into;
    const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
      textDocument: { uri },
      position: document.textDocument.positionAt(at),
    });
    return hoverText(hover);
  }

  it("describes a method on a parenthesised number", async () => {
    const text = await hoverAt("(1234.567).round(2)", 12);

    expect(text).toContain("number.round");
    expect(text).toContain("decimal places");
  });

  // Parentheses are not required: `1234.567` lexes whole, and `.round` follows.
  it("describes it without the parentheses too", async () => {
    expect(await hoverAt("= 1234.567.round(2)", 11)).toContain("number.round");
  });

  it("describes it inside a string, where it used to answer `string`", async () => {
    const text = await hoverAt("${(1234.567).round(2)}", 14);

    expect(text).toContain("number.round");
    expect(text).not.toContain("```venn\nstring\n```");
  });

  it("describes a method on what a chain returned", async () => {
    expect(await hoverAt("xs.first.toFixed", 9)).toContain("number.toFixed");
  });
});
