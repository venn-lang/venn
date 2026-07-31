// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test.
import { describe, expect, it } from "vitest";
import { fixture, positionOf } from "../testing/lsp-fixture.js";

const SOURCE = `import { fmt } from "venn/fmt"

const people = [{ name: "Ada", age: 36 }]
const nums = [1, 2, 3]

print "prelude:" range(3) typeOf(nums)
print "inside: \${fmt.json(people, 0)} and \${nums.map(fn (n) => n * 2)}"

flow "f" {
  step "s" {
    const oldest = people.maxBy(fn (p) => p.age)
    expect oldest != null
  }
}`;

async function hoverAt(needle: string, offset = 0): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const position = positionOf(document, needle);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: { line: position.line, character: position.character + offset },
  });
  const contents = hover?.contents;
  return typeof contents === "object" && contents && "value" in contents
    ? String((contents as { value: unknown }).value)
    : "";
}

describe("prelude names", () => {
  it("documents `range` instead of calling it dynamic", async () => {
    const markdown = await hoverAt("range(3)");

    expect(markdown).toContain("list<number>");
    expect(markdown).toContain("The end is exclusive");
    expect(markdown).toContain("Prelude");
    expect(markdown).not.toContain("dynamic");
  });

  it("documents `typeOf` with its return type", async () => {
    const markdown = await hoverAt("typeOf(nums)");

    expect(markdown).toContain("typeOf(value) -> string");
    expect(markdown).toContain("Example");
  });
});

describe("namespaces", () => {
  it("says `fmt` is a namespace, not a string or a map", async () => {
    const markdown = await hoverAt("fmt.json");

    expect(markdown).toContain("namespace fmt");
    expect(markdown).toContain("Verbs");
    expect(markdown).toContain("venn/fmt");
  });

  it("documents a namespace verb reached inside an interpolation", async () => {
    // `.json` sits four characters past the start of `fmt.json`.
    const markdown = await hoverAt("fmt.json", 4);

    expect(markdown).toContain("fmt.json");
    expect(markdown).toContain("one line");
    expect(markdown).toContain("Package");
  });
});

describe("built-in members", () => {
  it("documents a list method with the element type resolved", async () => {
    const markdown = await hoverAt("maxBy", 1);

    expect(markdown).toContain("list.maxBy");
    expect(markdown).toContain("largest score");
    expect(markdown).toContain("Built in");
  });

  it("documents a method used inside an interpolation", async () => {
    const markdown = await hoverAt("nums.map", 5);

    expect(markdown).toContain("list.map");
    expect(markdown).toContain("passed through the function");
  });

  it("still describes the binding when the cursor is on the receiver", async () => {
    const markdown = await hoverAt("nums.map");

    expect(markdown).toContain("nums");
    expect(markdown).toContain("list<number>");
  });
});
