import type { Cell } from "../expr/cell.types.js";
import type { Expr, FnBody, ParamList } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { boundNames, loopBinding } from "../pattern/index.js";
import type { Thunk } from "./compile.types.js";
import { innerNames } from "./inner-names.js";
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
   * The slot name the whole value of a pattern lands in, per node that binds
   * one.
   *
   * Kept by node rather than worked out twice from a position. Two counts of
   * "which one is this" disagreed: this one numbered by place among the body's
   * top-level statements and the compiler numbered by place within the
   * statement's own block, so a pattern `let` inside an `if` asked for a slot
   * nobody had minted.
   */
  readonly wholes: ReadonlyMap<object, string>;
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
  return { names: [], wholes: new Map(), cache: new WeakMap() };
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
  // A function body is one scope: a `let` inside an `if` is a name of the
  // function, with a slot of its own, because a call has one frame and not a
  // chain of them. Two of the same name in one body meet in one slot, which is
  // what `venn check` refuses before it can matter.
  const bound = bodyNames(body);
  for (const name of bound.names) if (!names.includes(name)) names.push(name);
  // What a `match` arm or a `catch` binds is a local like any other: written
  // before it is read, and only where its own branch was taken, so two of them
  // may share a name and a slot.
  for (const name of innerNames(body)) if (!names.includes(name)) names.push(name);
  // Worth trying without a frame: one name, and nothing bound after it.
  const bare = names.length === 1 && body.stmts.length === 0;
  return { names, wholes: bound.wholes, cache: new WeakMap(), free: [], bare };
}

/** The names a body binds, and where each pattern's whole value goes. */
interface Bound {
  readonly names: string[];
  readonly wholes: Map<object, string>;
}

/**
 * Every name the body binds, wherever it binds it.
 *
 * A binding, what a pattern in one takes apart, a loop's item, a repeat's
 * index, a loop's state, and the slot a pattern's whole value lands in.
 */
function bodyNames(body: FnBody): Bound {
  const found: Bound = { names: [], wholes: new Map() };
  for (const stmt of body.stmts) collectNames(stmt, found);
  return found;
}

function collectNames(node: object, into: Bound): void {
  if (ast.isLetStmt(node)) {
    if (node.pattern) into.names.push(whole(node, "let", into));
    into.names.push(...boundNames(node));
  } else if (ast.isForEachStmt(node)) {
    if (node.pattern) into.names.push(whole(node, "each", into));
    into.names.push(...boundNames(loopBinding(node)));
  } else if (ast.isRepeatStmt(node) && node.index) into.names.push(node.index);
  else if (ast.isLoopStmt(node) && node.state) into.names.push(node.state.name);
  for (const child of children(node)) collectNames(child, into);
}

/** A slot name no source can write, one per node that binds a whole value. */
function whole(node: object, kind: "let" | "each", into: Bound): string {
  const name = wholeValueName(kind, into.wholes.size);
  into.wholes.set(node, name);
  return name;
}

/** The blocks a statement holds, so a binding inside one is found too. */
function children(node: object): object[] {
  const held = node as {
    body?: { stmts?: object[] };
    then?: { stmts?: object[] };
    otherwise?: object;
  };
  const inner = [...(held.body?.stmts ?? []), ...(held.then?.stmts ?? [])];
  const other = held.otherwise as { stmts?: object[] } | undefined;
  return [...inner, ...(other?.stmts ?? []), ...(other && !other.stmts ? [other] : [])];
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
