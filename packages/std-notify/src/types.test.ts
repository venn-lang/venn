import { type FnSpec, t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { notifyActions } from "./actions/index.js";
import { notifyTypeDefs } from "./types.js";

function signatureOf(name: string): FnSpec {
  const action = notifyActions.find((candidate) => candidate.name === name);
  if (!action?.signature) throw new Error(`no signature for notify.${name}`);
  return action.signature;
}

describe("notify type manifest", () => {
  it("types every verb in the namespace", () => {
    const untyped = notifyActions.filter((action) => !action.signature);
    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  // Channel, URL, recipient: one string in, one receipt out, whichever verb.
  it("takes one positional target and hands back a receipt", () => {
    for (const name of ["slack", "webhook", "email"]) {
      expect(signatureOf(name)).toEqual(t.fn([t.string], t.ref("notify.Receipt")));
    }
  });

  // Every `ref` a signature writes has to land on a published type; one that
  // does not degrades the call to dynamic without saying a word.
  it("publishes the type its signatures point at", () => {
    expect(notifyTypeDefs.Receipt).toEqual(t.record({ delivered: t.bool, id: t.string }));
  });
});
