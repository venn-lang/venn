import { ConsolePort, VennError } from "@venn-lang/contracts";
import {
  type ActionCall,
  type AstNode,
  CODES,
  callArgs,
  display,
  evaluate,
  invoke,
  splitCall,
} from "@venn-lang/core";
import type { ActionDefinition, ActionInput } from "@venn-lang/sdk";
import type { Scope } from "../scope/index.js";
import { callParams } from "./call-params.js";
import { takes } from "./declared-arity.js";
import type { Engine } from "./engine.types.js";
import { failError } from "./fail-error.js";
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
  if (callee !== undefined) return callMethod(callee, call, scope);
  const { namespace, name } = resolveTarget(call.target, engine.aliases);
  const resolved = engine.registry.action({ namespace, name });
  if (!resolved) throw unknownAction(call.target);
  engine.emitter.emit({ kind: "action.started", data: { namespace, action: name } });
  const start = engine.clock.now();
  const value = await resolved.action.run(
    engine.ctx,
    await buildInput({ action: resolved.action, call, scope, uri: engine.uri }),
  );
  const durationMs = engine.clock.now() - start;
  engine.emitter.emit({
    kind: "action.finished",
    data: { namespace, action: name, status: "passed", durationMs },
  });
  return value;
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
  const split = splitCall(args.call.args, takes(args.action));
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

function unknownAction(target: string): VennError {
  return new VennError({
    code: CODES.VN2003_UNKNOWN_ACTION.code,
    message: `Unknown action "${target}".`,
    detail: { target },
  });
}

/** Prelude verbs, available without `use` (§12): print, log, wait, skip, fail, exit. */
async function runPrelude(engine: Engine, call: Invocation, scope: Scope): Promise<void> {
  const args = await Promise.all(call.args.map((arg) => settle(evaluate(arg, scope))));
  if (call.target === "print") return printLine(engine, args);
  if (call.target === "log") return logLine(engine, args);
  const message = String(args[0] ?? "");
  if (call.target === "wait") await engine.clock.sleep(waitMs(args[0]));
  else if (call.target === "skip") skipLog(engine, message);
  else if (call.target === "exit") throw new ExitSignal(exitCode(args[0]));
  else if (call.target === "fail") {
    const opts = await failOpts(call, scope);
    throw failError({ message, opts, where: nodeSpan(siteOf(call), engine.uri) });
  }
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

function waitMs(value: unknown): number {
  if (typeof value === "number") return value;
  const duration = value as { kind?: string; ms?: number };
  return duration?.kind === "duration" ? (duration.ms ?? 0) : 0;
}
