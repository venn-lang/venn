import type { ActionDefinition } from "@venn/sdk";
import { fakerActions } from "./faker-actions.js";
import { csv, json } from "./parse-actions.js";
import { oneOf, range, shuffle } from "./random-actions.js";

/** Every verb in the `data` namespace. Adding one is a single line here. */
export const dataActions: ActionDefinition[] = [...fakerActions, oneOf, range, shuffle, csv, json];
