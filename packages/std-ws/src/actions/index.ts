import type { ActionDefinition } from "@venn/sdk";
import { wsClose } from "./close.js";
import { wsConnect } from "./connect.js";
import { wsExpect } from "./expect.js";
import { wsSend } from "./send.js";

/** The ws namespace's verbs. Adding one is a new file plus a single line here. */
export const wsActions: ActionDefinition[] = [wsConnect, wsSend, wsExpect, wsClose];
