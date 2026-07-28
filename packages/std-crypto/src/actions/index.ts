import type { ActionDefinition } from "@venn-lang/sdk";
import { encodingActions } from "./encoding-actions.js";
import { hashActions } from "./hash-actions.js";
import { jwtActions } from "./jwt-actions.js";
import { passwordActions } from "./password-actions.js";

/** The crypto namespace's verbs. */
export const cryptoActions: ActionDefinition[] = [
  ...hashActions,
  ...encodingActions,
  ...jwtActions,
  ...passwordActions,
];
