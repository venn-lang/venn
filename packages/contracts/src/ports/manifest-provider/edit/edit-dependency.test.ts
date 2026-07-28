import { describe, expect, it } from "vitest";
import { addDependency, removeDependency } from "./edit-dependency.js";

const MANIFEST = `# What this project is.
[package]
name = "app"
version = "0.1.0"

# The things it needs.
[dependencies]
hono = "^4"
zod = "^4"
`;

/**
 * Writing to a manifest a person wrote.
 *
 * `venn add` has to put a line in a file that carries someone's comments, their
 * blank lines and the order they chose. Rebuilding it from the parse tree would
 * be simpler and would throw all of that away, so the file is edited where it
 * stands.
 */
describe("adding a dependency to a manifest", () => {
  it("keeps every comment, blank line and unrelated key exactly", () => {
    const after = addDependency({ text: MANIFEST, name: "drizzle", version: "^1" });

    expect(after).toContain("# What this project is.");
    expect(after).toContain("# The things it needs.");
    expect(after.split("\n")).toHaveLength(MANIFEST.split("\n").length + 1);
  });

  /** In order, so two people adding two packages get two one-line diffs. */
  it("writes it in name order", () => {
    const after = addDependency({ text: MANIFEST, name: "drizzle", version: "^1" });

    expect(after).toContain('drizzle = "^1"\nhono = "^4"\nzod = "^4"');
  });

  it("puts a later name after the ones before it", () => {
    const after = addDependency({ text: MANIFEST, name: "zx", version: "^1" });

    expect(after).toContain('zod = "^4"\nzx = "^1"');
  });

  it("puts a middling name between the two it belongs between", () => {
    const after = addDependency({ text: MANIFEST, name: "valibot", version: "^1" });

    expect(after).toContain('hono = "^4"\nvalibot = "^1"\nzod = "^4"');
  });

  /** An upgrade should not move the line it upgrades. */
  it("replaces a name already there, where it stands", () => {
    const after = addDependency({ text: MANIFEST, name: "hono", version: "^5" });

    expect(after).toContain('hono = "^5"');
    expect(after).not.toContain('hono = "^4"');
    expect(after.split("\n")).toHaveLength(MANIFEST.split("\n").length);
  });

  it("writes the table when the manifest has none", () => {
    const after = addDependency({ text: '[package]\nname = "app"\n', name: "zod", version: "^4" });

    expect(after).toBe('[package]\nname = "app"\n\n[dependencies]\nzod = "^4"\n');
  });

  it("writes a dev dependency to its own table", () => {
    const after = addDependency({
      text: MANIFEST,
      name: "faker",
      version: "^9",
      table: "dev-dependencies",
    });

    expect(after).toContain('[dev-dependencies]\nfaker = "^9"');
    expect(after).toContain('hono = "^4"');
  });
});

describe("removing a dependency", () => {
  it("takes out its line and nothing else", () => {
    const after = removeDependency({ text: MANIFEST, name: "hono" });

    expect(after).not.toContain("hono");
    expect(after).toContain('zod = "^4"');
    expect(after).toContain("# The things it needs.");
  });

  /** Absent is already the state that was asked for. */
  it("leaves a manifest that never had it alone", () => {
    expect(removeDependency({ text: MANIFEST, name: "nada" })).toBe(MANIFEST);
    expect(removeDependency({ text: '[package]\nname = "a"\n', name: "zod" })).toBe(
      '[package]\nname = "a"\n',
    );
  });
});
