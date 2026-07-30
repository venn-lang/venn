import type { Cell } from "../expr/cell.types.js";
import type { Expr, FnBody, ParamList } from "../generated/ast.js";
import { boundNames } from "../pattern/index.js";
import type { Thunk } from "./compile.types.js";
import { paramPatternNames, paramSlotName, wholeValueName } from "./unpack.js";

/**
 * What the compiler knows by name at one point in the source: the parameters
 * and locals of the function being compiled, in slot order.
 *
 * Only the *current* function. A name from an enclosing one is left dynamic:
 * resolving across frames would mean walking a chain at run time, which is the
 * cost slots exist to remove.
 */
export interface LexScope {
  readonly names: readonly string[];
  /**
   * Compiled nodes for this scope. Per scope, not global: a placeholder's
   * expression is shared between every string literal with the same text, so a
   * single cache would hand one scope's slot numbers to another.
   */
  readonly cache: WeakMap<Expr, Thunk>;
  /**
   * Names the body reads but does not bind, in the order they were first seen.
   * Each becomes a cell the closure resolves once, so reading one costs an
   * index rather than a walk up the environment chain.
   *
   * Absent at the root, where there is no closure to hold the cells and a
   * shared list would grow across every program the process ever compiles.
   */
  readonly free?: string[];
  /**
   * This body binds one name and nothing else, so the value bound to it *is*
   * the environment: there is no frame, and reading the parameter is reading
   * the argument. Set optimistically and withdrawn by whoever compiled the body
   * if it turns out to need an environment after all.
   */
  bare?: boolean;
  /** The body asks for some name as text, so it needs a real environment. */
  dynamic?: boolean;
  /**
   * The cell a free name resolves to, when this body belongs to exactly one
   * closure and so may hold cells of its own. Absent for a `fn (…) => …`, whose
   * compiled body is shared by every closure the expression produces.
   */
  cellOf?: (name: string) => Cell;
}

/** Outside any function: every name is looked up by asking the environment. */
export function rootScope(): LexScope {
  return { names: [], cache: new WeakMap() };
}

/**
 * The scope inside a function: its parameters, then its locals. A local that
 * repeats a parameter's name takes that slot, the way an assignment would.
 */
export function scopeOf(params: ParamList | undefined, body: FnBody): LexScope {
  const params_ = params?.params ?? [];
  // The parameters first, one slot each and in order, because that is where the
  // caller writes them. What their patterns bind comes after all of them.
  const names: string[] = params_.map(paramSlotName);
  for (const name of paramPatternNames(params_)) if (!names.includes(name)) names.push(name);
  for (const local of body.locals) {
    if (local.pattern) names.push(wholeValueName("let", body.locals.indexOf(local)));
    for (const name of boundNames(local)) if (!names.includes(name)) names.push(name);
  }
  // Worth trying without a frame: one name, and nothing bound after it.
  const bare = names.length === 1 && body.locals.length === 0;
  return { names, cache: new WeakMap(), free: [], bare };
}

/** Whether a body compiled optimistically can keep doing without a frame. */
export function stayedBare(scope: LexScope): boolean {
  return Boolean(scope.bare) && !scope.dynamic && (scope.free?.length ?? 0) === 0;
}

/** Where a free name sits in this scope's cell list, adding it if new. */
export function freeSlot(scope: LexScope, name: string): number | undefined {
  const free = scope.free;
  if (!free) return undefined;
  const at = free.indexOf(name);
  if (at !== -1) return at;
  return free.push(name) - 1;
}
