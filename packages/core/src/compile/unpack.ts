/**
 * A pattern, compiled: the value lands in one slot and every name the pattern
 * binds reads its way out of it.
 *
 * Nothing else in the compiler has to know patterns exist. The whole value gets
 * a name no source can write, and each bound name becomes an ordinary local
 * filled before the body runs, which is what locals already are.
 */

import type { Frame } from "../expr/frame.js";
import { readSlot } from "../expr/frame.js";
import type { Param, Pattern } from "../generated/ast.js";
import type { PatternSlot } from "../pattern/index.js";
import { patternNames, patternSlots, slotValue } from "../pattern/index.js";
import type { CompiledLocal, Thunk } from "./compile.types.js";
import type { LexScope } from "./lex-scope.js";

/**
 * The name the whole value is held under, which no source can write.
 *
 * A parameter is positional, so its slot has to stay where the caller writes it:
 * the pattern's own names come after every parameter, never among them.
 */
export function wholeValueName(kind: "param" | "let" | "each", at: number): string {
  return `{${kind}${at}}`;
}

/**
 * The names one parameter puts in the scope: the slot the caller fills, and then
 * nothing, since a pattern's names are added after the parameters are placed.
 */
export function paramSlotName(param: Param, at: number): string {
  return param.name ?? wholeValueName("param", at);
}

/** Every name the parameters unpack, in the order the patterns name them. */
export function paramPatternNames(params: readonly Param[]): string[] {
  return params.flatMap((param) => (param.pattern ? patternNames(param.pattern) : []));
}

/** The locals that unpack the parameters, filled before the body's own. */
export function paramLocals(params: readonly Param[], scope: LexScope): CompiledLocal[] {
  return params.flatMap((param, at) =>
    param.pattern
      ? unpack(param.pattern, scope, scope.names.indexOf(paramSlotName(param, at)))
      : [],
  );
}

/**
 * The slot the whole value of a node's pattern lands in.
 *
 * Read off the scope rather than worked out again: the name is minted once, per
 * node, where the scope is built, so there is nothing for two counts to disagree
 * about.
 *
 * @param scope The scope the node is compiled in.
 * @param node The `let` or `forEach` that binds a pattern.
 * @returns The slot index, or `-1` when this node binds no whole value.
 */
export function wholeSlot(scope: LexScope, node: object): number {
  const name = scope.wholes.get(node);
  return name === undefined ? -1 : scope.names.indexOf(name);
}

/**
 * One local per name the pattern binds, each reading from the slot holding the
 * whole value.
 */
export function unpack(pattern: Pattern, scope: LexScope, from: number): CompiledLocal[] {
  return patternSlots(pattern).map((bound) => ({
    slot: scope.names.indexOf(bound.name),
    value: slotThunk(from, bound),
  }));
}

function slotThunk(from: number, bound: PatternSlot): Thunk {
  return (env) => slotValue(readSlot(env as Frame, from), bound);
}
