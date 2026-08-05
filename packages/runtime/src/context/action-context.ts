import type { Host, Port } from "@venn-lang/contracts";
import { displayValue, invoke } from "@venn-lang/core";
import type { ActionContext } from "@venn-lang/sdk";
import type { PortResolver } from "../ports/index.js";

/**
 * Build the context an action's `run` receives from the host and port resolver.
 *
 * This is also where a plugin is handed `show`. The renderer lives in `core`,
 * which a plugin may not depend on, and the runtime is the one package that
 * depends on both `core` and `sdk`, so passing it through the context is what
 * lets `io.print` write a value the way `print` does without anybody's
 * dependencies pointing the wrong way.
 */
export function createActionContext(args: {
  host: Host;
  ports: PortResolver;
  config?: Record<string, unknown>;
}): ActionContext {
  return {
    port: <T>(port: Port<T>): T => args.ports.resolve(port),
    secrets: args.host.secrets,
    config: args.config ?? {},
    log: (message) => args.host.log.log({ level: "info", message }),
    show: (value) => displayValue(value),
    invoke: (fn, values) => invoke(fn, values),
  };
}
