import type { ActionDefinition } from "@venn/sdk";
import { gqlAction } from "./gql-action.js";

/** The gql namespace's verbs. Adding one is a single line here. */
export const gqlActions: ActionDefinition[] = [
  gqlAction({ name: "query", transport: "execute" }),
  gqlAction({ name: "mutate", transport: "execute" }),
  gqlAction({ name: "subscribe", transport: "subscribe" }),
];
