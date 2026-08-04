/**
 * Expression compilation: a tree becomes a function of the environment.
 *
 * A program's tree is fixed once parsed, so every decision the source settles
 * (which operator, which literal value, which slot a name lives in, how a
 * string splits around its placeholders) is made once here instead of on every
 * visit.
 */

import type { Cell } from "../expr/cell.types.js";
import type { Closure } from "../expr/closure.types.js";
import type { EvalEnv } from "../expr/eval-env.types.js";
import type { Frame } from "../expr/frame.js";
import type { Expr, FnDecl } from "../generated/ast.js";
import type { Compile, Thunk } from "./compile.types.js";
import { freeSlot, type LexScope, rootOf, rootScope, slotOf } from "./lex-scope.js";
import {
  closureIn,
  compileBinary,
  compileCall,
  compileFnExpr,
  compileIndex,
  compileInstant,
  compileList,
  compileMap,
  compileMatch,
  compileMember,
  compileNumber,
  compileString,
  compileTernary,
  compileTry,
  compileUnary,
  constant,
  constThunk,
} from "./nodes/index.js";

const ROOT = rootScope();

/**
 * Compile an expression into a function of the environment.
 *
 * Memoised per node, so asking twice for the same expression hands back the
 * same thunk.
 *
 * @returns A thunk: give it an environment and it produces the value.
 */
export function compileExpr(expr: Expr): Thunk {
  return compileIn(expr, ROOT);
}

/**
 * Build the function value for a top-level `fn name(…)`.
 *
 * The body is compiled against `env`, which is what lets a recursive
 * declaration reach its own name: the cell is handed out before the binding
 * that fills it exists.
 *
 * @returns The closure, ready to be bound under the declaration's name.
 */
export function closureOfDecl(decl: FnDecl, env: EvalEnv): Closure {
  return closureIn(decl, env, compileIn);
}

function compileIn(expr: Expr, scope: LexScope): Thunk {
  const known = scope.cache.get(expr);
  if (known) return known;
  const thunk = dispatch(expr, scope);
  scope.cache.set(expr, thunk);
  return thunk;
}

const NOTHING: Thunk = () => undefined;

function dispatch(expr: Expr, scope: LexScope): Thunk {
  switch (expr.$type) {
    case "NumberLit":
      return compileNumber(expr);
    case "StringLit":
      // A placeholder compiles in the scope that holds it, so `"${i}"` inside a
      // function reads `i` as that function's slot rather than asking for it by
      // name. Its parsed expression is shared by every literal with the same
      // text, which is safe only because the compiled form is cached per scope:
      // two scopes reach the same node and each keeps its own thunk for it.
      return compileString(expr, (inner) => compileIn(inner, scope));
    case "InstantLit":
      return compileInstant(expr);
    case "BoolLit":
      return constant(expr.value === "true");
    case "NullLit":
      return constant(null);
    case "Ref":
      return compileRef(expr.name, scope);
    case "FnExpr":
      // A function made here captures this environment to reach the names
      // around it, so there has to be one for it to capture.
      rootOf(scope).dynamic = true;
      return compileFnExpr(expr, compileIn);
    // Compiled with the scope rather than only with a way to compile: what an
    // arm binds needs a slot, and slots belong to the scope.
    case "MatchExpr":
      return compileMatch(expr, scope, compileIn);
    // Same reason: the name a `catch` gives the failure needs a slot.
    case "TryExpr":
      return compileTry(expr, scope, compileIn);
    default:
      return operation(expr, (inner) => compileIn(inner, scope));
  }
}

function operation(expr: Expr, compile: Compile): Thunk {
  switch (expr.$type) {
    case "Member":
      return compileMember(expr, compile);
    case "FnExpr":
      return compileFnExpr(expr, compileIn);
    case "Call":
      return compileCall(expr, compile);
    case "Index":
      return compileIndex(expr, compile);
    case "Binary":
      return compileBinary(expr, compile);
    case "Unary":
      return compileUnary(expr, compile);
    case "Ternary":
      return compileTernary(expr, compile);
    case "ListLit":
      return compileList(expr, compile);
    case "MapLit":
      return compileMap(expr, compile);
    default:
      // Not a node the grammar can produce: the only one left is the value a
      // decorator's `.setValue` put here.
      return constThunk(expr) ?? NOTHING;
  }
}

/**
 * Compile a name into the cheapest read available.
 *
 * A name the enclosing function binds is an index into the frame. Anything else
 * (a top-level binding, a namespace, the prelude) is a cell the closure
 * resolved when it was built, which is an index too.
 *
 * The lookup fallback stays for environments that hand out no cells: a function
 * nested inside another reads its parent's frame, and an expression compiled at
 * the root has no closure at all.
 */
function compileRef(name: string, scope: LexScope): Thunk {
  const body = rootOf(scope);
  const slot = slotOf(scope, name);
  // The one name a bare body binds is the value it was handed, unwrapped.
  if (slot === 0 && body.bare) return (env) => env;
  if (slot !== -1) return slotThunk(slot);
  // One closure owns this body, so the cell can be held right here: no frame to
  // carry it, and no chain to walk.
  const own = body.cellOf?.(name);
  if (own) return () => own.value;
  const up = freeSlot(scope, name);
  // A slot is only ever made for a name the compiler resolved, so reading one
  // needs no check. The fallback is the other case, where a name may not be
  // bound at all, and an unbound name is the language's one nothing.
  if (up === undefined) return (env) => named(env, name);
  return (env) => {
    const cells = (env as Frame).up;
    return cells === undefined ? named(env, name) : (cells[up] as Cell).value;
  };
}

/** A name looked up by name, where absent and `null` are the same answer. */
function named(env: EvalEnv, name: string): unknown {
  const held = env.lookup(name);
  return held === undefined ? null : held;
}

/**
 * Reading one slot, written for the slot it reads.
 *
 * The first three are fields of the frame, so each gets a thunk naming that
 * field outright: one property load, and the same one every time this thunk
 * runs, which is what lets V8 settle the site.
 */
function slotThunk(slot: number): Thunk {
  if (slot === 0) return (env) => (env as Frame).s0;
  if (slot === 1) return (env) => (env as Frame).s1;
  if (slot === 2) return (env) => (env as Frame).s2;
  const at = slot - 3;
  return (env) => ((env as Frame).rest as unknown[])[at];
}
