import { isClosure } from "./closure.js";
import { invoke } from "./invoke.js";
import { isNativeFn } from "./native.types.js";

/**
 * A value as the host holds it, which for a callable means a real function.
 *
 * The mirror of `nativeFn`, and it was missing. A Venn callable is a `Closure`,
 * which is a record the interpreter reads, not something JavaScript can call.
 * Handing one to `lodash.map` gave the library a value it called anyway, and
 * `map([1, 2, 3], fn (n) => n * 2)` answered `[false, false, false]`: no error,
 * no diagnostic, three wrong numbers.
 *
 * Structural, because a callback is as often written inside something as it is
 * passed alone: `{ filter: fn (m) => … }` is the ordinary shape of a Discord
 * collector and of half the options objects in npm. Only a plain object or an
 * array is walked, and only a rebuilt one is returned, so a value carrying no
 * callable comes back as itself and keeps its identity.
 */
export function forHost(value: unknown): unknown {
  if (isClosure(value) || isNativeFn(value)) return (...args: unknown[]) => invoke(value, args);
  if (Array.isArray(value)) return sameOr(value, value.map(forHost));
  return isPlain(value) ? plainForHost(value) : value;
}

/** Only a map a program wrote. A handle, a date, a regex is the host's already. */
function isPlain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const under = Object.getPrototypeOf(value) as object | null;
  return under === Object.prototype || under === null;
}

function plainForHost(value: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = {};
  let moved = false;
  for (const [name, held] of Object.entries(value)) {
    out[name] = forHost(held);
    moved = moved || out[name] !== held;
  }
  return moved ? out : value;
}

/** The original where nothing inside moved, so identity survives the crossing. */
function sameOr(value: readonly unknown[], mapped: readonly unknown[]): unknown {
  return mapped.some((one, at) => one !== value[at]) ? mapped : value;
}
