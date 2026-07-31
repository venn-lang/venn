import { isInstant, isUnitValue } from "../units/index.js";
import { INVOKE } from "./invoke.js";
import { builtinMember, NO_METHOD } from "./methods/index.js";
import { nativeFn } from "./native.types.js";
import { isWaiting } from "./pending.js";
import { isTask } from "./task.js";

/**
 * One member of a value: `xs.len`, `m.user`, `target.wrap`.
 *
 * A map's own data wins; a list or a string only ever has built-in members.
 * Lives here rather than in the compiler because the compiler is not the only
 * reader: a decorator body reaches a handle's verbs by the same rule, and two
 * spellings of "what does `.x` mean" would drift apart.
 *
 * @returns The member's value, undefined when there is none, or a promise when
 * the receiver has not arrived yet.
 */
export function memberValue(receiver: unknown, member: string): unknown {
  if (isWaiting(receiver)) return receiver.then((ready) => memberValue(ready, member));
  // A unit is not a map. Reading it as one would expose how it is stored, with
  // `300ms.kind` answering "duration", and shadow its own conversions.
  if (isData(receiver) && Object.hasOwn(receiver as object, member)) {
    const data = own(receiver, member);
    if (data !== undefined) return data;
  }
  const built = builtinMember(receiver, member, INVOKE);
  if (built !== NO_METHOD) return built;
  return isOwned(receiver) ? undefined : own(receiver, member);
}

/**
 * Whether the language, not the host, decides what this value answers to.
 *
 * A list and a string are the language's own, with a published member set and a
 * checker that knows it, so they must never fall through to the host: nothing
 * the runtime happens to store them as is offered by the editor or checked, and
 * it would stop working the day either value is held differently. A plugin's
 * handle is the opposite case, being a host object whose published verbs are
 * exactly what it answers to.
 */
const OWNED = new Set(["string", "number", "boolean", "bigint"]);

function isOwned(receiver: unknown): boolean {
  return (
    receiver == null ||
    OWNED.has(typeof receiver) ||
    Array.isArray(receiver) ||
    isUnitValue(receiver) ||
    isInstant(receiver) ||
    isTask(receiver) ||
    isPlainMap(receiver)
  );
}

/**
 * A map the language made, as against an object a plugin handed over.
 *
 * Both are objects, so the line is drawn where it can be: a map literal
 * inherits from nothing but `Object`, while a handle is built by the host and
 * carries its verbs on its own prototype. Only what a map itself holds is its
 * data; what every object in the runtime inherits is not.
 */
function isPlainMap(receiver: unknown): boolean {
  if (typeof receiver !== "object" || receiver === null) return false;
  const proto = Object.getPrototypeOf(receiver);
  return proto === Object.prototype || proto === null;
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

function isData(receiver: unknown): boolean {
  return (
    receiver !== null &&
    typeof receiver === "object" &&
    !Array.isArray(receiver) &&
    !isUnitValue(receiver) &&
    // A moment is held as a shape with an `epochMs` in it, and reading it as a
    // map would answer `"instant"` for `.kind`. What it publishes is its own.
    !isInstant(receiver) &&
    !isTask(receiver)
  );
}
