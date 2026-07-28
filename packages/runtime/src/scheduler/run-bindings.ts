import {
  type CaptureStmt,
  evaluate,
  isNamespaceValue,
  type LetStmt,
  type ReturnStmt,
} from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { actionCall, type Invocation, invocationOf } from "./invocation.js";
import type { Pending } from "./pending.types.js";
import { runAction } from "./run-action.js";
import { isPending } from "./settled.js";
import { ReturnSignal } from "./signals.js";
import { resolveTarget } from "./target.js";

/**
 * `let plan = "pro"` binds a value; `let auth = http.post url { … }` binds what
 * the action returned. Naming the result is what makes it readable: there is no
 * implicit variable to know about.
 */
export function runLet(engine: Engine, stmt: LetStmt, scope: Scope): Pending {
  const call = invocationOf(stmt) ?? impliedCall(engine, stmt, scope);
  // Only a call suspends. Binding a plain expression is the common case, and
  // an `async` here would cost a promise per iteration of every loop.
  if (!call) return bind(stmt.name, evaluate(stmt.value, scope), scope);
  return runAction(engine, call, scope).then((value) => scope.set(stmt.name, value));
}

/**
 * `let id = data.faker.uuid` or `let id = data.faker.uuid()`: a dotted path
 * naming a plugin action is a call, exactly as it would be as a statement.
 *
 * A binding in scope always wins, so `let code = res.status` reads a field and
 * `let parts = name.split(" ")` calls a method. Neither turns into I/O, whatever
 * the registry happens to hold.
 */
function impliedCall(engine: Engine, stmt: LetStmt, scope: Scope): Invocation | undefined {
  const call = actionCall(stmt.value);
  const dot = call ? call.target.indexOf(".") : -1;
  if (!call || dot < 0 || bound(scope, call.target.slice(0, dot))) return undefined;
  const resolved = engine.registry.action(resolveTarget(call.target, engine.aliases));
  return resolved ? { target: call.target, args: call.args, node: stmt } : undefined;
}

/** A name the user bound. A plugin namespace in scope is not one, so the verb still calls. */
function bound(scope: Scope, name: string): boolean {
  const value = scope.lookup(name);
  return value !== undefined && !isNamespaceValue(value);
}

/** Bind now, or once the value it is waiting on arrives. */
function bind(name: string, value: unknown, scope: Scope): Pending {
  if (isPending(value)) return value.then((settled) => scope.set(name, settled));
  return void scope.set(name, value);
}

/** `capture` is removed in favour of `let`; still run, so old files keep working. */
export function runCapture(stmt: CaptureStmt, scope: Scope): void {
  scope.set(stmt.name, evaluate(stmt.value, scope));
}

/** `return expr`: unwind to the enclosing fragment with the value. */
export function runReturn(stmt: ReturnStmt, scope: Scope): never {
  const value = stmt.value ? evaluate(stmt.value, scope) : undefined;
  throw new ReturnSignal(value);
}
