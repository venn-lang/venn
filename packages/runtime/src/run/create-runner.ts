import {
  type Document,
  expand,
  type FragmentDecl,
  type Problem,
  type RunId,
} from "@venn-lang/core";
import { createActionContext } from "../context/index.js";
import { createDecoratorSource } from "../decorators/index.js";
import { createEmitter, newRunId } from "../emit/index.js";
import { createPortResolver } from "../ports/index.js";
import { buildRegistry } from "../registry/index.js";
import {
  absorbExit,
  collectAliases,
  collectConfig,
  collectFragments,
  createCleanupList,
  type Engine,
  runDocument,
  runScript,
} from "../scheduler/index.js";
import type { Runner, RunnerArgs, RunOnceInput, RunResult } from "./runner.types.js";

/**
 * Build a runner: negotiate plugins and wire ports once, then reuse them for
 * every run.
 *
 * @param args The host, the plugins, the event sink and the per-run options.
 * @returns A runner exposing test mode (`run`) and script mode (`script`).
 * @throws VennError `VN2010` when a plugin requires a capability the host lacks.
 */
export function createRunner(args: RunnerArgs): Runner {
  const registry = buildRegistry({ plugins: args.plugins, caps: args.host.caps });
  const resolver = createPortResolver({ bindings: args.ports ?? [], caps: args.host.caps });
  const decorators = createDecoratorSource(args.plugins);
  const drive = (walk: Walk) => (document: Document) => {
    // Decorators run first, on every path: what the scheduler walks is the tree
    // they left, not the one the parser produced.
    const expansion = expand({ document, decorators, uri: args.uri, imported: args.moduleDecos });
    return runOnce({ args, registry, resolver, document }, walk, expansion.problems);
  };
  return { run: drive(runDocument), script: drive(runScript) };
}

type Walk = (engine: Engine, document: Document) => Promise<void>;

async function runOnce(input: RunOnceInput, walk: Walk, problems: Problem[]): Promise<RunResult> {
  const run = newRunId({ clock: input.args.host.clock, random: input.args.host.random });
  const engine = buildEngine(input, run);
  // The walk absorbs an `exit` of its own so the run still ends tidily; this is
  // the backstop for one thrown where no walk was left to absorb it.
  await absorbExit(engine, () => walk(engine, input.document));
  return {
    run,
    problems,
    passed: engine.result.passed,
    failed: engine.result.failed,
    exitCode: engine.exit,
  };
}

function buildEngine(input: RunOnceInput, run: RunId): Engine {
  const { args, registry } = input;
  return {
    registry,
    emitter: createEmitter({ sink: args.sink, run, clock: args.host.clock }),
    clock: args.host.clock,
    lock: args.host.lock,
    uri: args.uri ?? "memory://inline.vn",
    result: { passed: 0, failed: 0 },
    flaky: new Map(),
    filter: args.filter ?? {},
    bail: args.bail,
    cleanup: args.cleanup ?? createCleanupList(),
    ...documentParts(input),
  };
}

/** Everything derived from the document being run: config, fragments, aliases. */
function documentParts(input: RunOnceInput) {
  const { args, registry, resolver, document } = input;
  const env = args.env ?? {};
  const config = collectConfig(document, env);
  return {
    ctx: createActionContext({ host: args.host, ports: resolver, config }),
    fragments: mergeFragments(collectFragments(document), args.moduleFragments),
    imports: args.modules,
    aliases: collectAliases(document, registry),
    env,
  };
}

/** Local fragments take precedence over imported ones of the same name. */
function mergeFragments(
  local: Map<string, FragmentDecl>,
  imported: Map<string, FragmentDecl> | undefined,
): Map<string, FragmentDecl> {
  if (!imported) return local;
  const merged = new Map(imported);
  for (const [name, fragment] of local) merged.set(name, fragment);
  return merged;
}
