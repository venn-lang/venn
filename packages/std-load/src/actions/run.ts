import { type ActionDefinition, type ActionInput, arg, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import type { LoadProfile } from "../profiles/index.js";
import { LoadRunnerPort } from "../runner/index.js";

/**
 * `load.run (load.ramp 0 200 { over: "30s" })`.
 *
 * Drives one profile through the `LoadRunner` port. This is the verb that
 * generates traffic; the builders only describe a shape.
 *
 * @returns the `load.Metrics` the run produced.
 * @throws {VennError} `VN8090` when the host's runner cannot execute a profile.
 */
export const runAction: ActionDefinition = defineAction({
  name: "run",
  doc: "Run a load profile and return its metrics.",
  args: [arg("profile", t.ref("load.Profile"), "A profile, as `load.ramp` and friends build.")],
  result: t.ref("load.Metrics"),
  run: (ctx, input) => ctx.port(LoadRunnerPort).run(profileOf(input)),
});

function profileOf(input: ActionInput<unknown>): LoadProfile {
  return input.args[0] as LoadProfile;
}
