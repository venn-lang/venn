// biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are Venn source under test, where ${…} is the language's own interpolation.
import type { LangiumDocument } from "langium";
import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `module demo.aliasimport

use "@venn/http" as h
import { login } from "#shared/auth.vn"

fragment helper(user) {
  step "in" { expect true }
}

flow "Checkout" {
  @retry(2)
  step "Ping" {
    let plan = "pro"
    http.get "https://example.com"
    expect plan oneOf ["free", "pro"]
    run login("alice")
    forEach item in ["a"] { expect item }
  }
}`;

interface Token {
  line: number;
  char: number;
  length: number;
  type: string | undefined;
}

// Semantic tokens arrive delta-encoded: deltaLine, deltaChar, length, type, modifiers.
function decode(data: readonly number[], types: Record<string, number>): Token[] {
  const byIndex = new Map(Object.entries(types).map(([name, index]) => [index, name]));
  const tokens: Token[] = [];
  let line = 0;
  let char = 0;
  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i] as number;
    line += deltaLine;
    char = deltaLine === 0 ? char + (data[i + 1] as number) : (data[i + 1] as number);
    tokens.push({
      line,
      char,
      length: data[i + 2] as number,
      type: byIndex.get(data[i + 3] as number),
    });
  }
  return tokens;
}

function typeAt(document: LangiumDocument, tokens: Token[], needle: string): string | undefined {
  const position = document.textDocument.positionAt(
    document.textDocument.getText().indexOf(needle),
  );
  const hit = tokens.find(
    (token) =>
      token.line === position.line &&
      token.char <= position.character &&
      position.character < token.char + token.length,
  );
  return hit?.type;
}

async function tokensOf(source = SOURCE): Promise<{ document: LangiumDocument; tokens: Token[] }> {
  const { services, document, uri } = await fixture(source);
  const provider = services.lsp.SemanticTokenProvider;
  const result = await provider?.semanticHighlight(document, { textDocument: { uri } });
  return { document, tokens: decode(result?.data ?? [], provider?.tokenTypes ?? {}) };
}

describe("semantic tokens", () => {
  it("colours the module header, imports and every call site", async () => {
    const { document, tokens } = await tokensOf();
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("demo.aliasimport")).toBe("namespace");
    expect(at('"@venn/http"')).toBe("string");
    expect(at("h\n")).toBe("namespace");
    expect(at("login }")).toBe("function");
    expect(at('"#shared/auth.vn"')).toBe("string");
    // `run` names a fragment, and a fragment is not a function: it expands into
    // the steps it declares. `macro` is the standard type that says so.
    expect(at('login("alice")')).toBe("macro");
  });

  it("separates namespace, action, matcher and annotation", async () => {
    const { document, tokens } = await tokensOf();
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("http.get")).toBe("namespace");
    expect(at("get ")).toBe("function");
    expect(at("oneOf")).toBe("method");
    expect(at("retry")).toBe("decorator");
  });

  it("colours declarations, bindings and loop variables", async () => {
    const { document, tokens } = await tokensOf();
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("helper(user)")).toBe("macro");
    expect(at("user)")).toBe("parameter");
    expect(at("plan = ")).toBe("variable");
    expect(at("item in")).toBe("variable");
    expect(at('"Checkout"')).toBe("string");
  });
});

const INTERPOLATED = `flow "t" {
  step "s" {
    let base = "https://api.test"
    http.get "\${base}/users/\${account.id}?x=1"
    expect true
  }
}`;

describe("interpolated strings", () => {
  it("paints the code inside ${…} as code, not as prose", async () => {
    const { document, tokens } = await tokensOf(INTERPOLATED);
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("base}")).toBe("variable");
    expect(at("account.id")).toBe("variable");
    expect(at("id}")).toBe("property");
  });

  it("keeps the literal chunks around a placeholder as string", async () => {
    const { document, tokens } = await tokensOf(INTERPOLATED);
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("/users/")).toBe("string");
    expect(at("?x=1")).toBe("string");
  });

  it("leaves a plain string as one string token", async () => {
    const { document, tokens } = await tokensOf(INTERPOLATED);

    expect(typeAt(document, tokens, '"https://api.test"')).toBe("string");
  });
});

const BOUND_CALL = `use "@venn/http"

flow "t" {
  step "s" {
    let auth = http.post "https://api.test" { body: { a: 1 } }
    expect auth.status == 200
  }
}`;

describe("an action bound with let", () => {
  it("colours the path as a call, not as a variable", async () => {
    const { document, tokens } = await tokensOf(BOUND_CALL);
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("http.post")).toBe("namespace");
    expect(at("post ")).toBe("function");
    expect(at("auth = ")).toBe("variable");
  });

  it("leaves an ordinary field read alone", async () => {
    const { document, tokens } = await tokensOf(BOUND_CALL);

    expect(typeAt(document, tokens, "auth.status")).toBe("variable");
  });
});

const MEMBERS = `use "@venn/fmt"

flow "t" {
  step "s" {
    const nums = [1, 2, 3]
    const doubled = nums.map(fn (n) => n * 2)
    const size = nums.len
    const user = { name: "Ada" }
    const who = user.name
    const text = fmt.json(user, 0)
    expect true
  }
}`;

describe("member access", () => {
  it("colours a built-in method as a method, and a property as a property", async () => {
    const { document, tokens } = await tokensOf(MEMBERS);
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("map(fn")).toBe("method");
    expect(at("len\n")).toBe("property");
  });

  it("colours a plain field access rather than leaving it blank", async () => {
    const { document, tokens } = await tokensOf(MEMBERS);

    expect(typeAt(document, tokens, "name\n")).toBe("property");
  });

  it("still separates a namespace from its verb", async () => {
    const { document, tokens } = await tokensOf(MEMBERS);
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("fmt.json")).toBe("namespace");
    expect(at("json(user")).toBe("function");
  });
});

const IN_STRING = `use "@venn/fmt"

flow "t" {
  step "s" {
    const people = [{ name: "Ada", age: 36 }]
    print "by team: \${fmt.json(people.map(fn (p) => p.name), 0)}"
    print "count: \${people.len} of \${range(3)}"
    expect true
  }
}`;

describe("names inside an interpolation", () => {
  it("colours a namespace and its verb, not flat prose", async () => {
    const { document, tokens } = await tokensOf(IN_STRING);
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("fmt.json")).toBe("namespace");
    expect(at("json(people")).toBe("function");
  });

  it("colours a called method as a method and a read as a property", async () => {
    const { document, tokens } = await tokensOf(IN_STRING);
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("map(fn")).toBe("method");
    expect(at("len}")).toBe("property");
  });

  it("colours a prelude name as a function", async () => {
    const { document, tokens } = await tokensOf(IN_STRING);

    expect(typeAt(document, tokens, "range(3)")).toBe("function");
  });
});

const DECORATED = `deco memoize(target: Fn) {
  target.meta "memoize" true
}

@memoize
fn double(x) => x * 2`;

describe("a decorator declared in the language", () => {
  it("introduces a name, so `deco` is a declaration keyword", async () => {
    const { document, tokens } = await tokensOf(DECORATED);

    expect(typeAt(document, tokens, "deco memoize")).toBe("keyword");
  });

  // `deco memoize` and `@memoize` are one thing seen twice, so they colour alike.
  it("colours the declared name the way the `@name` that applies it is coloured", async () => {
    const { document, tokens } = await tokensOf(DECORATED);
    const at = (needle: string) => typeAt(document, tokens, needle);

    expect(at("memoize(target")).toBe("decorator");
    expect(at("memoize\nfn double")).toBe("decorator");
    expect(at("target: Fn")).toBe("parameter");
  });
});
