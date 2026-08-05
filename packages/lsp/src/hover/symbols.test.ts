// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test.
import { isPrelude } from "@venn-lang/core";
import { beforeAll, describe, expect, it } from "vitest";
import { type Fixture, fixture, positionOf } from "../testing/lsp-fixture.js";

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

/**
 * One document for the file, because it is the same document seven times.
 *
 * Building the Langium services and analysing the source is what this file
 * costs: seven builds of one constant took seven times as long as one, and the
 * first of them was paid inside the first `it`, against a five second test
 * budget, on a machine already running every other project of the workspace.
 * A hook has ten, and now only one build happens at all. See venn-lang/venn#306.
 */
let built: Fixture;

beforeAll(async () => {
  built = await fixture(SOURCE);
});

async function hoverAt(needle: string, offset = 0): Promise<string> {
  const { services, document, uri } = built;
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
  /**
   * Three reds wear the same colour here, and venn-lang/venn#306 was filed
   * without knowing which one it saw. No `range` in the prelude table is one
   * thing; an analysis that produced no types at all answers with nothing, and
   * is another; the dynamic fence is a third. The first two say so themselves
   * now, so the next occurrence is a diagnosis rather than a guess.
   */
  it("documents `range` instead of calling it dynamic", async () => {
    const markdown = await hoverAt("range(3)");

    expect(isPrelude("range"), "the prelude table has no `range` in it").toBe(true);
    expect(markdown, "the hover answered nothing at all").not.toBe("");
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
