import type { MatcherDefinition } from "@venn/sdk";
import { closeTo } from "./close-to.js";
import { contains } from "./contains.js";
import { equals } from "./equals.js";
import { oneOf } from "./one-of.js";

/** The words `expect` gains from this plugin: `equals`, `contains`, `oneOf`, `closeTo`. */
export const assertMatchers: MatcherDefinition[] = [equals, contains, oneOf, closeTo];
