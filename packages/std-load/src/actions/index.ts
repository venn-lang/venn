import type { ActionDefinition } from "@venn/sdk";
import { constantAction } from "./constant.js";
import { rampAction } from "./ramp.js";
import { runAction } from "./run.js";
import { spikeAction } from "./spike.js";

/** Every verb in the `load` namespace, in the order the plugin registers them. */
export const loadActions: ActionDefinition[] = [rampAction, constantAction, spikeAction, runAction];
