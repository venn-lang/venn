import { type FnSpec, t } from "@venn/types";
import { describe, expect, it } from "vitest";
import { artifactsActions } from "./actions/index.js";
import { artifactsTypeDefs } from "./types/index.js";

function signatureOf(name: string): FnSpec {
  const action = artifactsActions.find((candidate) => candidate.name === name);
  if (!action?.signature) throw new Error(`no signature for artifacts.${name}`);
  return action.signature;
}

describe("artifacts type manifest", () => {
  it("types every verb in the namespace", () => {
    const untyped = artifactsActions.filter((action) => !action.signature);
    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  it("takes a name and hands back one ref from attach", () => {
    const attach = signatureOf("attach");
    expect(attach.params).toEqual([t.string]);
    expect(attach.result).toEqual(t.ref("artifacts.ArtifactRef"));
  });

  it("takes nothing and hands back a list of refs from flush", () => {
    const flush = signatureOf("flush");
    expect(flush.params).toEqual([]);
    expect(flush.result).toEqual(t.list(t.ref("artifacts.ArtifactRef")));
  });

  // Every `ref` a signature writes has to land on a published type; one that
  // does not degrades the call to dynamic without saying a word.
  it("publishes the type its signatures point at", () => {
    expect(Object.keys(artifactsTypeDefs)).toContain("ArtifactRef");
    expect(artifactsTypeDefs.ArtifactRef).toMatchObject({ kind: "record", optional: ["size"] });
  });
});
