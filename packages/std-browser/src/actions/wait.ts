import { type ActionDefinition, Duration, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { browserDriver } from "./support.js";

const waitForParams = z.object({
  text: z.string().optional(),
  selector: z.string().optional(),
  timeout: Duration.optional(),
});

/**
 * `browser.waitFor { selector: "#cart", timeout: "10s" }`.
 *
 * Blocks until the page shows the given `text` or matches the given
 * `selector`. Use it in place of a sleep, so a slow page waits and a fast one
 * does not. `timeout` bounds the wait.
 */
export const waitFor: ActionDefinition = defineAction({
  name: "waitFor",
  doc: "Wait for a condition (text or selector) on the page.",
  params: waitForParams.optional(),
  result: t.void,
  run: (ctx, input) => browserDriver(ctx).waitFor(input.params ?? {}),
});
