import type { Document } from "@venn/core";
import type { Scope } from "../scope/index.js";
import { absorbExit } from "./absorb-exit.js";
import { createBaseScope } from "./base-scope.js";
import { bindFunctions } from "./bind-globals.js";
import { bindImports } from "./bind-imports.js";
import type { Engine } from "./engine.types.js";
import { runPrologue } from "./run-prologue.js";
import { registerEnding, runSetup } from "./script-lifecycle.js";

/**
 * Run a document as a program: its top-level statements, in order, top to
 * bottom, because the file itself is the entry point. Declarations (`flow`,
 * `fn`, `type`, …) are definitions and run only when something calls them.
 *
 * `setup`, `teardown` and `defer` are the program's own lifetime: `setup` runs
 * before the first statement and the rest are handed to the host to run on the
 * way out, because a program that serves outlives its last line.
 */
export async function runScript(engine: Engine, doc: Document): Promise<void> {
  const base = (): Scope => createBaseScope({ engine });
  const root = base();
  const graph = engine.imports;
  if (graph) bindImports({ document: doc, uri: engine.uri, scope: root, graph, base });
  bindFunctions(doc, root);
  engine.emitter.emit({ kind: "run.started", data: { plan: { flows: [] } } });
  const start = engine.clock.now();
  await absorbExit(engine, () => runProgram(engine, doc, root));
  const durationMs = engine.clock.now() - start;
  engine.emitter.emit({ kind: "run.finished", data: { ...engine.result, durationMs } });
}

/**
 * The program's lifetime: its `setup`, the ending it declared, then its
 * statements, all inside the one absorb, because `setup` is as much the program
 * as its first line. Outside it, an `exit` in `setup` would escape past
 * `run.finished` and leave the stream open.
 *
 * The ending is registered whatever happens to `setup`: a setup that exited or
 * failed still opened what it opened, and `teardown` is how it gives it back.
 */
async function runProgram(engine: Engine, doc: Document, scope: Scope): Promise<void> {
  const ending = registerEnding({ engine, doc, scope });
  await runSetup({ engine, doc, scope });
  // Collected into the ending as they are reached, so a program interrupted
  // halfway gives back exactly what it had managed to take.
  await runPrologue({ engine, doc, scope, into: ending.deferred });
}
