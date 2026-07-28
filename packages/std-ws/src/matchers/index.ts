import type { MatcherDefinition } from "@venn/sdk";
import { ofType } from "./of-type.js";

export const wsMatchers: MatcherDefinition[] = [ofType];
