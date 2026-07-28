import type { MatcherDefinition } from "@venn-lang/sdk";
import { ofType } from "./of-type.js";

export const wsMatchers: MatcherDefinition[] = [ofType];
