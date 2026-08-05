import { buildProblem, CODES, type Problem, ProblemError, UNLOCATED } from "@venn-lang/core";
import type { ActionDefinition, ActionInput, ParamSpec } from "@venn-lang/sdk";
import { callParams } from "./call-params.js";
import { optionNames, takes } from "./declared-arity.js";
import type { Engine } from "./engine.types.js";
import { isPending } from "./settled.js";
import { splitValues } from "./split-values.js";
import type { VerbName } from "./split-values.types.js";
import { declaredKeys, strayKeyTitle } from "./unknown-option.js";

/**
 * A verb called from inside another expression: `print crypto.hash(x, { … })`,
 * a `"${…}"`, a list literal, an argument to a `fn`.
 *
 * The same input `runAction` builds for the statement form, announced the same
 * way. It used to build its own: no split by declared arity, so the trailing map
 * went in as an argument and the schema's defaults were used instead; no
 * validation, so a misspelt key was ignored; and no events, so the call was
 * invisible to every reporter and contributed no duration.
 *
 * Synchronous when the verb is. The pure corner of the stdlib is what expression
 * position is mostly for, and awaiting it would put a promise inside every
 * string that interpolates one.
 *
 * @param args The verb, what it is called, the run it belongs to, and its values.
 * @returns Whatever the verb produced, or the promise it produced.
 * @throws ProblemError `VN3001` for a key the verb never declared.
 */
export function runVerbValue(args: {
  action: ActionDefinition;
  name: VerbName;
  engine: Engine;
  values: readonly unknown[];
}): unknown {
  const { action, name, engine } = args;
  const input = inputOf(action, args.values, engine.uri);
  engine.emitter.emit({ kind: "action.started", data: name });
  const start = engine.clock.now();
  const value = action.run(engine.ctx, input);
  if (isPending(value)) return value.then((settled) => announced(args, start, settled));
  return announced(args, start, value);
}

/** The end, said, and then the value handed back untouched. */
function announced(
  args: { name: VerbName; engine: Engine },
  start: number,
  value: unknown,
): unknown {
  args.engine.emitter.emit({
    kind: "action.finished",
    data: { ...args.name, status: "passed", durationMs: args.engine.clock.now() - start },
  });
  return value;
}

/**
 * The trailing map is the options, split by declared arity and validated by the
 * schema behind them, exactly as `buildInput` does for the statement form.
 *
 * The written map is gone by the time this runs, so a refusal has the key and
 * not the entry that spelled it. The sentence is the same either way, which is
 * the part a person reads.
 */
function inputOf(
  action: ActionDefinition,
  values: readonly unknown[],
  uri: string,
): ActionInput<unknown> {
  const split = splitValues({ values, takes: takes(action), options: optionNames(action) });
  refuseStrays(action, split.opts);
  const raw = split.opts ?? {};
  return { args: split.args, params: validated(action, raw, uri) };
}

function validated(action: ActionDefinition, raw: unknown, uri: string): unknown {
  return callParams({ schema: action.params, opts: undefined, raw, site: NOWHERE, uri });
}

function refuseStrays(action: ActionDefinition, opts: Record<string, unknown> | undefined): void {
  if (!opts) return;
  const specs = declaredKeys(action.params);
  if (specs.length === 0) return;
  const known = new Set(specs.map((spec) => spec.name));
  const stray = Object.keys(opts).find((key) => !known.has(key));
  if (stray !== undefined) throw new ProblemError(unknownOption(stray, specs));
}

function unknownOption(key: string, specs: readonly ParamSpec[]): Problem {
  return buildProblem({
    spec: CODES.VN3001_UNKNOWN_OPTION,
    // No node to point at: the map was a value by the time the verb was reached.
    span: UNLOCATED,
    title: strayKeyTitle(key, specs),
  });
}

/** `callParams` wants a node for a required option nobody wrote; there is none. */
const NOWHERE = { $type: "Call" } as never;
