/**
 * The three keys a write may never use.
 *
 * `m["constructor"]["prototype"]["pwned"] = 7` used to run, and afterwards every
 * map, every list and every string in the process answered `7` to `.pwned`,
 * including the ones belonging to flows running beside it. Both halves of
 * assignment, the compiled one and the scheduler's, checked that the holder was
 * an object and nothing else.
 *
 * The refusal is built here rather than at each raise site, so the two halves
 * give the reader the same sentence.
 */

import { buildProblem, CODES } from "../codes/index.js";
import type { Problem, Span } from "../problem/index.js";

const RESERVED = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Whether writing this key would reach past the value into what made it.
 *
 * @param key The key the write worked out, already a string.
 * @returns True for `__proto__`, `constructor` and `prototype`.
 */
export function isReservedKey(key: string): boolean {
  return RESERVED.has(key);
}

/**
 * The refusal both halves of assignment give for one of those keys.
 *
 * @param args.key Which key was written, quoted back to the reader.
 * @param args.span Where the assignment is.
 * @returns The problem, VN3023.
 */
export function reservedKeyProblem(args: { key: string; span: Span }): Problem {
  return buildProblem({
    spec: CODES.VN3023_RESERVED_KEY,
    span: args.span,
    title: `\`${args.key}\` is not a key you can write to.`,
    help: "Pick another name. This one reaches what made the value rather than the value, so the write would change what every map, list and string answers to.",
  });
}
