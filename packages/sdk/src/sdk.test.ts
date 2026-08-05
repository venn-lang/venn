import { describe, expect, it } from "vitest";
import { Duration, defineAction, definePlugin, isUnitLiteral, unitBase, z } from "./index.js";

describe("sdk builders", () => {
  it("defineAction returns a plain definition with its params schema", () => {
    const action = defineAction({
      name: "get",
      params: z.object({ headers: z.record(z.string(), z.string()).optional() }),
      run: (_ctx, input) => input.args[0],
    });
    expect(action.name).toBe("get");
    expect(action.params).toBeDefined();
  });

  it("definePlugin collects contributions under a namespace", () => {
    const plugin = definePlugin({
      name: "venn/http",
      namespace: "http",
      requires: ["net"],
      actions: [defineAction({ name: "get", run: () => undefined })],
    });
    expect(plugin.namespace).toBe("http");
    expect(plugin.requires).toEqual(["net"]);
    expect(plugin.actions).toHaveLength(1);
  });

  it("Duration parses unit strings to milliseconds", () => {
    expect(Duration.parse("30s")).toBe(30000);
    expect(Duration.parse(1500)).toBe(1500);
    expect(Duration.parse("2m")).toBe(120000);
  });

  /**
   * The language's `30s` reaches a plugin as a map, and until this arm existed
   * both the string and the number arm answered `invalid_type` for it, so six
   * option keys across three plugins refused the literal their own README told
   * people to write.
   */
  it("Duration takes the language's own duration literal", () => {
    expect(Duration.parse({ kind: "duration", ms: 30000 })).toBe(30000);
    expect(Duration.safeParse({ kind: "duration", ms: 0 }).data).toBe(0);
  });

  it("Duration refuses a map that only spells the word", () => {
    expect(Duration.safeParse({ kind: "duration" }).success).toBe(false);
    expect(Duration.safeParse({ kind: "duration", label: "x" }).success).toBe(false);
    expect(Duration.safeParse({ kind: "size", bytes: 4 }).success).toBe(false);
  });

  /** A bound no clock can honour is not a bound, however it was arrived at. */
  it("Duration refuses a length of time that is not finite", () => {
    expect(Duration.safeParse({ kind: "duration", ms: Number.NaN }).success).toBe(false);
    expect(Duration.safeParse({ kind: "duration", ms: Infinity }).success).toBe(false);
  });

  /** A refusal, not a thrown `Error`, so the runtime can name the option. */
  it("Duration refuses text that carries no unit", () => {
    expect(Duration.safeParse("soon").success).toBe(false);
    expect(Duration.safeParse("30").success).toBe(false);
  });
});

describe("the unit literals a plugin can be handed", () => {
  it("reads the base number out of each kind", () => {
    expect(unitBase({ kind: "duration", ms: 250 }, "duration")).toBe(250);
    expect(unitBase({ kind: "size", bytes: 1024 }, "size")).toBe(1024);
    expect(unitBase({ kind: "percent", ratio: 0.5 }, "percent")).toBe(0.5);
    expect(unitBase({ kind: "instant", epochMs: 7, iso: "" }, "instant")).toBe(7);
  });

  it("answers nothing when the value is a different kind", () => {
    expect(unitBase({ kind: "size", bytes: 1024 }, "duration")).toBeUndefined();
  });

  /**
   * `kind` is how this language spells a union, so people write maps like this
   * on purpose. One of them used to read as a size.
   */
  it("leaves an ordinary map that merely spells kind alone", () => {
    expect(isUnitLiteral({ kind: "size", label: "x" })).toBe(false);
    expect(isUnitLiteral({ kind: "duration", ms: "250" })).toBe(false);
    expect(isUnitLiteral({ ms: 250 })).toBe(false);
    expect(isUnitLiteral(null)).toBe(false);
    expect(isUnitLiteral(250)).toBe(false);
  });

  /**
   * Recognition, not acceptance: `1s / 0` is a broken length of time and still
   * a length of time, so a renderer writes `Infinityms` rather than a map.
   */
  it("still recognises a duration whose arithmetic went wrong", () => {
    expect(isUnitLiteral({ kind: "duration", ms: Number.NaN })).toBe(true);
    expect(isUnitLiteral({ kind: "duration", ms: Infinity })).toBe(true);
  });
});
