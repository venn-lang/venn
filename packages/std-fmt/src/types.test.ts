import { type FnSpec, t } from "@venn/types";
import { describe, expect, it } from "vitest";
import { fmtActions } from "./actions/fmt-actions.js";
import { fmtPlugin } from "./plugin.js";

function signatureOf(name: string): FnSpec {
  const action = fmtActions.find((candidate) => candidate.name === name);
  if (!action?.signature) throw new Error(`fmt.${name} has no signature`);
  return action.signature;
}

describe("fmt signatures", () => {
  it("types every verb", () => {
    for (const action of fmtActions) {
      expect(action.signature, `fmt.${action.name} has no signature`).toBeDefined();
    }
  });

  it("always ends in a string", () => {
    for (const action of fmtActions) {
      expect(action.signature?.result, `fmt.${action.name}`).toEqual(t.string);
    }
  });

  it("takes the value first and the knob second", () => {
    expect(signatureOf("json").params).toEqual([t.dynamic, t.number]);
    expect(signatureOf("csv").params).toEqual([t.list(t.dynamic), t.string]);
    expect(signatureOf("yaml").params).toEqual([t.dynamic]);
  });

  // Every knob here is positional and `run` reads it off `args`. A params schema
  // would say otherwise to both readers that matter: the editor, which would
  // offer an options map, and the runtime, which parses the map the caller wrote
  // against it, so a key it does not list is dropped without a word.
  it("declares no options map, because no verb reads one", () => {
    for (const action of fmtActions) {
      expect(action.params, `fmt.${action.name} declares params it never reads`).toBeUndefined();
    }
  });

  // Nothing here survives the call: every verb hands back a string, so there is
  // no handle to name and no shape to publish. The day one appears, it goes in
  // `typeDefs` and this expectation is the one that notices.
  it("names no type of its own", () => {
    expect(fmtPlugin.typeDefs).toBeUndefined();
  });
});
