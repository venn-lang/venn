import { isUnitLiteral } from "./unit-literal.js";

/**
 * Whether the language writes this value as a single word rather than as
 * structure to walk into.
 *
 * The question a renderer has to answer before it opens a block, indents a
 * level or emits a tag. Getting it wrong is how `250ms` came to be written
 * `{"kind":"duration","ms":250}`, and asking it of the four unit literals alone
 * left the same hole open for the other kinds the host stores as an object: a
 * regex went out as `{"kind":"regex","source":"a-z","compiled":{}}` and a task
 * as `{"promise":{},"settled":true}`, where `compiled` and `promise` are a
 * `RegExp` and a `Promise` serialising to nothing at all. The output lost the
 * value and gained keys that mean nothing.
 *
 * The compiler answers this with `kindOf`, against the same closed list of
 * kinds, and the SDK may never import the compiler: a plugin package that did
 * would drag the parser into every `pnpm add`. So this is the SDK's own copy,
 * and `leaf-agrees.test.ts` in the runtime holds the two against each other.
 *
 * A list and a map are the language's own data and are the only structure there
 * is. A handle is walked too, because a host object's published fields are what
 * a report is about. Everything else is a leaf: a callable, a task, a regex,
 * the four unit literals, and anything that says how it writes itself.
 *
 * @param value Anything a flow evaluated.
 * @returns True when the value must be written with the language's own writer.
 */
export function isLeafValue(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  if (isUnitLiteral(value) || isPatternValue(value) || saysItsOwnText(value)) return true;
  // A callable and a task are branded with a symbol, which is precisely what
  // the language's own data never carries: a map comes from a map literal or
  // from JSON, and neither can put a symbol on one.
  return Object.getOwnPropertySymbols(value).length > 0;
}

/** The two ways a value publishes text for itself, in the order they are asked. */
const DECLARED = ["toJSON", "toString"] as const;

/**
 * Whether the value says how it writes itself.
 *
 * A `Secret` is why. It is a plain object, so it reads as a map by kind, and
 * walking it published `reveal`, `toString` and `toJSON` into a YAML block and
 * an XML element while `print` and `fmt.json` both answered the marker. The
 * language's own writer honours the same declaration, so this is one rule kept
 * in two places rather than two rules.
 *
 * Own properties, and host functions. A Venn closure is an object rather than a
 * function, so a map written `{ toString: fn () => "x" }` is data with a key
 * spelled `toString` and is walked like any other map.
 */
function saysItsOwnText(value: object): boolean {
  for (const name of DECLARED) {
    if (!Object.hasOwn(value, name)) continue;
    if (typeof (value as Record<string, unknown>)[name] === "function") return true;
  }
  return false;
}

/**
 * A compiled pattern, told apart from a map that spells a union with `kind`.
 *
 * The compiled `RegExp` has to be there, for the same reason a unit literal's
 * base number has to be: `{ kind: "regex", source: "x" }` is an ordinary map
 * somebody wrote on purpose.
 */
function isPatternValue(value: object): boolean {
  return (
    "kind" in value &&
    value.kind === "regex" &&
    "compiled" in value &&
    value.compiled instanceof RegExp
  );
}
