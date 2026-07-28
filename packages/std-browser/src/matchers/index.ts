import type { MatcherDefinition } from "@venn/sdk";
import { text } from "./text.js";
import { visible } from "./visible.js";

/** Every matcher the `browser` namespace contributes to `expect`. */
export const browserMatchers: MatcherDefinition[] = [visible, text];
