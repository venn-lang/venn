import {
  type AstNode,
  type Call,
  type Expr,
  isCall,
  isMember,
  isRef,
  type LetStmt,
  type MapLit,
} from "@venn-lang/core";

/** What running an action needs, whichever syntax spelled it. */
export interface Invocation {
  target: string;
  args: readonly Expr[];
  opts?: MapLit;
  /**
   * Where the call is written, for a failure with no smaller node to point at.
   * Absent when the invocation *is* the node: a call spelled as a statement.
   */
  node?: AstNode;
}

/**
 * The dotted path an expression spells, such as `http.post`, or undefined when
 * it is not a plain path. The parser cannot tell a namespace from a field; only
 * the registry can, so the path is carried this far as an expression.
 */
export function actionTarget(expr: Expr | undefined): string | undefined {
  if (!expr) return undefined;
  if (isRef(expr)) return expr.name;
  if (!isMember(expr) || expr.optional) return undefined;
  const receiver = actionTarget(expr.receiver);
  return receiver === undefined ? undefined : `${receiver}.${expr.member}`;
}

/**
 * The bareword action a `let` spells: `let auth = http.post url { … }`. The
 * trailing arguments or options map are what mark it as a call. A parenthesised
 * call (`f(x)`) is an ordinary expression the evaluator runs, since it may be a
 * `fn` or a method rather than an action; only {@link actionCall} rescues the
 * case where it turns out to name a plugin action.
 */
export function invocationOf(stmt: LetStmt): Invocation | undefined {
  return remember(invocations, stmt, readInvocation);
}

function readInvocation(stmt: LetStmt): Invocation | undefined {
  if (stmt.args.length === 0 && !stmt.opts) return undefined;
  const target = actionTarget(stmt.value);
  if (target === undefined) return undefined;
  return { target, args: stmt.args, opts: stmt.opts, node: stmt };
}

/**
 * An action written in expression position: the bare path `data.faker.uuid`, or
 * the parenthesised `data.faker.uuid()`. Returns the target and its arguments,
 * or undefined when it is not a dotted path at all.
 */
export function actionCall(value: Expr): ActionShape | undefined {
  return remember(calls, value, readActionCall);
}

function readActionCall(value: Expr): ActionShape | undefined {
  const bare = actionTarget(value);
  if (bare !== undefined) return { target: bare, args: [] };
  if (!isCall(value)) return undefined;
  const target = actionTarget(value.callee);
  return target === undefined ? undefined : { target, args: argValues(value) };
}

/** An action in expression position: the path it names and its arguments. */
export interface ActionShape {
  target: string;
  args: readonly Expr[];
}

/**
 * What a node spells, worked out once.
 *
 * The shape of the tree decides whether `let y = x * 2` names an action, and the
 * tree does not change, so the answer is cached per node rather than rewalked
 * through the type guards on every execution. Whether the *name* resolves to an
 * action depends on the scope and the registry, so that part is not cached.
 */
const invocations = new WeakMap<LetStmt, Invocation | null>();
const calls = new WeakMap<Expr, ActionShape | null>();

function remember<K extends object, V>(
  cache: WeakMap<K, V | null>,
  key: K,
  read: (key: K) => V | undefined,
): V | undefined {
  const known = cache.get(key);
  if (known !== undefined) return known ?? undefined;
  const found = read(key) ?? null;
  cache.set(key, found);
  return found ?? undefined;
}

function argValues(call: Call): Expr[] {
  return (call.args?.args ?? []).map((arg) => arg.value);
}
