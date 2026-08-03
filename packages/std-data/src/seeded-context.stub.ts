import { createSeededRandom } from "@venn-lang/contracts";
import type { ActionContext } from "@venn-lang/sdk";

/**
 * A context whose stream starts where a flow's does.
 *
 * `data.*` draws from the run's `Random`, so a test that wants the catalogue
 * from the top asks for another of these rather than reaching for a reset only
 * tests ever called.
 *
 * @returns A context carrying nothing but the port these verbs reach for.
 */
export function seededContext(): ActionContext {
  const random = createSeededRandom({ seed: 1 });
  const port = <T>(): T => random as T;
  return { port } as unknown as ActionContext;
}
