import { describe, expect, it } from "vitest";
import { Duration, defineAction, definePlugin, z } from "./index.js";

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
      name: "@venn/http",
      version: "0.0.0",
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
});
