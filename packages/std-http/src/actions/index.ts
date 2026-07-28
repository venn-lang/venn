import type { ActionDefinition } from "@venn-lang/sdk";
import { onAction } from "../server/on-action.js";
import { serveAction } from "../server/serve-action.js";
import { httpAction } from "./http-action.js";

/** The http namespace's verbs. Adding one is a single line here. */
export const httpActions: ActionDefinition[] = [
  httpAction({ name: "get", method: "GET" }),
  httpAction({ name: "post", method: "POST" }),
  httpAction({ name: "put", method: "PUT" }),
  httpAction({ name: "patch", method: "PATCH" }),
  httpAction({ name: "delete", method: "DELETE" }),
  httpAction({ name: "head", method: "HEAD" }),
  httpAction({ name: "options", method: "OPTIONS" }),
  // Serving, not requesting: a server stays, and the requests arrive later.
  serveAction(),
  onAction(),
];
