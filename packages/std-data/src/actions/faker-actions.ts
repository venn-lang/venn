import { type ActionDefinition, defineAction } from "@venn-lang/sdk";
import { allFakerSpecs, type FakerSpec } from "../faker/index.js";
import { rng } from "../rng/index.js";

/** Turn one spec into the `data.faker.<name>` verb, drawn from the shared PRNG. */
function toAction(spec: FakerSpec): ActionDefinition {
  return defineAction({
    name: `faker.${spec.name}`,
    doc: spec.doc,
    // A faker verb takes bounds, not options, so every argument is positional:
    // `faker.int(1, 10)`. The spec declares which ones it reads.
    args: spec.args,
    result: spec.result,
    run: (_ctx, input) => spec.make(rng, input.args),
  });
}

/**
 * The `data.faker.*` verbs. Every value is deterministic under the shared seed,
 * so a failing run replays exactly. The catalogue itself lives in `faker/`.
 */
export const fakerActions: ActionDefinition[] = allFakerSpecs.map(toAction);
