import { type FnSpec, t } from "@venn/types";
import { describe, expect, it } from "vitest";
import { mailActions } from "./actions/index.js";
import { mailTypeDefs } from "./types/index.js";

function signatureOf(name: string): FnSpec {
  const action = mailActions.find((candidate) => candidate.name === name);
  if (!action?.signature) throw new Error(`no signature for mail.${name}`);
  return action.signature;
}

describe("mail type manifest", () => {
  it("types every verb in the namespace", () => {
    const untyped = mailActions.filter((action) => !action.signature);
    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  it("hands back an email from waitFor, whose query is all options", () => {
    const waitFor = signatureOf("waitFor");
    expect(waitFor.params).toEqual([]);
    expect(waitFor.result).toEqual(t.ref("mail.Email"));
  });

  it("takes the inbox name positionally and gives it back", () => {
    expect(signatureOf("inbox")).toEqual(t.fn([t.string], t.string));
  });

  it("hands back a list of attachments, and nothing from clear", () => {
    expect(signatureOf("attachments").result).toEqual(t.list(t.ref("mail.Attachment")));
    expect(signatureOf("clear").result).toEqual(t.void);
  });

  // Every `ref` a signature writes has to land on a published type; one that
  // does not degrades the call to dynamic without saying a word.
  it("publishes the types its signatures point at", () => {
    expect(Object.keys(mailTypeDefs).sort()).toEqual(["Attachment", "Email"]);
    expect(mailTypeDefs.Email).toMatchObject({ kind: "record" });
  });
});
