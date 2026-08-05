import { display, invoke, kindOf, nativeFn, PRELUDE_VALUES } from "@venn-lang/core";
import { isLeafValue } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";

/**
 * What a value is, is known in two places and may only ever be known one way.
 *
 * `kindOf` owns the question and lives in the compiler, which a plugin package
 * may never import: one that did would drag the parser into every `pnpm add`.
 * So the SDK holds `isLeafValue`, and this is the seam where the copy is held
 * to the original. The runtime is the one package that legitimately sees both.
 *
 * Before this existed the renderers gated on `isUnitLiteral`, which answers for
 * four of the fourteen kinds, so `fmt.yaml`, `fmt.xml` and `fmt.json` walked
 * into a regex and a task and published the interpreter's own storage.
 */

/** A real one of each, built the way the language builds it. */
const REGEX: unknown = invoke(PRELUDE_VALUES.regex, ["a-z", "i"]);
const TASK: unknown = invoke(PRELUDE_VALUES.spawn, [nativeFn(() => 1)]);

/** An open connection, as a plugin that publishes verbs on a prototype builds one. */
class Conn {
  close(): void {}
}

const HELD: readonly (readonly [string, unknown])[] = [
  ["a list", [1, 2]],
  ["a map", { name: "ada" }],
  ["a handle", new Conn()],
  ["a duration", { kind: "duration", ms: 250 }],
  ["a size", { kind: "size", bytes: 1024 }],
  ["a percent", { kind: "percent", ratio: 0.5 }],
  ["an instant", { kind: "instant", epochMs: 0, iso: "1970-01-01T00:00:00.000Z" }],
  ["a regex", REGEX],
  ["a task", TASK],
  ["a native fn", nativeFn(() => 1)],
  ["a host function", () => 1],
  ["a map that merely spells kind", { kind: "size", label: "x" }],
];

/** The three the language calls its own data, and the only structure there is. */
const STRUCTURE: Record<string, true> = { list: true, map: true, handle: true };

describe("the SDK's leaf question and the compiler's kinds", () => {
  it.each(HELD)("agrees about %s", (_what, value) => {
    expect(isLeafValue(value)).toBe(STRUCTURE[kindOf(value)] === undefined);
  });
});

describe("a value JSON already has a shape for", () => {
  /**
   * Not a leaf, because a leaf is written with the language's writer and that
   * would turn `1` into the string `"1"` in `fmt.json`.
   */
  it.each([1, "text", true, null, undefined])("is left as it is: %s", (value) => {
    expect(isLeafValue(value)).toBe(false);
  });
});

/**
 * The one exception both writers make, and they have to make the same one.
 *
 * A `Secret` is a plain object, so it is a map by kind, and walking it wrote
 * `reveal`, `toString` and `toJSON` into a YAML block and an XML element while
 * `print` and `fmt.json` both answered the marker. The SDK README promises
 * redaction by any route, and two of the five `fmt` formats were the routes it
 * was not true for.
 */
describe("a value that says how it writes itself", () => {
  const secret = {
    reveal: () => "hunter2",
    toString: () => "‹redacted›",
    toJSON: () => "‹redacted›",
  };

  it("is a leaf to the SDK and a single word to the compiler", () => {
    expect(kindOf(secret)).toBe("map");
    expect(isLeafValue(secret)).toBe(true);
    expect(display(secret)).toBe("‹redacted›");
  });

  /** A key spelled `toString` is data: a Venn `fn` is not a host function. */
  it("is walked when the function under that name is the language's own", () => {
    const data = { toString: nativeFn(() => "x") };

    expect(isLeafValue(data)).toBe(false);
    expect(display(data)).toBe("{ toString: <fn> }");
  });
});
