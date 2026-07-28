import type { RecordSpec, TypeSpec } from "@venn/types";
import { describe, expect, it } from "vitest";
import { browserActions } from "./actions/index.js";
import { createFakeBrowserDriver } from "./drivers/index.js";
import { browserPlugin } from "./plugin.js";
import { browserTypeDefs } from "./types.js";

/** Every name a `t.ref` inside this spec reaches for. */
function refsIn(spec: TypeSpec): string[] {
  if (spec.kind === "ref") return [spec.name];
  if (spec.kind === "list") return refsIn(spec.element);
  if (spec.kind === "map") return refsIn(spec.value);
  if (spec.kind === "record") return Object.values(spec.fields).flatMap(refsIn);
  if (spec.kind === "fn") return [...spec.params, spec.result].flatMap(refsIn);
  if (spec.kind === "union") return spec.members.flatMap(refsIn);
  return [];
}

function signatureOf(name: string): TypeSpec {
  const action = browserActions.find((candidate) => candidate.name === name);
  if (!action?.signature) throw new Error(`no signature for ${name}`);
  return action.signature;
}

describe("the browser namespace says what its verbs take and give back", () => {
  it("types every verb", () => {
    const untyped = browserActions.filter((action) => !action.signature);
    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  it("publishes its type defs through the plugin", () => {
    expect(browserPlugin.typeDefs).toBe(browserTypeDefs);
  });

  // A ref that resolves to nothing degrades to dynamic in silence, so the only
  // place it can be caught is here.
  it("refers only to names it publishes", () => {
    const published = Object.keys(browserTypeDefs).map((name) => `browser.${name}`);
    const wanted = browserActions.flatMap((action) =>
      refsIn(action.signature ?? { kind: "dynamic" }),
    );
    expect([...new Set(wanted)].filter((name) => !published.includes(name))).toEqual([]);
  });

  it("hands `launch` no arguments and a Browser handle back", () => {
    expect(signatureOf("launch")).toEqual({
      kind: "fn",
      params: [],
      result: { kind: "ref", name: "browser.Browser" },
    });
    // Opaque about its inside, plain about what it carries: a handle that
    // published nothing left the editor with nothing to say about it.
    expect(browserTypeDefs.Browser).toEqual({
      kind: "opaque",
      name: "browser.Browser",
      members: { id: { kind: "prim", name: "string" }, engine: { kind: "prim", name: "string" } },
    });
  });

  it("takes selector and value positionally in `fill`", () => {
    expect(signatureOf("fill")).toEqual({
      kind: "fn",
      params: [
        { kind: "prim", name: "string" },
        { kind: "prim", name: "string" },
      ],
      result: { kind: "prim", name: "void" },
    });
  });

  it("gives `download` back as data, not as a handle", () => {
    expect(signatureOf("download")).toMatchObject({
      result: { kind: "ref", name: "browser.Download" },
    });
    expect(browserTypeDefs.Download).toMatchObject({ kind: "record" });
  });

  it("leaves what a page script evaluated to dynamic", () => {
    expect(signatureOf("evaluate")).toMatchObject({ result: { kind: "dynamic" } });
  });

  // A field here that no driver ever sets is a promise the plugin cannot keep:
  // the matchers' subject is the driver's element model, nothing else.
  it("describes the element the driver actually hands the matchers", () => {
    const element = createFakeBrowserDriver({ elements: { "#q": {} } }).element("#q");
    const fields = Object.keys((browserTypeDefs.Element as RecordSpec).fields);
    expect(fields.sort()).toEqual(Object.keys(element ?? {}).sort());
  });
});
