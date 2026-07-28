import type { ActionDefinition } from "@venn/sdk";
import { apikey } from "./apikey.js";
import { basic } from "./basic.js";
import { bearer } from "./bearer.js";
import { hmac } from "./hmac.js";
import { jwt } from "./jwt.js";
import { oauth2 } from "./oauth2.js";
import { totp } from "./totp.js";

/** The auth namespace's verbs. Adding one is a single line here. */
export const authActions: ActionDefinition[] = [bearer, basic, apikey, hmac, totp, jwt, oauth2];
