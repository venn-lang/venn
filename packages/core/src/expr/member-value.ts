import { kindOf, positionKey } from "../value/index.js";
import { position } from "./counted-argument.js";
import { INVOKE } from "./invoke.js";
import { builtinMember, NO_METHOD } from "./methods/index.js";
import { nativeFn } from "./native.types.js";
import { isWaiting, whenBothReady } from "./pending.js";

/**
 * One member of a value: `xs.len`, `m.user`, `target.wrap`.
 *
 * A map's own data wins; a list or a string only ever has built-in members.
 * Lives here rather than in the compiler because the compiler is not the only
 * reader: a decorator body reaches a handle's verbs by the same rule, and two
 * spellings of "what does `.x` mean" would drift apart.
 *
 * @param receiver What is being read, settled or not.
 * @param member The member's name.
 * @returns The member's value, `null` when there is none, or a promise when the
 * receiver has not arrived yet. Absent is `null` and never `undefined`: the
 * language has one nothing, and a program that reads a member nobody set has to
 * be able to compare it against that one.
 */
export function memberValue(receiver: unknown, member: string): unknown {
  if (isWaiting(receiver)) return receiver.then((ready) => memberValue(ready, member));
  const kind = kindOf(receiver);
  // A unit is not a map, and neither is a task or a pattern. Reading one as a
  // map would expose how it is stored, with `300ms.kind` answering "duration"
  // and `p.compiled` handing over the host's own `RegExp`.
  if (kind === "map" && Object.hasOwn(receiver as object, member)) {
    const data = own(receiver, member);
    if (data !== undefined) return data;
  }
  const built = builtinMember(receiver, member, INVOKE);
  if (built !== NO_METHOD) return built;
  return carries(kind) ? published(receiver, member) : null;
}

/**
 * The kinds whose members the host decides rather than the language.
 *
 * A function is one of them. An npm package's default export is very often a
 * callable carrying its whole surface as properties, which is what `lodash` is,
 * so refusing to read through it answered `null` for `lodash.chunk` and the
 * program carried the nothing forward.
 */
function carries(kind: string): boolean {
  return kind === "handle" || kind === "fn";
}

/**
 * `xs[i]` and `m[k]`: the same read, with the key worked out first.
 *
 * One reader rather than two. This used to be its own three lines with no
 * fences at all, so `m["toString"]` handed out a host function while
 * `m.toString` was null, `xs["push"]` gave `Array.prototype.push` while
 * `xs.push` gave Venn's own, and `d["kind"]` answered `"duration"`, which is the
 * exact leak the member read exists to prevent.
 *
 * @param receiver What is being indexed, settled or not.
 * @param at The key, settled or not. On a list or a string a key that spells a
 * position is one, so `xs[0]` and `xs["0"]` are the same element and `s[0]` and
 * `s["0"]` are the same character; anything else is read as the name it spells,
 * so `m[1]` and `m["1"]` are one key.
 * @returns What is there, `null` when there is nothing, or a promise when either
 * side is still arriving.
 */
export function indexValue(receiver: unknown, at: unknown): unknown {
  if (isWaiting(receiver) || isWaiting(at)) return whenBothReady(receiver, at, indexValue);
  // A list or a string read by position, which is the hottest read in a loop.
  if (typeof at === "number") {
    const held = sequence(receiver);
    if (held) return orNothing(held[position(at)]);
  }
  const key = typeof at === "string" ? at : String(at);
  const spot = positionKey(key);
  if (spot !== undefined) {
    const held = sequence(receiver);
    if (held) return orNothing(held[spot]);
  }
  return memberValue(receiver, key);
}

/**
 * The two kinds a position reads into, and nothing else.
 *
 * A string is one of them because reading a character is what `s[0]` has always
 * meant. Routing it through the member table instead answered `null` for a
 * position and reported only when the same key was spelled `s["0"]`, so the one
 * mistake was loud in one spelling and silent in the other.
 */
function sequence(receiver: unknown): ArrayLike<unknown> | undefined {
  if (Array.isArray(receiver)) return receiver as readonly unknown[];
  return typeof receiver === "string" ? receiver : undefined;
}

/** Absence is the one nothing the language has, never the host's `undefined`. */
function orNothing(held: unknown): unknown {
  return held === undefined ? null : held;
}

/** What the engine writes on every function, which no package chose to publish. */
const EVERY_FUNCTION: Readonly<Record<string, true>> = {
  length: true,
  name: true,
  prototype: true,
};

/**
 * What a handle or a host function published, which the host decides.
 *
 * A plugin's handle is a host object whose verbs are exactly what it answers
 * to, so the read goes through to it. What *every* object inherits is not
 * published by anybody: `constructor` and `toString` are the host's, they are
 * on the language's own values too, and handing them over is how a program
 * reaches the prototype chain.
 *
 * A function is two steps worse. `call`, `apply` and `bind` turn any value into
 * a receiver of the reader's choosing, so only what is set on it directly
 * counts: `lodash.chunk` is the package's and `lodash.call` is the prototype
 * chain wearing the package's name. And `name`, `length` and `prototype` are
 * set directly, by the engine rather than by anybody, so being own is not
 * enough to be published.
 */
function published(receiver: unknown, member: string): unknown {
  if (Object.hasOwn(Object.prototype, member)) return null;
  if (typeof receiver !== "function") return orNothing(own(receiver, member));
  if (EVERY_FUNCTION[member] || !Object.hasOwn(receiver, member)) return null;
  return orNothing(own(receiver, member));
}

/**
 * A property of a host value, callable if it is a method.
 *
 * This is the boundary a plugin's handle crosses to become a value in the
 * language. The wrapping is required: a bare host function is not a Venn
 * callable, and the receiver has to be bound or `api.close()` loses its `this`.
 */
function own(receiver: unknown, member: string): unknown {
  const value = (receiver as Record<string, unknown>)[member];
  if (typeof value !== "function") return value;
  const method = value as (...args: unknown[]) => unknown;
  return nativeFn((values) => method.apply(receiver, [...values]));
}
