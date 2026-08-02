import { defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { URI } from "langium";
import { describe, expect, it } from "vitest";
import type { ActionEntry, SymbolCatalog } from "../catalog/index.js";
import { renderDoc } from "../docs/render-doc.js";
import { bracketed, signatureOfShape } from "../signature/render-shape.js";
import { actionHover } from "./render-action.js";
import { importPathHover } from "./render-imported.js";

/** An argument a plugin declared and never explained. */
const BARE = { name: "url", type: "string" };

/**
 * A catalogue holding one verb, which is all any of these ask it for.
 *
 * The rest of the interface throws rather than answering emptily: a test that
 * silently takes the wrong path is worse than one that stops.
 */
function holding(entry: ActionEntry): SymbolCatalog {
  const refuse = () => {
    throw new Error("this test asks a catalogue for one verb and nothing else");
  };
  return {
    action: (namespace, name) =>
      namespace === entry.namespace && name === entry.name ? entry : undefined,
    namespaces: () => [entry.namespace],
    packages: () => [entry.package],
    hasNamespace: (namespace) => namespace === entry.namespace,
    actionsIn: (namespace) => (namespace === entry.namespace ? [entry] : []),
    typesIn: () => [],
    matchers: () => [],
    matcher: () => undefined,
    namespaceOfPackage: refuse,
    packagesFor: refuse,
  };
}

const VERB: ActionEntry = {
  namespace: "kit",
  name: "fetch",
  package: "@t/kit",
  action: defineAction({
    name: "fetch",
    args: [{ name: "url", type: t.string }],
    run: () => undefined,
  }),
};

/** A verb whose options are declared and not explained. */
const WITH_OPTION: ActionEntry = {
  namespace: "kit",
  name: "fetch",
  package: "@t/kit",
  action: defineAction({
    name: "fetch",
    params: z.object({ retries: z.number().optional() }),
    run: () => undefined,
  }),
};

/**
 * What the renderers do with an argument nobody documented.
 *
 * Each of them writes `name: type` and then, if there is prose, a sentence. The
 * separator between the two was a dash, became a comma when the dash was swept
 * out of the repository, and is now a full stop. None of the three had a test,
 * which is how a rewrite of what a person reads shipped unnoticed; this is the
 * other side of each, where there is no sentence to separate.
 */
describe("an argument nobody documented", () => {
  it("is written without a sentence after it, in a hover", () => {
    const said = actionHover("kit.fetch", holding(VERB)) ?? "";

    expect(said).toContain("`url`");
    expect(said).not.toMatch(/`url`[^\n]*\.\s+[A-Z]/);
  });

  it("is written without one in a signature hint", () => {
    const shape = { target: "kit.fetch", args: [BARE], options: [] };

    expect(signatureOfShape(shape).label).toBe("kit.fetch url: string");
    expect(bracketed(shape).label).toBe("kit.fetch(url: string)");
    expect(signatureOfShape(shape).parameters?.[0]?.documentation).toBeUndefined();
  });

  /** An option is an argument like any other, and gets the same line. */
  it("is written without one for an option", () => {
    const shape = {
      target: "kit.fetch",
      args: [],
      options: [{ name: "retries", type: "number", required: false }],
    };

    expect(bracketed(shape).parameters?.[0]?.documentation).toBe("- `retries`: `number`");
    expect(actionHover("kit.fetch", holding(WITH_OPTION)) ?? "").toContain("`retries`");
  });

  it("is written without one in a doc block", () => {
    const rendered = renderDoc({
      summary: "Fetches.",
      params: [{ name: "url", text: "" }],
      examples: [],
    });

    expect(rendered).toContain("`url`");
    expect(rendered).not.toContain("`url`.");
  });
});

/**
 * An import whose file is there, which is the other side of the one that says a
 * path leads nowhere.
 */
describe("an import that resolves", () => {
  it("says so without the clause about not being readable", () => {
    const said = importPathHover({
      location: { uri: URI.parse("file:///cart.vn"), document: {} as never },
      path: "./cart.vn",
    });

    expect(said).toContain("Resolves to");
    expect(said).not.toContain("not readable");
  });

  it("says so with the clause when it is not", () => {
    const said = importPathHover({
      location: { uri: URI.parse("file:///gone.vn") },
      path: "./gone.vn",
    });

    expect(said).toContain("not readable");
  });
});
