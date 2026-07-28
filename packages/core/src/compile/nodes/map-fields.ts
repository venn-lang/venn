import { isWaiting } from "../../expr/pending.js";
import type { Thunk } from "../compile.types.js";

/** Replace each field with what it was waiting for, keeping the same shape. */
type Settle = (out: Record<string, unknown>, keys: readonly string[]) => Promise<unknown>;

/** How a map of a known size is built, given its keys and its value thunks. */
type Build = (keys: readonly string[], values: readonly Thunk[], settle: Settle) => Thunk;

/**
 * Map literals of the everyday sizes, with the loop written out.
 *
 * The object is still made empty and filled by assignment, which is what gives
 * every map from one site the same shape and so makes reading a field fast.
 * What goes is the loop: reading `keys[at]` and `values[at]` per field, and
 * carrying a flag for whether anything was waiting.
 *
 * Writing the literal in one go (`{ [k0]: a, [k1]: b }`) is faster to build and
 * much slower to read, because those objects share no shape with each other.
 * Records are built once and read many times, so it is the wrong trade.
 */
export const UNROLLED_MAP: Readonly<Record<number, Build>> = {
  1: (keys, values, settle) => {
    const k0 = keys[0] as string;
    const v0 = values[0] as Thunk;
    return (env) => {
      const a = v0(env);
      const out: Record<string, unknown> = {};
      out[k0] = a;
      return isWaiting(a) ? settle(out, keys) : out;
    };
  },
  2: (keys, values, settle) => {
    const [k0, k1] = keys as [string, string];
    const [v0, v1] = values as [Thunk, Thunk];
    return (env) => {
      const a = v0(env);
      const b = v1(env);
      const out: Record<string, unknown> = {};
      out[k0] = a;
      out[k1] = b;
      return isWaiting(a) || isWaiting(b) ? settle(out, keys) : out;
    };
  },
  3: (keys, values, settle) => {
    const [k0, k1, k2] = keys as [string, string, string];
    const [v0, v1, v2] = values as [Thunk, Thunk, Thunk];
    return (env) => {
      const a = v0(env);
      const b = v1(env);
      const c = v2(env);
      const out: Record<string, unknown> = {};
      out[k0] = a;
      out[k1] = b;
      out[k2] = c;
      return isWaiting(a) || isWaiting(b) || isWaiting(c) ? settle(out, keys) : out;
    };
  },
  4: (keys, values, settle) => {
    const [k0, k1, k2, k3] = keys as [string, string, string, string];
    const [v0, v1, v2, v3] = values as [Thunk, Thunk, Thunk, Thunk];
    return (env) => {
      const a = v0(env);
      const b = v1(env);
      const c = v2(env);
      const d = v3(env);
      const out: Record<string, unknown> = {};
      out[k0] = a;
      out[k1] = b;
      out[k2] = c;
      out[k3] = d;
      return waiting4(a, b, c, d) ? settle(out, keys) : out;
    };
  },
};

function waiting4(a: unknown, b: unknown, c: unknown, d: unknown): boolean {
  return isWaiting(a) || isWaiting(b) || isWaiting(c) || isWaiting(d);
}
