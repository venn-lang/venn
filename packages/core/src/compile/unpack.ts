/**
 * A pattern, compiled: the value lands in one slot and every name the pattern
 * binds reads its way out of it.
 *
 * Nothing else in the compiler has to know patterns exist. The whole value gets
 * a slot no source can name, and each bound name becomes an ordinary local
 * filled before the body runs, which is what locals already are.
 */

import type { Frame } from "../expr/frame.js";
import { readSlot } from "../expr/frame.js";
import type { Param, Pattern } from "../generated/ast.js";
import type { PatternSlot } from "../pattern/index.js";
import { patternMisfit, patternNames, patternSlots, slotValue } from "../pattern/index.js";
import { ProblemError } from "../problem/index.js";
import { boundValue } from "./box.js";
import type { CompiledLocal, Thunk } from "./compile.types.js";
import { boxed, declare, type LexScope, slotOf } from "./lex-scope.js";

/**
 * The name a parameter's slot is held under, which no source can write.
 *
 * A parameter is positional, so its slot has to stay where the caller writes it:
 * a pattern parameter still takes one, and the names it binds come after every
 * parameter rather than among them.
 */
export function paramSlotName(param: Param, at: number): string {
  return param.name ?? `{param${at}}`;
}

/** Every name the parameters unpack, in the order the patterns name them. */
export function paramPatternNames(params: readonly Param[]): string[] {
  return params.flatMap((param) => (param.pattern ? patternNames(param.pattern) : []));
}

/** The locals that unpack the parameters, filled before the body's own. */
export function paramLocals(params: readonly Param[], scope: LexScope): CompiledLocal[] {
  return params.flatMap((param, at) =>
    param.pattern ? unpack(param.pattern, scope, slotOf(scope, paramSlotName(param, at))) : [],
  );
}

/**
 * One local per name the pattern binds, each reading from the slot holding the
 * whole value.
 *
 * The names are declared here, as they are read out, so the slot a name stands
 * for is decided in one place. Two places once decided it and disagreed: a
 * pattern `let` inside an `if` asked for a slot nobody had minted.
 *
 * The shape is asked once, on the way to the first name, so the names after it
 * read out of a value already known to have it.
 */
export function unpack(pattern: Pattern, scope: LexScope, from: number): CompiledLocal[] {
  return patternSlots(pattern).map((bound, at) => {
    const slot = declare(scope, bound.name);
    const read = at === 0 ? askedFirst(pattern, from, bound) : slotThunk(from, bound);
    return { slot, value: boundValue(read, scope, slot) };
  });
}

function slotThunk(from: number, bound: PatternSlot): Thunk {
  return (env) => slotValue(readSlot(env as Frame, from), bound);
}

/** The first name out of a pattern, which is where the value is asked its shape. */
function askedFirst(pattern: Pattern, from: number, bound: PatternSlot): Thunk {
  return (env) => {
    const value = readSlot(env as Frame, from);
    const misfit = patternMisfit(pattern, value);
    if (misfit) throw new ProblemError(misfit);
    return slotValue(value, bound);
  };
}

/**
 * The locals that put a captured parameter in a cell of its own.
 *
 * The caller writes a parameter's slot straight, so a closure capturing one has
 * nothing to hold on to until the body starts. This is where it gets it, after
 * the patterns have read what they need out of the raw value and before the
 * body's own bindings, which read it as a cell like any other.
 *
 * @param params The parameters as written.
 * @param scope The body's scope, its parameters already declared.
 * @returns One local per captured parameter, and nothing at all for the rest.
 */
export function boxedParams(params: readonly Param[], scope: LexScope): CompiledLocal[] {
  return params.flatMap((param, at) => {
    const slot = slotOf(scope, paramSlotName(param, at));
    if (slot === -1 || !boxed(scope, slot)) return [];
    const value: Thunk = (env) => ({ value: readSlot(env as Frame, slot) });
    return [{ slot, value }];
  });
}
