import { ConsolePort, VennError } from "@venn-lang/contracts";
import {
  type ActionCall,
  type AstNode,
  CODES,
  callArgs,
  display,
  durationMs,
  evaluate,
  failError,
  invoke,
  placeAt,
  type Span,
  splitCall,
} from "@venn-lang/core";
import type { ActionDefinition, ActionInput } from "@venn-lang/sdk";
import type { Scope } from "../scope/index.js";
import { callParams } from "./call-params.js";
import { checkpoint } from "./checkpoint.js";
import { optionNames, takes } from "./declared-arity.js";
import type { Engine } from "./engine.types.js";
import type { Invocation } from "./invocation.js";
import { localCallee } from "./local-call.js";
import { nodeSpan } from "./node-span.js";
import { settle } from "./settled.js";
import { ExitSignal } from "./signals.js";
import { PRELUDE, resolveTarget } from "./target.js";

/**
 * Resolve, invoke and time an action call.
 *
 * @returns Whatever the action produced. The caller names it: there is no
 * implicit `res` for a reader to know about.
 * @throws VennError `VN2003` when no plugin provides the target.
 */
export async function runAction(engine: Engine, call: Invocation, scope: Scope): Promise<unknown> {
  if (PRELUDE.has(call.target)) return runPrelude(engine, call, scope);
  // `conn.close()` is a method on something the program holds. A name it bound
  // beats a namespace of the same name, so this is asked first.
  const callee = localCallee(call.target, scope);
  if (callee !== undefined) return placed(engine, call, () => callMethod(callee, call, scope));
  const { namespace, name } = resolveTarget(call.target, engine.aliases);
  const resolved = engine.registry.action({ namespace, name });
  if (!resolved)
    throw unknownAction({ target: call.target, where: nodeSpan(siteOf(call), engine.uri) });
  engine.emitter.emit({ kind: "action.started", data: { namespace, action: name } });
  const start = engine.clock.now();
  const value = await ran({ action: resolved.action, engine, call, scope });
  const elapsed = engine.clock.now() - start;
  engine.emitter.emit({
    kind: "action.finished",
    data: { namespace, action: name, status: "passed", durationMs: elapsed },
  });
  return value;
}

/**
 * Whatever the call raised, pointed at the line that made it.
 *
 * A plugin raises what it knows: the text it could not read, the file that was
 * not there. It has no node, and a `let` spelling a verb is not a compiled call
 * either, so nothing between the plugin and the reporter holds one and
 * `json.parse` on a bad line reached stderr with no `at` at all.
 *
 * A throw carrying no problem is given one here, which is how it keeps its
 * code: script mode reads the code off the problem, and the `instanceof
 * VennError` it falls back to is false across two bundles of `contracts`.
 */
async function placed(
  engine: Engine,
  call: Invocation,
  work: () => Promise<unknown>,
): Promise<unknown> {
  try {
    return await work();
  } catch (thrown) {
    placeAt(thrown, nodeSpan(siteOf(call), engine.uri));
    throw thrown;
  }
}

/** The verb itself, with its arguments built inside the same reach. */
async function ran(args: {
  action: ActionDefinition;
  engine: Engine;
  call: Invocation;
  scope: Scope;
}): Promise<unknown> {
  const { action, engine, call, scope } = args;
  return placed(engine, call, async () =>
    action.run(engine.ctx, await buildInput({ action, call, scope, uri: engine.uri })),
  );
}

/** Call a value the program holds, and wait for it as any other call is waited for. */
async function callMethod(callee: unknown, call: Invocation, scope: Scope): Promise<unknown> {
  const values = await Promise.all(call.args.map((expr) => settle(evaluate(expr, scope))));
  return settle(invoke(callee, values));
}

/**
 * An action written as a bare statement: run it, drop what it returned.
 *
 * The arguments are normalised here because the two spellings, `conn.close()`
 * and `http.get "url"`, put them in different places on the node.
 */
export async function runActionStatement(
  engine: Engine,
  call: ActionCall,
  scope: Scope,
): Promise<void> {
  await runAction(engine, { ...call, args: callArgs(call) }, scope);
}

async function buildInput(args: {
  action: ActionDefinition;
  call: Invocation;
  scope: Scope;
  uri: string;
}): Promise<ActionInput<unknown>> {
  // The trailing `{ … }` is the options in both spellings, but only the bareword
  // one puts it where the parser can label it. Splitting by declared arity is
  // what stops `http.get(url, { headers })` sending no headers at all.
  const split = splitCall({
    args: args.call.args,
    takes: takes(args.action),
    options: optionNames(args.action),
  });
  const opts = args.call.opts ?? split.opts;
  const positional = await Promise.all(
    split.args.map((expr) => settle(evaluate(expr, args.scope))),
  );
  const raw = await settle(opts ? evaluate(opts, args.scope) : {});
  const schema = args.action.params;
  const site = siteOf(args.call);
  return {
    args: positional,
    params: callParams({ schema, opts, raw, site, uri: args.uri }),
  };
}

/**
 * Where the call is written. A call spelled as a statement is its own node; one
 * rescued out of a `let` carries the statement that spells it, since the
 * invocation itself is a plain object with no place in the source.
 */
function siteOf(call: Invocation): AstNode {
  return call.node ?? (call as unknown as AstNode);
}

/**
 * `VN2003` at run time, where a check could not see it: `s.nope()` on a value
 * the checker only knows as dynamic.
 *
 * The span travels in `detail.where`, which is where a `VennError` says where it
 * happened: script mode has no step frame to supply one, so without it the
 * failure reached the terminal as a line with no location at all.
 */
function unknownAction(args: { target: string; where: Span }): VennError {
  return new VennError({
    code: CODES.VN2003_UNKNOWN_ACTION.code,
    message: `Unknown action "${args.target}".`,
    detail: { target: args.target, where: args.where },
  });
}

/**
 * Prelude verbs, available without `use` (§12): print, log, wait, skip, fail, exit.
 *
 * The prelude types `wait(duration)`, so a value that is not a length of time
 * has already been refused by the checker. Waiting not at all is the last
 * resort for a run that got here anyway, not a bound this pretends to honour.
 */
async function runPrelude(engine: Engine, call: Invocation, scope: Scope): Promise<void> {
  const args = await Promise.all(call.args.map((arg) => settle(evaluate(arg, scope))));
  if (call.target === "fail") {
    const opts = await failOpts(call, scope);
    throw failError({
      message: String(args[0] ?? ""),
      opts,
      where: nodeSpan(siteOf(call), engine.uri),
    });
  }
  return preludeVerb({ engine, name: call.target, args });
}

/**
 * One prelude verb, over arguments somebody else already evaluated.
 *
 * Split out because a compiled `fn` body reaches these through a value in scope
 * rather than through the scheduler, and both must be the same verb: two
 * printers is two languages. `fail` stays with its caller, which has the options
 * node and the span a raise needs.
 */
export async function preludeVerb(args: {
  engine: Engine;
  name: string;
  args: readonly unknown[];
}): Promise<void> {
  const { engine, name } = args;
  if (name === "print") return printLine(engine, args.args);
  if (name === "log") return logLine(engine, args.args);
  if (name === "wait") return waitFor(engine, durationMs(args.args[0]) ?? 0);
  if (name === "skip") return skipLog(engine, String(args.args[0] ?? ""));
  if (name === "exit") throw new ExitSignal(exitCode(args.args[0]));
}

/** The `{ code, data }` a `fail` carries, evaluated where it is written. */
async function failOpts(call: Invocation, scope: Scope): Promise<Record<string, unknown>> {
  const written = call.opts;
  if (!written) return {};
  return (await settle(evaluate(written, scope))) as Record<string, unknown>;
}

/**
 * `print x y`: the program's own output, on standard output. Distinct from
 * `log`, which records into the event stream a reporter reads.
 */
function printLine(engine: Engine, args: readonly unknown[]): void {
  engine.ctx.port(ConsolePort).write(`${line(args)}\n`);
}

/** `log a b c`: every argument, spaced, objects shown as JSON not `[object Object]`. */
function logLine(engine: Engine, args: readonly unknown[]): void {
  engine.emitter.emit({ kind: "log", data: { level: "info", message: line(args) } });
}

function line(args: readonly unknown[]): string {
  return args.map(display).join(" ");
}

/**
 * The code `exit` leaves with. Anything the machine cannot use as one still
 * ended badly, so `exit "boom"` leaves with 1 and never with 0, which would read
 * as success to whatever is waiting on this process.
 */
function exitCode(value: unknown): number {
  const code = Math.trunc(Number(value ?? 0));
  return Number.isFinite(code) ? code : 1;
}

function skipLog(engine: Engine, message: string): void {
  engine.emitter.emit({ kind: "log", data: { level: "warn", message: `skipped: ${message}` } });
}

/**
 * `wait 5s`, ended the moment the scope it runs in is called off.
 *
 * The check afterwards is what makes `wait` a boundary of its own. A cancelled
 * sleep resolves rather than rejecting, so a `wait` written last in a branch
 * would otherwise run out early and report the branch as having passed.
 */
async function waitFor(engine: Engine, ms: number): Promise<void> {
  await engine.clock.sleep(ms, engine.cancel?.signal);
  checkpoint(engine);
}
