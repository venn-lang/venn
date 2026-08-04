import type { Cell } from "../expr/cell.types.js";
import type { Expr, FnBody, Param, ParamList } from "../generated/ast.js";
import type { Thunk } from "./compile.types.js";
import { innerNames } from "./inner-names.js";
import { paramSlotName } from "./unpack.js";

/**
 * What the compiler knows by name at one point in the source: the parameters
 * and locals in view there, each pointing at the slot that holds it.
 *
 * Only the *current* function. A name from an enclosing one is left dynamic:
 * resolving across frames would mean walking a chain at run time, which is the
 * cost slots exist to remove.
 *
 * One of these per block, sharing the function's slot list. A block's own
 * bindings are slots of the function like any other, because a call has one
 * frame and not a chain of them; what a block gives them is a name that is in
 * view for its own statements and gone afterwards.
 */
export interface LexScope {
  /**
   * Every slot the body has, in the order they were minted. Shared by reference
   * with every block of the same body, since they all write the same frame.
   */
  readonly names: string[];
  /** The slot each name in view stands for, here. Copied on entering a block. */
  readonly visible: Map<string, number>;
  /**
   * Compiled nodes for this block. Per block, not global: a placeholder's
   * expression is shared between every string literal with the same text, so a
   * single cache would hand one block's slot numbers to another.
   */
  readonly cache: WeakMap<Expr, Thunk>;
  /** The block this body started in, which is where the whole body's flags live. */
  readonly root?: LexScope;
  /**
   * Names the body reads but does not bind, in the order they were first seen.
   * Each becomes a cell the closure resolves once, so reading one costs an
   * index rather than a walk up the environment chain.
   *
   * Absent at the root scope of a program, where there is no closure to hold the
   * cells and a shared list would grow across every program the process compiles.
   */
  free?: string[];
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
   * A `fn` is written somewhere in this body, so which of its slots a closure
   * captured is known only once the whole body has been compiled once.
   */
  nested?: boolean;
  /**
   * The slots a closure captured, as the pass before this one found them. Each
   * holds a cell rather than the value, so a binding made again (a `let` in a
   * loop, the item of a pass) gives that pass a place of its own.
   */
  boxes?: ReadonlySet<number>;
  /** The slots this pass finds captured, which is what the next one boxes. */
  captures?: Set<number>;
  /**
   * Every name the body binds anywhere, as the pass before this one left it.
   *
   * A closure reading a name this body binds but has not bound yet is the one
   * question the source cannot answer where the closure is written, so it keeps
   * asking by name at call time.
   */
  binds?: ReadonlySet<string>;
  /**
   * The cell a free name resolves to, when this body belongs to exactly one
   * closure and so may hold cells of its own. Absent for a `fn (…) => …`, whose
   * compiled body is shared by every closure the expression produces.
   */
  cellOf?: (name: string) => Cell;
}

/** Outside any function: every name is looked up by asking the environment. */
export function rootScope(): LexScope {
  return { names: [], visible: new Map(), cache: new WeakMap() };
}

/**
 * The scope a function body starts in: its parameters, then what an expression
 * inside it binds.
 *
 * The body's own `let`s are not here. They are declared as they are compiled,
 * in the order they are written, which is what gives a nested block a name of
 * its own and lets a name be read before its binding exactly as it is at the top
 * of a file: not at all.
 */
export function scopeOf(params: ParamList | undefined, body: FnBody): LexScope {
  const scope: LexScope = {
    names: [],
    visible: new Map(),
    cache: new WeakMap(),
    free: [],
    captures: new Set(),
  };
  const params_ = params?.params ?? [];
  // The parameters first, one slot each and in order, because that is where the
  // caller writes them. What their patterns bind comes after all of them.
  for (const [at, param] of params_.entries()) declare(scope, paramSlotName(param, at));
  // What a `match` arm or a `catch` binds is written before it is read and only
  // where its own branch was taken, so two of them may share a name and a slot.
  // Declared up front because the expression that binds them is compiled from
  // the inside out, with no statement of its own to sit before.
  for (const name of innerNames(body)) declare(scope, name);
  scope.bare = onlyOneName(params_, body) && scope.names.length === 1;
  return scope;
}

/**
 * Whether this body could do without a frame: one parameter, taken whole, and
 * no statement to bind anything else.
 *
 * A pattern parameter is asked about here rather than counted later, because the
 * names it binds are declared while the body compiles and the question is
 * settled before that starts. Getting it wrong is silent: a bare body's
 * environment *is* its one argument, so a second slot reads a field of it.
 */
function onlyOneName(params: readonly Param[], body: FnBody): boolean {
  return body.stmts.length === 0 && params.length === 1 && !params[0]?.pattern;
}

/**
 * A block inside the same body: the same slots and the same flags, its own view
 * of what is in scope and its own cache.
 *
 * @param parent The scope the block is written in.
 * @returns A scope whose declarations are gone when the block ends.
 */
export function blockScope(parent: LexScope): LexScope {
  return {
    names: parent.names,
    visible: new Map(parent.visible),
    cache: new WeakMap(),
    root: rootOf(parent),
  };
}

/** Where the body's flags and free list live, whichever block is asking. */
export function rootOf(scope: LexScope): LexScope {
  return scope.root ?? scope;
}

/**
 * Give a name a slot of its own, in view from here to the end of the block.
 *
 * A repeat gets a fresh slot rather than the one already there, so a `let`
 * inside a loop is a binding of that loop and an outer name of the same spelling
 * is left where it was.
 *
 * @param scope The block the binding is written in.
 * @param name The name being bound.
 * @returns The slot it now stands for.
 */
export function declare(scope: LexScope, name: string): number {
  const at = scope.names.push(name) - 1;
  scope.visible.set(name, at);
  return at;
}

/**
 * A slot no source can name: where a pattern's whole value waits while the names
 * it binds are read out of it.
 *
 * @param scope The block the pattern is written in.
 * @returns The slot, which only the code that minted it ever addresses.
 */
export function allocate(scope: LexScope): number {
  return scope.names.push("") - 1;
}

/**
 * The slot a name stands for here, or `-1` when this body does not bind it.
 *
 * @param scope The block the name is read in.
 * @param name The name being read.
 */
export function slotOf(scope: LexScope, name: string): number {
  return scope.visible.get(name) ?? -1;
}

/** Whether a body compiled optimistically can keep doing without a frame. */
export function stayedBare(scope: LexScope): boolean {
  const body = rootOf(scope);
  return Boolean(body.bare) && !body.dynamic && (body.free?.length ?? 0) === 0;
}

/**
 * Whether this slot holds a cell rather than the value, because a closure
 * written in this body captured it.
 *
 * @param scope Any block of the body the slot belongs to.
 * @param at The slot in question.
 */
export function boxed(scope: LexScope, at: number): boolean {
  return rootOf(scope).boxes?.has(at) === true;
}

/**
 * Record that a closure captured this slot, for the pass that decides boxing.
 *
 * @param scope The block the closure is written in.
 * @param at The slot it captured.
 */
export function capture(scope: LexScope, at: number): void {
  rootOf(scope).captures?.add(at);
}

/**
 * Whether the body binds this name somewhere, which is known only after a pass.
 *
 * @param scope Any block of the body.
 * @param name The name a closure written here reads.
 */
export function bindsName(scope: LexScope, name: string): boolean {
  return rootOf(scope).binds?.has(name) === true;
}

/** Where a free name sits in this body's cell list, adding it if new. */
export function freeSlot(scope: LexScope, name: string): number | undefined {
  const free = rootOf(scope).free;
  if (!free) return undefined;
  const at = free.indexOf(name);
  if (at !== -1) return at;
  return free.push(name) - 1;
}
