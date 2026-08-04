import {
  type Declaration,
  type Document,
  isLifecycleDecl,
  isRunnable,
  type LifecycleDecl,
} from "@venn-lang/core";
import { closeAll } from "../cleanup/index.js";
import type { Scope } from "../scope/index.js";
import { branchEngine } from "./branch-engine.js";
import type { Engine } from "./engine.types.js";
import { keepExit, runCleanup } from "./run-cleanup.js";
import { runStatement } from "./run-statements.js";

/** A cleanup a program deferred, to be run on the way out. */
export type Teardown = () => Promise<void>;

/**
 * A document's top-level statements, run once, in the order they are written.
 *
 * The same lines mean the same thing in both modes: a script *is* its prologue,
 * and a test file runs one before its flows. So a `const` calling a verb at the
 * top of a file opens the thing either way, and the flows never find `null`.
 *
 * @param args.into Where deferred cleanups accumulate, in written order. A
 * program's ending is registered before its statements run, so it has to see
 * what they defer as they reach it rather than afterwards.
 * @returns The teardowns collected, which is `into` when one was supplied.
 */
export async function runPrologue(args: {
  engine: Engine;
  doc: Document;
  scope: Scope;
  into?: Teardown[];
}): Promise<Teardown[]> {
  const teardowns = args.into ?? [];
  for (const node of args.doc.decls) {
    if (isDefer(node)) teardowns.push(deferred({ ...args, hook: node }));
    else if (isRunnable(node)) await runStatement(args.engine, node, args.scope);
  }
  return teardowns;
}

/** `defer { … }` written at the top of a file: registered here, run on the way out. */
function isDefer(node: Declaration): node is Declaration & LifecycleDecl {
  return isLifecycleDecl(node) && node.hook === "defer";
}

function deferred(args: { engine: Engine; hook: LifecycleDecl; scope: Scope }): Teardown {
  // Cleanup must complete even when what it tidies was cancelled mid-flight.
  const engine = branchEngine(args.engine, undefined);
  return () => runCleanup(engine, args.hook, args.scope);
}

/**
 * Undo in reverse: what opened last is given back first, and every one of them
 * runs however any of them ends.
 *
 * @returns What each failing cleanup threw, each already reported as VN7004.
 * The caller decides what a cleanup that could not finish means for the verdict.
 */
export async function runTeardowns(teardowns: readonly Teardown[]): Promise<readonly unknown[]> {
  return keepExit(await closeAll([...teardowns].reverse()));
}
