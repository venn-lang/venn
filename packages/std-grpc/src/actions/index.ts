import type { ActionDefinition } from "@venn-lang/sdk";
import { callAction, reflectAction, streamAction } from "./grpc-action.js";

/** The grpc namespace's verbs. */
export const grpcActions: ActionDefinition[] = [callAction, streamAction, reflectAction];
