import { buildProblem, CODES } from "../codes/index.js";
import type { CompiledBody, CompiledLocal, Thunk } from "../compile/compile.types.js";
import { LEFT, raisedAt, runSteps } from "../compile/nodes/index.js";
import type { Expr } from "../generated/ast.js";
import { ProblemError, UNLOCATED } from "../problem/index.js";
import { kindOf } from "../value/index.js";
import { isClosure } from "./closure.js";
import type { Closure } from "./closure.types.js";
import { forHost } from "./for-host.js";
import { Frame, writeSlot } from "./frame.js";
import { type Invoke, isNativeFn, type NativeFn, nativeFn } from "./native.types.js";
import { isWaiting } from "./pending.js";

/**
 * Call any Venn callable, a `fn` closure or a built-in method, with values.
 *
 * A callee declaring fewer parameters than it is handed ignores the rest.
 *
 * @param callee What to call.
 * @param values What to call it with.
 * @param site The call as it was written, for a failure to point at. Absent
 * where there is no node, which is every call a built-in method makes.
 * @throws ProblemError VN3013 when the value is not callable.
 */
export function invoke(callee: unknown, values: readonly unknown[], site?: Expr): unknown {
  if (isClosure(callee)) return inFrame(callee, values);
  if (isNativeFn(callee)) return site ? placed(callee, values, site) : callee.call(values);
  // A bare host function, which is what an npm package exports. A member read
  // wraps one so it keeps its receiver; an import has no receiver to keep, and
  // wrapping there would hide the properties a callable package carries, since
  // `lodash` is a function with the whole library set on it.
  if (typeof callee === "function") return hosted(callee, values, site);
  throw notCallable(callee, site);
}

/** A body written in Venn, run over a frame of its own. */
function inFrame(callee: Closure, values: readonly unknown[]): unknown {
  const body = callee.body;
  if (body.bare) return (body.result as Thunk)(values[0] as never);
  const frame = new Frame(callee);
  const arity = callee.params.length;
  for (let at = 0; at < arity; at += 1) writeSlot(frame, at, values[at]);
  const filled = fill(callee, frame);
  if (isWaiting(filled)) return afterFilling(filled, body, frame);
  return finish(body, frame);
}

/** A host function called with the language's values, failing where it stands. */
function hosted(callee: unknown, values: readonly unknown[], site: Expr | undefined): unknown {
  const fn = callee as (...args: unknown[]) => unknown;
  const given = values.map(forHost);
  return site
    ? placed(
        nativeFn((sent) => fn(...sent)),
        given,
        site,
      )
    : fn(...given);
}

/** Whether {@link invoke} can call this, asked before committing to a call. */
export function isCallable(value: unknown): boolean {
  return isClosure(value) || isNativeFn(value) || typeof value === "function";
}

/** The invoker handed to the built-in methods, fixed arities included. */
export const INVOKE: Invoke = Object.assign(invoke, {
  one: invoke1,
  two: invoke2,
  three: invoke3,
});

/**
 * Call with a single value, without building an argument list for it.
 *
 * One argument is what most calls carry, and the array holding it would live
 * exactly as long as the call takes to read it out again.
 *
 * @param callee What to call.
 * @param arg The one value it takes.
 * @param site The call as it was written, for a failure to point at.
 * @throws ProblemError VN3013 when the value is not callable.
 */
export function invoke1(callee: unknown, arg: unknown, site?: Expr): unknown {
  if (isClosure(callee)) {
    const body = callee.body;
    if (body.bare) return (body.result as Thunk)(arg as never);
    const frame = new Frame(callee);
    if (callee.params.length > 0) frame.s0 = arg;
    const filled = fill(callee, frame);
    if (isWaiting(filled)) return afterFilling(filled, body, frame);
    return finish(body, frame);
  }
  if (isNativeFn(callee)) return site ? placed(callee, [arg], site) : callee.call([arg]);
  throw notCallable(callee, site);
}

/**
 * The same for two and three values, which is what the list methods hand over.
 *
 * `xs.map(fn (x) => …)` calls its function once per element, so an argument
 * list would be one array per element built only to be taken apart again.
 */
export function invoke2(callee: unknown, a: unknown, b: unknown): unknown {
  if (isClosure(callee)) return callClosure2(callee, a, b);
  if (isNativeFn(callee)) return callee.call([a, b]);
  throw notCallable(callee, undefined);
}

export function invoke3(callee: unknown, a: unknown, b: unknown, c: unknown): unknown {
  if (isClosure(callee)) return callClosure3(callee, a, b, c);
  if (isNativeFn(callee)) return callee.call([a, b, c]);
  throw notCallable(callee, undefined);
}

/**
 * Run a closure's compiled body against the given argument values.
 *
 * One allocation for the call: the frame itself. The names, the body and every
 * expression in it were settled when the function was compiled.
 *
 * @returns The body's result, or a promise for it when the body reached
 * something that has not arrived yet.
 */
export function callClosure(closure: Closure, values: readonly unknown[]): unknown {
  if (closure.body.bare) return (closure.body.result as Thunk)(values[0] as never);
  const frame = new Frame(closure);
  const arity = closure.params.length;
  for (let at = 0; at < arity; at += 1) writeSlot(frame, at, values[at]);
  const filled = fill(closure, frame);
  if (isWaiting(filled)) return afterFilling(filled, closure.body, frame);
  return finish(closure.body, frame);
}

// A function declaring fewer parameters than it is handed ignores the rest:
// `xs.map(fn (x) => x)` never asks for the index it is offered.
function callClosure2(closure: Closure, a: unknown, b: unknown): unknown {
  if (closure.body.bare) return (closure.body.result as Thunk)(a as never);
  const frame = new Frame(closure);
  const arity = closure.params.length;
  if (arity > 0) frame.s0 = a;
  if (arity > 1) frame.s1 = b;
  const filled = fill(closure, frame);
  if (isWaiting(filled)) return afterFilling(filled, closure.body, frame);
  return finish(closure.body, frame);
}

function callClosure3(closure: Closure, a: unknown, b: unknown, c: unknown): unknown {
  if (closure.body.bare) return (closure.body.result as Thunk)(a as never);
  const frame = new Frame(closure);
  const arity = closure.params.length;
  if (arity > 0) frame.s0 = a;
  if (arity > 1) frame.s1 = b;
  if (arity > 2) frame.s2 = c;
  const filled = fill(closure, frame);
  if (isWaiting(filled)) return afterFilling(filled, closure.body, frame);
  return finish(closure.body, frame);
}

/**
 * Fill the body's locals in order, then answer with its result.
 *
 * Written out at each call site rather than called, because every frame on the
 * way in is a frame recursion cannot use: a Venn call that goes through one
 * extra JS function divides the depth a program can reach. Four sites is the
 * price of the depth, and the loop is three lines.
 *
 * A binding that reached the world is settled before the one after it is
 * evaluated. Without that, `const r = http.get(u)` and the line under it run at
 * the same time and the second reads the world before the first changed it. The
 * wait costs one comparison per binding and allocates nothing until something
 * is actually slow.
 */
function fill(closure: Closure, frame: Frame, from = 0): void | Promise<void> {
  const locals = closure.body.locals;
  for (let at = from; at < locals.length; at += 1) {
    const local = locals[at] as (typeof locals)[number];
    const held = local.value(frame);
    if (isWaiting(held)) return held.then((settled) => behind({ closure, frame, at, settled }));
    writeSlot(frame, local.slot, local.box ? local.box(held) : held);
  }
}

/** The binding that was slow, written, and then the ones behind it. */
function behind(args: {
  closure: Closure;
  frame: Frame;
  at: number;
  settled: unknown;
}): void | Promise<void> {
  const { closure, frame, at, settled } = args;
  const local = closure.body.locals[at] as CompiledLocal;
  writeSlot(frame, local.slot, local.box ? local.box(settled) : settled);
  return fill(closure, frame, at + 1);
}

/** The body's answer once its slow bindings have landed. Off the fast path. */
function afterFilling(filled: Promise<void>, body: CompiledBody, frame: Frame): Promise<unknown> {
  return filled.then(() => finish(body, frame));
}

/**
 * Run what is left of a body: its statements, then the value it ends in.
 *
 * A body with no statements is every body written before one could hold them,
 * and it pays for one comparison against `undefined` here rather than for a
 * loop over an empty array.
 *
 * Statements that reached the world answer later, and the value the body ends
 * in is read after them, never beside them. Handing that promise back is what
 * makes the whole call slow rather than the one line inside it: whoever wrote
 * the call is a statement too, and waits there.
 */
function finish(body: CompiledBody, frame: Frame): unknown {
  if (!body.steps) return body.result ? body.result(frame) : null;
  const ran = runSteps(body.steps, frame);
  if (!isWaiting(ran)) return ended(ran, body, frame);
  return ran.then((stopped) => ended(stopped, body, frame));
}

/** What the body answers, once every statement in it has finished. */
function ended(stopped: number, body: CompiledBody, frame: Frame): unknown {
  if (stopped === LEFT) return frame.left;
  return body.result ? body.result(frame) : null;
}

/**
 * A built-in method or a plugin verb, with the call it came from behind it.
 *
 * Only this branch needs it. A `fn` raises through the compiled nodes of its
 * own body, and each of those places its failure at the line that wrote it,
 * which is nearer than the call. What has no node at all is everything below
 * the language: `json.parse` refusing text, `fs.read` refusing a path.
 *
 * Both halves are here because a verb that answers later fails later, by which
 * time the handler has returned and the failure is a rejection instead.
 */
function placed(callee: NativeFn, values: readonly unknown[], site: Expr): unknown {
  try {
    const value = callee.call(values);
    if (!(value instanceof Promise)) return value;
    return value.catch((thrown: unknown) => {
      throw raisedAt(thrown, site);
    });
  } catch (thrown) {
    throw raisedAt(thrown, site);
  }
}

/**
 * The kind is the language's own word for what the value is. `typeof` answered
 * here, so a member that is not there reported `undefined`, which is not a type
 * a reader can write and not a word this language has.
 */
function notCallable(value: unknown, site: Expr | undefined): ProblemError {
  const refusal = new ProblemError(
    buildProblem({
      spec: CODES.VN3013_NOT_CALLABLE,
      span: UNLOCATED,
      title: `This value is not a function, so it cannot be called: ${kindOf(value)}.`,
    }),
  );
  return site ? (raisedAt(refusal, site) as ProblemError) : refusal;
}
