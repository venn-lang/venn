import { describe, expect, it } from "vitest";
import { invoke, nativeFn } from "../expr/index.js";
import { decorateCallable } from "./decorate-callable.js";
import { AROUND_KEYS, addDecoration } from "./decorations.js";

/** The base function every case here decorates: it reports what it was given. */
const base = nativeFn((values) => `base(${values.join(",")})`);

function decorated(write: (node: object) => void): unknown {
  const node = {};
  write(node);
  return decorateCallable({ node, base });
}

describe("the callable a decorated function binds to", () => {
  it("is the function itself when nothing asked for anything", () => {
    expect(decorateCallable({ node: {}, base })).toBe(base);
  });

  it("runs `.before` and `.after` around the call, with the arguments", () => {
    const seen: unknown[] = [];
    const callable = decorated((node) => {
      addDecoration(
        node,
        AROUND_KEYS.before,
        nativeFn((v) => seen.push(["before", v[0]])),
      );
      addDecoration(
        node,
        AROUND_KEYS.after,
        nativeFn((v) => seen.push(["after", v[0], v[1]])),
      );
    });

    expect(invoke(callable, ["x"])).toBe("base(x)");
    expect(seen).toEqual([
      ["before", ["x"]],
      ["after", ["x"], "base(x)"],
    ]);
  });

  it("lets a wrap decide not to call through", () => {
    const callable = decorated((node) => {
      addDecoration(
        node,
        AROUND_KEYS.wrap,
        nativeFn(() => "instead"),
      );
    });

    expect(invoke(callable, ["x"])).toBe("instead");
  });

  it("passes the arguments along when a wrap calls through", () => {
    const callable = decorated((node) => {
      addDecoration(
        node,
        AROUND_KEYS.wrap,
        nativeFn(([call, args]) => `[${invoke(call, [args])}]`),
      );
    });

    expect(invoke(callable, ["x", "y"])).toBe("[base(x,y)]");
  });

  // The one written first is the one a reader sees first, so it is the one that
  // decides whether the rest of them run at all.
  it("nests wraps with the first written outermost", () => {
    const mark = (name: string) => nativeFn(([call, args]) => `${name}(${invoke(call, [args])})`);
    const callable = decorated((node) => {
      addDecoration(node, AROUND_KEYS.wrap, mark("outer"));
      addDecoration(node, AROUND_KEYS.wrap, mark("inner"));
    });

    expect(invoke(callable, ["x"])).toBe("outer(inner(base(x)))");
  });
});
