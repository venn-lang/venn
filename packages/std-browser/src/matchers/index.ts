import type { MatcherDefinition } from "@venn-lang/sdk";
import { text } from "./text.js";
import { visible } from "./visible.js";

/** Every matcher the `browser` namespace contributes to `expect`. */
export const browserMatchers: MatcherDefinition[] = [visible, text];
