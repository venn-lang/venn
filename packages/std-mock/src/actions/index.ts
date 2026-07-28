import type { ActionDefinition } from "@venn/sdk";
import { clockAdvance, clockFreeze } from "./clock-actions.js";
import { flag } from "./flag-actions.js";
import { intercept, respond } from "./intercept-actions.js";
import { reset, start, stop } from "./lifecycle-actions.js";

/** Every verb in the `mock` namespace, in the order the editor lists them. */
export const mockActions: ActionDefinition[] = [
  start,
  stop,
  intercept,
  respond,
  clockFreeze,
  clockAdvance,
  flag,
  reset,
];
