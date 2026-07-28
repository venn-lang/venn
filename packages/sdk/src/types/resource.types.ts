import type { ResourceContext } from "./context.types.js";

/** The lifecycle scope of a managed resource. */
export type ResourceScope = "suite" | "worker" | "flow" | "step";

/** A handle with a runner-managed lifecycle (connections, browsers, brokers). */
export interface ResourceDefinition<T = unknown> {
  name: string;
  /** How long one instance lives, and therefore how much is shared. */
  scope: ResourceScope;
  open(ctx: ResourceContext): T | Promise<T>;
  /** Tear the handle down when its scope ends. Omit it for a handle that needs none. */
  close?(instance: T): void | Promise<void>;
}
