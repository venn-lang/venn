import { describe, expect, it } from "vitest";
import { invoke, isCallable } from "./invoke.js";
import { memberValue } from "./member-value.js";

/**
 * A function that came from JavaScript, called and read like any other value.
 *
 * The language's own callables are a `Closure` or a wrapped `NativeFn`, and an
 * npm package's export is neither: it is a bare host function. `invoke` refused
 * one, so `import { nanoid } from "nanoid"` bound the function and then
 * answered `VN3013 · This value is not a function` about a function.
 *
 * Wrapping at the import instead would have hidden what a callable package
 * carries. `lodash` is a function with the whole library set on it, so wrapping
 * it made `lodash.chunk` read a property of the wrapper and answer `null`. One
 * change here rather than one at every binding site, and the value stays the
 * value it came in as.
 */
describe("a function the host handed over", () => {
  it("is callable", () => {
    expect(invoke((n: unknown) => (n as number) + 1, [1])).toBe(2);
  });

  it("is callable with every argument it was given", () => {
    const join = (...parts: unknown[]): string => parts.join("/");

    expect(invoke(join, ["a", "b", "c"])).toBe("a/b/c");
  });

  it("says so before anyone commits to the call", () => {
    expect(isCallable(() => 1)).toBe(true);
    expect(isCallable(42)).toBe(false);
  });

  /** A callable carrying its own surface, which is what a package usually is. */
  it("publishes what is set on it, and nothing it inherits", () => {
    const lib = Object.assign(() => "called", { chunk: () => [], VERSION: "4.17" });

    expect(memberValue(lib, "VERSION")).toBe("4.17");
    expect(memberValue(lib, "chunk")).not.toBeNull();
  });

  /**
   * `call`, `apply` and `bind` turn any value into a receiver of the reader's
   * choosing, and `constructor` reaches the prototype chain. None is the
   * package's, so none is published.
   */
  it.each(["call", "apply", "bind", "constructor", "toString", "name"])(
    "refuses `%s`, which belongs to every function and to no package",
    (member) => {
      const lib = Object.assign(() => "called", { chunk: () => [] });

      expect(memberValue(lib, member)).toBeNull();
    },
  );
});
