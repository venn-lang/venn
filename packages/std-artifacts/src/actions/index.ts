import type { ActionDefinition } from "@venn-lang/sdk";
import { attachAction } from "./attach.js";
import { flushAction } from "./flush.js";
import { saveAction } from "./save.js";

/** Every verb in the `artifacts` namespace, in the order the plugin registers them. */
export const artifactsActions: ActionDefinition[] = [saveAction, flushAction, attachAction];
