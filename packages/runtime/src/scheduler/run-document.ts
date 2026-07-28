import {
  type Document,
  evaluate,
  type FlowDecl,
  isFlowDecl,
  isMatrixDecl,
  isStepDecl,
  type PlannedStep,
  type RunPlan,
} from "@venn/core";
import { createScope, type Scope } from "../scope/index.js";
import { absorbExit } from "./absorb-exit.js";
import { hasAnnotation, readTags } from "./annotations.js";
import { createBaseScope } from "./base-scope.js";
import { bindGlobals } from "./bind-globals.js";
import { bindImports } from "./bind-imports.js";
import { collectHooks, type SuiteHooks } from "./collect.js";
import type { Engine } from "./engine.types.js";
import { matchesTitle } from "./filter.js";
import { settleFlaky } from "./flaky.js";
import { runFlow } from "./run-flow.js";
import { runHooks } from "./run-lifecycle.js";
import { runPrologue, runTeardowns } from "./run-prologue.js";

/**
 * Walk a document: setup once, then for each `matrix` variant bind `env`/`matrix`
 * globals, open resources, run flows (with before/afterEach), close resources.
 */
export async function runDocument(engine: Engine, doc: Document): Promise<void> {
  const flows = selectFlows(engine, doc.decls.filter(isFlowDecl));
  const hooks = collectHooks(doc);
  engine.emitter.emit({ kind: "run.started", data: { plan: planOf(flows) } });
  const start = engine.clock.now();
  await runSuite({ engine, doc, flows, hooks });
  settleFlaky(engine);
  const durationMs = engine.clock.now() - start;
  engine.emitter.emit({ kind: "run.finished", data: { ...engine.result, durationMs } });
}

/**
 * Suite hooks run once, on either side of every variant, so they get a root of
 * their own: the document's bindings without any one variant's `matrix`.
 *
 * An `exit` in `setup` ends the run where it stands, so the variants never
 * start, and `teardown` still runs, because what `setup` opened is still open.
 * Both sides absorb their own, so the code reaches the host and `run.finished`
 * is still emitted above.
 */
async function runSuite(args: {
  engine: Engine;
  doc: Document;
  flows: readonly FlowDecl[];
  hooks: SuiteHooks;
}): Promise<void> {
  const { engine, hooks } = args;
  const suite = rootScope({ engine, doc: args.doc, variant: {} });
  await absorbExit(engine, async () => {
    await runHooks({ engine, hooks: hooks.setup, scope: suite });
    await runVariants(args);
  });
  await absorbExit(engine, () => runHooks({ engine, hooks: hooks.teardown, scope: suite }));
}

/** Every `matrix` variant is a full pass over the flows, one after the other. */
async function runVariants(args: {
  engine: Engine;
  doc: Document;
  flows: readonly FlowDecl[];
  hooks: SuiteHooks;
}): Promise<void> {
  for (const variant of matrixVariants(args.engine, args.doc)) {
    await runVariant({ ...args, variant });
  }
}

async function runVariant(args: {
  engine: Engine;
  doc: Document;
  flows: readonly FlowDecl[];
  hooks: SuiteHooks;
  variant: Record<string, unknown>;
}): Promise<void> {
  const root = rootScope({ engine: args.engine, doc: args.doc, variant: args.variant });
  const teardowns = await runPrologue({ engine: args.engine, doc: args.doc, scope: root });
  try {
    await runFlows({ ...args, root });
  } finally {
    // Whatever ends the pass, a failure or an `exit` on its way out of the run,
    // the suite still gives back what it opened.
    await runTeardowns(teardowns);
  }
}

async function runFlows(args: {
  engine: Engine;
  flows: readonly FlowDecl[];
  hooks: SuiteHooks;
  root: Scope;
}): Promise<void> {
  for (const flow of args.flows) {
    await runFlowWithHooks({ engine: args.engine, flow, hooks: args.hooks, root: args.root });
    if (args.engine.bail && args.engine.result.failed > 0) break;
  }
}

async function runFlowWithHooks(args: {
  engine: Engine;
  flow: FlowDecl;
  hooks: SuiteHooks;
  root: Scope;
}): Promise<void> {
  // A scope of its own, so what `beforeEach` opens dies with the flow that
  // needed it rather than lingering into the next one.
  const scope = args.root.child();
  const each = { engine: args.engine, scope };
  await runHooks({ ...each, hooks: args.hooks.beforeEach });
  await runFlow(args.engine, args.flow, scope);
  await runHooks({ ...each, hooks: args.hooks.afterEach });
}

/**
 * The scope a run reads from: the prelude, the plugin namespaces, `env`, the
 * matrix variant and the document's own globals. One per variant, so what one
 * variant binds is never visible to the next.
 */
function rootScope(args: {
  engine: Engine;
  doc: Document;
  variant: Record<string, unknown>;
}): Scope {
  const base = (): Scope => createBaseScope({ engine: args.engine, variant: args.variant });
  const root = base();
  const graph = args.engine.imports;
  // Before the document's own globals, so a local name of the same spelling
  // wins. That is the rule fragments already follow.
  if (graph) {
    bindImports({ document: args.doc, uri: args.engine.uri, scope: root, graph, base });
  }
  bindGlobals(args.doc, root);
  return root;
}

/** The cartesian product of the `matrix { … }` dimensions, else one empty variant. */
function matrixVariants(engine: Engine, doc: Document): Record<string, unknown>[] {
  const matrix = doc.decls.find(isMatrixDecl);
  if (!matrix) return [{}];
  const scope = createScope();
  scope.set("env", engine.env);
  return product(evaluate(matrix.body, scope) as Record<string, unknown>);
}

function product(dims: Record<string, unknown>): Record<string, unknown>[] {
  let combos: Record<string, unknown>[] = [{}];
  for (const [key, values] of Object.entries(dims)) {
    const list = Array.isArray(values) ? values : [values];
    combos = combos.flatMap((combo) => list.map((value) => ({ ...combo, [key]: value })));
  }
  return combos;
}

/** `@only` focuses, `@skip` drops, then the runner's own `--flow` / `--tags` filters. */
function selectFlows(engine: Engine, flows: readonly FlowDecl[]): FlowDecl[] {
  const only = flows.filter((flow) => hasAnnotation(flow, "only"));
  const pool = only.length > 0 ? only : flows;
  const kept = pool.filter((flow) => !hasAnnotation(flow, "skip"));
  const named = kept.filter((flow) => matchesTitle(flow.title, engine.filter.flow));
  return byTags(named, engine.filter.tags);
}

function byTags(flows: FlowDecl[], tags: readonly string[] | undefined): FlowDecl[] {
  if (!tags || tags.length === 0) return flows;
  return flows.filter((flow) => readTags(flow).some((tag) => tags.includes(tag)));
}

function planOf(flows: readonly FlowDecl[]): RunPlan {
  return { flows: flows.map((flow) => ({ title: flow.title, steps: stepTitles(flow) })) };
}

function stepTitles(flow: FlowDecl): PlannedStep[] {
  return flow.body.stmts.filter(isStepDecl).map((step) => ({ title: step.title }));
}
