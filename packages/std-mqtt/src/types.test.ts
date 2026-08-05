import type { TypeSpec } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { mqttActions } from "./actions/index.js";
import { mqttPlugin } from "./plugin.js";
import { mqttTypeDefs } from "./types/index.js";

/** Every named type a spec reaches for, however deep. */
function refsIn(spec: TypeSpec): readonly string[] {
  return spec.kind === "ref" ? [spec.name] : childrenOf(spec).flatMap(refsIn);
}

function childrenOf(spec: TypeSpec): readonly TypeSpec[] {
  if (spec.kind === "list") return [spec.element];
  if (spec.kind === "map") return [spec.value];
  if (spec.kind === "record") return Object.values(spec.fields);
  if (spec.kind === "fn") return [...spec.params, spec.result];
  return spec.kind === "union" ? [...spec.members] : [];
}

describe("mqtt signatures", () => {
  it("types every verb, a call with no signature stays dynamic", () => {
    const untyped = mqttActions.filter((action) => !action.signature).map((a) => a.name);

    expect(untyped).toEqual([]);
  });

  // A ref nobody published degrades to dynamic without a word, which is exactly
  // the failure this catches.
  it("only refers to types it publishes", () => {
    const published = Object.keys(mqttTypeDefs).map((name) => `mqtt.${name}`);
    const signatures = mqttActions.flatMap((action) => action.signature ?? []);
    const refs = [...signatures, ...Object.values(mqttTypeDefs)].flatMap(refsIn);

    for (const ref of refs) expect(published).toContain(ref);
  });

  it("hands `mqtt.expect` back a Message, from a single positional topic", () => {
    const expected = mqttActions.find((action) => action.name === "expect");

    expect(expected?.signature).toEqual({
      kind: "fn",
      params: [{ kind: "prim", name: "string" }],
      result: { kind: "ref", name: "mqtt.Message" },
    });
  });

  // json/qos/retain/will ride the opts map, which the Zod schema describes.
  // Listing them here would describe arguments nobody passes in that position.
  it("leaves the options map out of `mqtt.publish`", () => {
    const publish = mqttActions.find((action) => action.name === "publish");

    expect(publish?.signature?.params).toEqual([{ kind: "prim", name: "string" }]);
    expect(publish?.signature?.result).toEqual({ kind: "prim", name: "void" });
  });

  it("publishes Message to the checker under the name a flow writes", () => {
    expect(mqttPlugin.typeDefs).toBe(mqttTypeDefs);
    expect(Object.keys(mqttTypeDefs)).toEqual(["Message"]);
  });
});
