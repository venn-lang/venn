import { describe, expect, it } from "vitest";
import { parseDoc } from "./parse-doc.js";
import { renderDoc } from "./render-doc.js";

const LINES = [
  "Signs a user in through the API.",
  "",
  "Keeps the response available as `res`.",
  "@param user  The account name.",
  "@param plan  Optional plan to assert.",
  "@returns The HTTP response.",
  "@example",
  'run login("alice")',
  "@deprecated Use `signIn` instead.",
];

describe("doc comments", () => {
  it("splits the summary from the tagged sections", () => {
    const doc = parseDoc(LINES);

    expect(doc.summary).toBe(
      "Signs a user in through the API.\n\nKeeps the response available as `res`.",
    );
    expect(doc.params).toEqual([
      { name: "user", text: "The account name." },
      { name: "plan", text: "Optional plan to assert." },
    ]);
    expect(doc.returns).toBe("The HTTP response.");
    expect(doc.examples).toEqual(['run login("alice")']);
    expect(doc.deprecated).toBe("Use `signIn` instead.");
  });

  it("keeps a multi-line example together", () => {
    const doc = parseDoc(["@example", 'run login("alice")', "expect res.status == 200"]);

    expect(doc.examples).toEqual(['run login("alice")\nexpect res.status == 200']);
  });

  it("treats a bare @deprecated as deprecated", () => {
    expect(parseDoc(["@deprecated"]).deprecated).toBe("This is deprecated.");
  });

  it("renders every section as markdown", () => {
    const markdown = renderDoc(parseDoc(LINES)) ?? "";

    expect(markdown).toContain("⚠️ **Deprecated**");
    expect(markdown).toContain("**Parameters**");
    expect(markdown).toContain("- `user` — The account name.");
    expect(markdown).toContain("**Returns** — The HTTP response.");
    expect(markdown).toContain("```venn");
  });

  it("gives prose, the tagged band and its labels three distinct spacings", () => {
    const markdown = renderDoc(parseDoc(LINES)) ?? "";

    // A rule separates the prose from the tagged band…
    expect(markdown).toContain("\n\n---\n\n");
    // …a label is glued to the content it introduces…
    expect(markdown).toContain("**Parameters**\n- `user`");
    expect(markdown).toContain("**Example**\n```venn");
    // …and blocks inside the band are one blank line apart.
    expect(markdown).toContain("\n\n**Returns**");
  });

  it("renders nothing when there is no documentation", () => {
    expect(renderDoc(undefined)).toBeUndefined();
  });
});
