import { type ActionDefinition, defineAction } from "@venn-lang/sdk";
import { allFakerSpecs, type FakerSpec } from "../faker/index.js";
import { rngFrom } from "../rng/index.js";

/** Turn one spec into the `data.faker.<name>` verb, drawn from the run's stream. */
function toAction(spec: FakerSpec): ActionDefinition {
  return defineAction({
    name: `faker.${spec.name}`,
    doc: spec.doc,
    // A faker verb takes bounds, not options, so every argument is positional:
    // `faker.int(1, 10)`. The spec declares which ones it reads.
    args: spec.args,
    result: spec.result,
    run: (ctx, input) => spec.make(rngFrom(ctx), input.args),
  });
}

/**
 * The `data.faker.*` verbs. Every value comes from the run's own `Random`, which
 * the runner hands back at the start of every flow, so a flow replays exactly
 * whether it ran alone or after another. The catalogue lives in `faker/`.
 */
export const fakerActions: ActionDefinition[] = allFakerSpecs.map(toAction);
