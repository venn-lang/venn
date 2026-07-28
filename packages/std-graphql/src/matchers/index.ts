import type { MatcherDefinition } from "@venn-lang/sdk";
import { noGraphqlErrors } from "./no-graphql-errors.js";

export const gqlMatchers: MatcherDefinition[] = [noGraphqlErrors];
