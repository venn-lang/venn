import type { Host, Port } from "@venn-lang/contracts";
import { invoke } from "@venn-lang/core";
import type { ActionContext } from "@venn-lang/sdk";
import type { PortResolver } from "../ports/index.js";

/** Build the context an action's `run` receives from the host and port resolver. */
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
    redact: () => {},
    invoke: (fn, values) => invoke(fn, values),
  };
}
