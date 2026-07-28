import {
  type Block,
  type Declaration,
  type Document,
  isLifecycleDecl,
  isRunnable,
  type LifecycleDecl,
} from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { runBlock } from "./run-block.js";
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
    if (isDefer(node)) teardowns.push(deferred({ ...args, body: node.body }));
    else if (isRunnable(node)) await runStatement(args.engine, node, args.scope);
  }
  return teardowns;
}

/** `defer { … }` written at the top of a file: registered here, run on the way out. */
function isDefer(node: Declaration): node is Declaration & LifecycleDecl {
  return isLifecycleDecl(node) && node.hook === "defer";
}

function deferred(args: { engine: Engine; body: Block; scope: Scope }): Teardown {
  // Cleanup must complete even when what it tidies was cancelled mid-flight.
  const engine: Engine = { ...args.engine, signal: undefined };
  return async () => {
    await runBlock(engine, args.body, args.scope.child());
  };
}

/** Undo in reverse: what opened last is given back first. */
export async function runTeardowns(teardowns: readonly Teardown[]): Promise<void> {
  for (const teardown of [...teardowns].reverse()) await teardown();
}
