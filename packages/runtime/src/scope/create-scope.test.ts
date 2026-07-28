import { describe, expect, it } from "vitest";
import { createScope } from "./create-scope.js";

describe("createScope", () => {
  it("reads through to the parent, and shadows it locally", () => {
    const parent = createScope();
    parent.set("shared", "parent");
    const child = parent.child();
    child.set("own", 1);

    expect(child.lookup("own")).toBe(1);
    expect(child.lookup("shared")).toBe("parent");
    child.set("shared", "child");
    expect(child.lookup("shared")).toBe("child");
    expect(parent.lookup("shared")).toBe("parent");
  });

  it("keeps a binding that genuinely holds nothing, instead of asking the parent", () => {
    const parent = createScope();
    parent.set("x", "parent");
    const child = parent.child();
    child.set("x", undefined);

    expect(child.lookup("x")).toBeUndefined();
  });

  it("knows nothing about names no one bound", () => {
    expect(createScope().lookup("constructor")).toBeUndefined();
  });
});
