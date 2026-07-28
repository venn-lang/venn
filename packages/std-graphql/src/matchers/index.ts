import type { MatcherDefinition } from "@venn/sdk";
import { noGraphqlErrors } from "./no-graphql-errors.js";

export const gqlMatchers: MatcherDefinition[] = [noGraphqlErrors];
