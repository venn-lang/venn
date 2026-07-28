import { describe, expect, it } from "vitest";
import { allPlugins } from "./plugins.js";
import { stdlibPortBindings } from "./port-bindings.js";

describe("stdlib", () => {
  it("gives every plugin a name and a namespace", () => {
    for (const plugin of allPlugins) {
      expect(plugin.name).toBeTruthy();
      expect(plugin.namespace).toBeTruthy();
    }
  });

  it("keeps namespaces unique, so no plugin shadows another", () => {
    const namespaces = allPlugins.map((plugin) => plugin.namespace);

    expect(new Set(namespaces).size).toBe(namespaces.length);
  });

  it("binds each port at most once", () => {
    const ids = stdlibPortBindings.map((binding) => binding.port.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
